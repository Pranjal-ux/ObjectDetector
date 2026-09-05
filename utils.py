"""
utils.py
Utility functions and helper classes for stream parsing, FPS calculation,
frame annotation, and screenshot management.
"""

import os
import time
from datetime import datetime
from collections import deque
from typing import List, Tuple, Union, Dict, Optional
import cv2
import numpy as np


def parse_source(source_input: str) -> Union[int, str]:
    """
    Parse a source input string into an integer (for webcam index)
    or a string (for video file or RTSP stream).
    
    Args:
        source_input (str): Input string from CLI or config.
        
    Returns:
        Union[int, str]: Integer webcam index or file/URL string.
    """
    if str(source_input).isdigit():
        return int(source_input)
    return str(source_input)


class FPSCalculator:
    """
    Calculates frames per second (FPS) using a moving average
    window for stable, smooth display.
    """
    
    def __init__(self, buffer_size: int = 30):
        """
        Initialize FPS calculator.
        
        Args:
            buffer_size (int): Number of recent frame intervals to average.
        """
        self.buffer_size = buffer_size
        self.frame_times = deque(maxlen=buffer_size)
        self.prev_time = time.perf_counter()
        
    def update(self) -> float:
        """
        Update the timer with current frame arrival and return average FPS.
        
        Returns:
            float: Current calculated FPS value.
        """
        current_time = time.perf_counter()
        delta_time = current_time - self.prev_time
        self.prev_time = current_time
        
        if delta_time > 0:
            self.frame_times.append(delta_time)
            
        if not self.frame_times:
            return 0.0
            
        avg_delta = sum(self.frame_times) / len(self.frame_times)
        return 1.0 / avg_delta if avg_delta > 0 else 0.0


def save_screenshot(frame: np.ndarray, screenshot_dir: str = "screenshots") -> str:
    """
    Save the current frame as an image file with a timestamped filename.
    
    Args:
        frame (np.ndarray): OpenCV image frame.
        screenshot_dir (str): Destination directory.
        
    Returns:
        str: Absolute path of saved screenshot.
    """
    os.makedirs(screenshot_dir, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]
    filename = f"screenshot_{timestamp}.jpg"
    filepath = os.path.join(screenshot_dir, filename)
    
    cv2.imwrite(filepath, frame)
    return filepath


