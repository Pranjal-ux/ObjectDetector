"""
main.py
CLI entry point for Real-Time Object Detection using Ultralytics YOLO26.
"""

import argparse
import sys
from config import AppConfig
from detector import ObjectDetector


def parse_args() -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Real-Time Object Detection & Tracking in Python using Ultralytics YOLO26",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )
    
    parser.add_argument(
        "--model",
        type=str,
        default="yolo26n.pt",
        help="Path to YOLO model file or pretrained weights name (e.g. yolo26n.pt, yolo26s.pt, yolo11n.pt, custom.pt)"
    )
    
    parser.add_argument(
        "--source",
        type=str,
        default="0",
        help="Input video source: '0' for default webcam, video file path, or RTSP/HTTP URL"
    )
    
    parser.add_argument(
        "--conf",
        type=float,
        default=0.35,
        help="Confidence threshold for object detection (0.0 to 1.0)"
    )
    
    parser.add_argument(
        "--iou",
        type=float,
        default=0.45,
        help="Intersection-over-Union (IoU) threshold for NMS"
    )
    
    parser.add_argument(
        "--imgsz",
        type=int,
        default=640,
        help="Inference image resolution size (e.g., 320 for speed, 640 for standard, 1280 for accuracy)"
    )
    
    parser.add_argument(
        "--device",
        type=str,
        default=None,
        help="Target execution device (e.g. 'cuda', 'cpu', '0')"
    )
    
    parser.add_argument(
        "--half",
        action="store_true",
        help="Enable FP16 half-precision CUDA inference acceleration"
    )
    
    parser.add_argument(
        "--classes",
        nargs="+",
        default=None,
        help="Filter specific target class names or IDs (e.g. --classes person car dog)"
    )
    
    parser.add_argument(
        "--track",
        action="store_true",
        help="Enable multi-object tracking with persistent IDs"
    )
    
    parser.add_argument(
        "--tracker",
        type=str,
        default="bytetrack.yaml",
        choices=["bytetrack.yaml", "botsort.yaml"],
        help="Tracker algorithm to use when --track is enabled"
    )
    
    parser.add_argument(
        "--mode",
        type=str,
        default="advanced",
        choices=["advanced", "simple"],
        help="Runtime mode: 'advanced' for OpenCV custom loop, 'simple' for Ultralytics viewer"
    )
    
    parser.add_argument(
        "--save-dir",
        type=str,
        default="screenshots",
        help="Output directory path for captured frame screenshots"
    )
    
    return parser.parse_args()


def main():
    """Main execution function."""
    args = parse_args()
    
    # Build AppConfig from CLI arguments
    config = AppConfig(
        model_path=args.model,
        source=args.source,
        conf_threshold=args.conf,
        iou_threshold=args.iou,
        imgsz=args.imgsz,
        device=args.device,
        half=args.half,
        target_classes=args.classes,
        enable_tracking=args.track,
        tracker_type=args.tracker,
        mode=args.mode,
        screenshot_dir=args.save_dir
    )
    
    try:
        detector = ObjectDetector(config)
        detector.run()
    except Exception as e:
        print(f"\n[FATAL ERROR] Application failed: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

