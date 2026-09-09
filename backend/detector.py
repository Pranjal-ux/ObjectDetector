"""
detector.py
Core ObjectDetector module encapsulating YOLO model loading, inference, object
tracking, frame rendering, simple mode, and advanced OpenCV pipeline execution.
"""

import time
from typing import List, Optional, Dict, Union
import cv2
import numpy as np
from ultralytics import YOLO

from config import AppConfig
from .utils import FPSCalculator, FrameAnnotator, save_screenshot, parse_source


class ObjectDetector:
    """
    Main Object Detector controller managing inference, rendering, and interaction modes.
    """

    def __init__(self, config: AppConfig):
        """
        Initialize Object Detector with application configuration.
        
        Args:
            config (AppConfig): Application settings dataclass.
        """
        self.config = config
        self.config.validate()
        
        print(f"[INFO] Loading YOLO model from '{self.config.model_path}'...")
        try:
            self.model = YOLO(self.config.model_path)
            print(f"[SUCCESS] Model '{self.config.model_path}' loaded successfully.")
        except Exception as e:
            raise RuntimeError(f"Failed to load YOLO model from '{self.config.model_path}'. Error: {e}")
            
        # Log hardware device acceleration status
        import torch
        if self.config.device is not None:
            self.device_str = str(self.config.device)
        else:
            self.device_str = "CUDA (GPU)" if torch.cuda.is_available() else "CPU"
        print(f"[INFO] Inference execution target device: {self.device_str} | Image Size: {self.config.imgsz}px | FP16 Half: {self.config.half}")
        print(f"[INFO] Confidence Threshold: {self.config.conf_threshold} | IoU Threshold: {self.config.iou_threshold}")
            
        # Get dictionary of class ID -> class Name from model
        self.class_names: Dict[int, str] = self.model.names
        
        # Map user target class names (strings) to integer class IDs
        self.target_class_ids: Optional[List[int]] = self._resolve_target_classes(self.config.target_classes)
        
        # Helper modules
        self.fps_calculator = FPSCalculator(buffer_size=30)
        self.annotator = FrameAnnotator()

    def _resolve_target_classes(self, target_classes: Optional[List[str]]) -> Optional[List[int]]:
        """
        Convert string class names into integer class IDs based on model registry.
        
        Args:
            target_classes (Optional[List[str]]): List of class names (e.g. ['person', 'car']).
            
        Returns:
            Optional[List[int]]: List of integer class IDs or None if no filter specified.
        """
        if not target_classes:
            return None
            
        resolved_ids = []
        name_to_id = {v.lower(): k for k, v in self.class_names.items()}
        
        for name in target_classes:
            name_str = str(name).strip().lower()
            if name_str.isdigit():
                # Provided as an integer ID string
                resolved_ids.append(int(name_str))
            elif name_str in name_to_id:
                resolved_ids.append(name_to_id[name_str])
            else:
                print(f"[WARNING] Target class '{name}' not found in COCO dataset model classes. Skipping.")
                
        print(f"[INFO] Filtered target class IDs: {resolved_ids}")
        return resolved_ids if resolved_ids else None

    def run(self) -> None:
        """
        Execute object detection in the configured mode ('advanced' or 'simple').
        """
        if self.config.mode == "simple":
            self._run_simple_mode()
        else:
            self._run_advanced_mode()

    def _run_simple_mode(self) -> None:
        """
        Simple Mode: High-level streaming interface using built-in Ultralytics window viewer.
        """
        print("\n=======================================================")
        print("          RUNNING IN SIMPLE MODE (Ultralytics Stream)  ")
        print("=======================================================")
        print("Press 'q' in the window or Ctrl+C in terminal to stop.")
        
        source = parse_source(self.config.source)
        
        try:
            infer_kwargs = {
                "source": source,
                "conf": self.config.conf_threshold,
                "iou": self.config.iou_threshold,
                "classes": self.target_class_ids,
                "imgsz": self.config.imgsz,
                "show": True,
                "stream": True
            }
            if self.config.device is not None:
                infer_kwargs["device"] = self.config.device
            if self.config.half:
                infer_kwargs["half"] = True

            if self.config.enable_tracking:
                infer_kwargs["tracker"] = self.config.tracker_type
                infer_kwargs["persist"] = True
                results = self.model.track(**infer_kwargs)
            else:
                results = self.model.predict(**infer_kwargs)
                
            for result in results:
                # Simple loop keeping the stream active
                pass
                
        except KeyboardInterrupt:
            print("\n[INFO] Stopped simple mode execution.")
        except Exception as e:
            print(f"\n[ERROR] Exception in simple mode stream: {e}")

    def _run_advanced_mode(self) -> None:
        """
        Advanced Mode: Complete OpenCV capture and rendering pipeline with full control.
        """
        print("\n=======================================================")
        print("          RUNNING IN ADVANCED MODE (OpenCV Loop)       ")
        print("=======================================================")
        print("Controls: Press 's' to save screenshot | Press 'q' to quit")
        print("=======================================================\n")
        
        source = parse_source(self.config.source)
        
        # On Windows, cv2.CAP_DSHOW is dramatically more reliable than default MSMF for webcams
        if isinstance(source, int):
            cap = cv2.VideoCapture(source, cv2.CAP_DSHOW)
            if not cap.isOpened():
                # Fallback to default backend if CAP_DSHOW fails
                cap = cv2.VideoCapture(source)
        else:
            cap = cv2.VideoCapture(source)
        
        if not cap.isOpened():
            raise RuntimeError(
                f"Failed to open video source '{self.config.source}'. "
                "Please verify webcam access, video file existence, or RTSP URL stream connectivity."
            )
            
        info_message = ""
        info_message_expiry = 0.0
        consecutive_failures = 0
        max_failures = 15
        
        try:
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret or frame is None or frame.size == 0:
                    consecutive_failures += 1
                    if consecutive_failures >= max_failures:
                        print("[INFO] End of video stream or repeated failure to read frames. Exiting loop.")
                        break
                    time.sleep(0.01)
                    continue
                    
                consecutive_failures = 0
                    
                # Run YOLO inference / tracking on frame
                infer_kwargs = {
                    "conf": self.config.conf_threshold,
                    "iou": self.config.iou_threshold,
                    "classes": self.target_class_ids,
                    "imgsz": self.config.imgsz,
                    "verbose": False
                }
                if self.config.device is not None:
                    infer_kwargs["device"] = self.config.device
                if self.config.half:
                    infer_kwargs["half"] = True

                if self.config.enable_tracking:
                    infer_kwargs["tracker"] = self.config.tracker_type
                    infer_kwargs["persist"] = True
                    results = self.model.track(frame, **infer_kwargs)
                else:
                    results = self.model(frame, **infer_kwargs)
                    
                result = results[0]
                
                # Extract detection details safely
                boxes = result.boxes.xyxy.cpu().numpy() if len(result.boxes) > 0 else np.array([])
                scores = result.boxes.conf.cpu().numpy() if len(result.boxes) > 0 else np.array([])
                class_ids = result.boxes.cls.cpu().numpy() if len(result.boxes) > 0 else np.array([])
                
                track_ids = None
                if self.config.enable_tracking and result.boxes.id is not None:
                    track_ids = result.boxes.id.cpu().numpy()
                    
                # Update FPS counter
                current_fps = self.fps_calculator.update()
                
                # Draw detections and HUD overlays
                annotated_frame = self.annotator.draw_detections(
                    frame=frame,
                    boxes=boxes,
                    scores=scores,
                    class_ids=class_ids,
                    class_names=self.class_names,
                    track_ids=track_ids
                )
                
                # Check for active temporary notification message
                active_msg = info_message if time.time() < info_message_expiry else ""
                
                annotated_frame = self.annotator.draw_hud(
                    frame=annotated_frame,
                    fps=current_fps,
                    model_name=self.config.model_path,
                    mode=self.config.mode,
                    tracking_enabled=self.config.enable_tracking,
                    device_name=self.device_str,
                    imgsz=self.config.imgsz,
                    filtered_classes=self.config.target_classes,
                    info_message=active_msg
                )
                
                # Display output window
                cv2.imshow(self.config.window_name, annotated_frame)
                
                # Handle keyboard inputs
                key = cv2.waitKey(1) & 0xFF
                if key == ord('q') or key == 27:  # 'q' or ESC
                    print("[INFO] Quit signal received ('q' or ESC). Closing window...")
                    break
                elif key == ord('s'):
                    filepath = save_screenshot(annotated_frame, self.config.screenshot_dir)
                    info_message = f"Screenshot saved to: {filepath}"
                    info_message_expiry = time.time() + 3.0  # Show message for 3 seconds
                    print(f"[SUCCESS] {info_message}")
                    
        finally:
            cap.release()
            cv2.destroyAllWindows()
            print("[INFO] Video capture stream released and OpenCV windows closed.")