class FrameAnnotator:
    """
    Handles drawing modern, clean overlays on image frames including bounding
    boxes, labels, confidence scores, tracking IDs, and an information HUD bar.
    """
    
    def __init__(self):
        # Color palette for rendering different class IDs (distinct BGR colors)
        self.color_map: Dict[int, Tuple[int, int, int]] = {}
        np.random.seed(42)  # Consistent colors across runs
        
    def get_color(self, class_id: int) -> Tuple[int, int, int]:
        """
        Generate or retrieve a consistent, vibrant BGR color for a given class ID.
        """
        if class_id not in self.color_map:
            # Generate pleasant bright colors (avoiding dark values)
            color = tuple(map(int, np.random.randint(80, 255, size=3)))
            self.color_map[class_id] = color  # BGR format
        return self.color_map[class_id]
        
    def draw_detections(
        self,
        frame: np.ndarray,
        boxes: np.ndarray,
        scores: np.ndarray,
        class_ids: np.ndarray,
        class_names: Dict[int, str],
        track_ids: Optional[np.ndarray] = None
    ) -> np.ndarray:
        """
        Draw bounding boxes and label cards on the frame.
        
        Args:
            frame (np.ndarray): Original OpenCV frame (BGR).
            boxes (np.ndarray): Nx4 array of bounding box coordinates [x1, y1, x2, y2].
            scores (np.ndarray): N array of confidence scores.
            class_ids (np.ndarray): N array of integer class IDs.
            class_names (Dict[int, str]): Dictionary mapping class IDs to names.
            track_ids (Optional[np.ndarray]): N array of tracking IDs (if tracking is active).
            
        Returns:
            np.ndarray: Annotated frame.
        """
        if len(boxes) == 0:
            return frame
            
        annotated_frame = frame.copy()
        
        for idx, box in enumerate(boxes):
            x1, y1, x2, y2 = map(int, box[:4])
            score = scores[idx] if len(scores) > idx else 0.0
            cls_id = int(class_ids[idx]) if len(class_ids) > idx else 0
            cls_name = class_names.get(cls_id, f"Class {cls_id}")
            
            color = self.get_color(cls_id)
            
            # Format text label
            if track_ids is not None and idx < len(track_ids) and track_ids[idx] is not None:
                track_id = int(track_ids[idx])
                label_text = f"#{track_id} {cls_name} {score:.2f}"
            else:
                label_text = f"{cls_name} {score:.2f}"
                
            # Draw main bounding box with rounded corners look
            cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), color, 2, cv2.LINE_AA)
            
            # Calculate text dimensions for background pill label
            font_scale = 0.55
            font_thickness = 1
            font = cv2.FONT_HERSHEY_SIMPLEX
            (text_w, text_h), baseline = cv2.getTextSize(label_text, font, font_scale, font_thickness)
            
            # Label position (above bounding box if room, else inside top)
            label_y1 = max(y1 - text_h - 8, 0)
            label_y2 = label_y1 + text_h + 8
            label_x2 = min(x1 + text_w + 10, annotated_frame.shape[1])
            
            # Draw solid background label card
            cv2.rectangle(annotated_frame, (x1, label_y1), (label_x2, label_y2), color, -1)
            
            # Text color (white or black depending on brightness of box color)
            brightness = (color[0] * 0.114 + color[1] * 0.587 + color[2] * 0.299)
            text_color = (0, 0, 0) if brightness > 160 else (255, 255, 255)
            
            # Draw text inside card
            cv2.putText(
                annotated_frame,
                label_text,
                (x1 + 5, label_y2 - 5),
                font,
                font_scale,
                text_color,
                font_thickness,
                lineType=cv2.LINE_AA
            )
            
        return annotated_frame

    def draw_hud(
        self,
        frame: np.ndarray,
        fps: float,
        model_name: str,
        mode: str,
        tracking_enabled: bool,
        device_name: str = "CPU",
        imgsz: int = 640,
        filtered_classes: Optional[List[str]] = None,
        info_message: str = ""
    ) -> np.ndarray:
        """
        Draw a clean top Heads-Up Display (HUD) bar with system stats and keyboard controls.
        """
        h, w, _ = frame.shape
        bar_height = 40
        
        # Region-based alpha blending (blending ONLY top 40px bar instead of full frame)
        sub_region = frame[0:bar_height, 0:w]
        dark_bar = np.full_like(sub_region, (15, 15, 15))
        alpha = 0.75
        frame[0:bar_height, 0:w] = cv2.addWeighted(dark_bar, alpha, sub_region, 1 - alpha, 0)
        
        # Build HUD info text strings
        font = cv2.FONT_HERSHEY_SIMPLEX
        
        # Left section: FPS, Model, Device, Resolution, Track info
        track_str = "ON" if tracking_enabled else "OFF"
        left_text = f"FPS: {fps:.1f} | Model: {model_name} | {device_name} ({imgsz}px) | Track: {track_str}"
        cv2.putText(frame, left_text, (12, 26), font, 0.48, (0, 255, 255), 1, cv2.LINE_AA)
        
        # Right section: Control tips
        right_text = "[S] Save Frame  |  [Q] Quit"
        (text_w, _), _ = cv2.getTextSize(right_text, font, 0.48, 1)
        cv2.putText(frame, right_text, (w - text_w - 12, 26), font, 0.48, (220, 220, 220), 1, cv2.LINE_AA)
        
        # Bottom info message (e.g. screenshot saved confirmation)
        if info_message:
            msg_sub = frame[h - 45:h - 10, 10:w - 10]
            green_bar = np.full_like(msg_sub, (0, 120, 0))
            frame[h - 45:h - 10, 10:w - 10] = cv2.addWeighted(green_bar, 0.8, msg_sub, 0.2, 0)
            cv2.putText(frame, info_message, (20, h - 22), font, 0.55, (255, 255, 255), 1, cv2.LINE_AA)
            
        return frame
