"""
config.py
Configuration schema and default settings for YOLO26 Real-Time Object Detector.
"""

from dataclasses import dataclass, field
from typing import List, Optional, Union
import os


@dataclass
class AppConfig:
    """Configuration class for Object Detector application."""
    
    # Model parameters
    model_path: str = "yolo26n.pt"         # Default model weight path or name
    conf_threshold: float = 0.35            # Minimum confidence threshold (0.0 to 1.0)
    iou_threshold: float = 0.45             # NMS IoU threshold
    imgsz: int = 640                        # Inference image resolution size
    device: Optional[str] = None            # Inference device ('cuda', 'cpu', '0', etc.)
    half: bool = False                      # Half-precision FP16 GPU inference
    
    # Input video source: 0 for default webcam, video file path, or RTSP/HTTP URL
    source: Union[int, str] = 0             
    
    # Object tracking settings
    enable_tracking: bool = False           # Toggle multi-object tracking (model.track)
    tracker_type: str = "bytetrack.yaml"    # Tracker algorithm ('bytetrack.yaml' or 'botsort.yaml')
    
    # Class filtering: list of class names or None to detect all standard COCO classes
    target_classes: Optional[List[str]] = None
    
    # Execution mode: 'advanced' (OpenCV processing loop) or 'simple' (Ultralytics built-in stream viewer)
    mode: str = "advanced"
    
    # Display & screenshot settings
    window_name: str = "Ultralytics YOLO26 Object Detection"
    screenshot_dir: str = "screenshots"
    show_fps: bool = True
    
    # Web Server Settings
    web_host: str = "0.0.0.0"
    web_port: int = 8000
    
    def validate(self) -> None:
        """Validate configuration settings."""
        if not (0.0 <= self.conf_threshold <= 1.0):
            raise ValueError(f"Confidence threshold must be between 0.0 and 1.0, got {self.conf_threshold}")
        if not (0.0 <= self.iou_threshold <= 1.0):
            raise ValueError(f"IoU threshold must be between 0.0 and 1.0, got {self.iou_threshold}")
        if self.imgsz <= 0:
            raise ValueError(f"Inference image size must be greater than 0, got {self.imgsz}")
        if self.mode not in ("advanced", "simple"):
            raise ValueError(f"Invalid mode '{self.mode}'. Choose either 'advanced' or 'simple'.")
        
        # Ensure screenshot directory exists
        os.makedirs(self.screenshot_dir, exist_ok=True)

    def to_dict(self) -> dict:
        """Serialize configuration into a JSON-compatible dictionary."""
        return {
            "model_path": self.model_path,
            "conf_threshold": self.conf_threshold,
            "iou_threshold": self.iou_threshold,
            "imgsz": self.imgsz,
            "device": self.device,
            "half": self.half,
            "source": str(self.source),
            "enable_tracking": self.enable_tracking,
            "tracker_type": self.tracker_type,
            "target_classes": self.target_classes,
            "mode": self.mode,
            "screenshot_dir": self.screenshot_dir,
            "web_host": self.web_host,
            "web_port": self.web_port
        }

