"""
server.py - Production-ready Vizo FastAPI Backend
Adapted for HuggingFace Spaces Docker deployment (port 7860).
"""

import io
import os
import time
import base64
import asyncio
from typing import List, Optional, Dict, Any

import cv2
import torch
import numpy as np
from fastapi import FastAPI, UploadFile, File, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel

from config import AppConfig
from detector import ObjectDetector
from utils import save_screenshot

# ─── App Init ────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Vizo - Real-Time Object Detection API",
    description="Backend API for Vizo: Real-time YOLO26 object detection and tracking.",
    version="1.0.0"
)

# CORS: allow all origins (Vercel frontend + any localhost dev)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Screenshots directory
os.makedirs("screenshots", exist_ok=True)
app.mount("/screenshots", StaticFiles(directory="screenshots"), name="screenshots")

# ─── Global State ─────────────────────────────────────────────────────────────
app_config = AppConfig()
detector: Optional[ObjectDetector] = None

SUPPORTED_MODELS = [
    {"id": "yolo26n.pt", "name": "YOLO26 Nano (Fastest)", "description": "Lightweight nano model"},
    {"id": "yolo26s.pt", "name": "YOLO26 Small (Balanced)", "description": "Balanced speed and accuracy"},
    {"id": "yolo26m.pt", "name": "YOLO26 Medium (Accurate)", "description": "Higher precision model"},
    {"id": "yolo26l.pt", "name": "YOLO26 Large (High Precision)", "description": "High accuracy (GPU recommended)"},
    {"id": "yolo26x.pt", "name": "YOLO26 Extra Large (Max Precision)", "description": "Maximum accuracy"},
    {"id": "yolo11n.pt", "name": "YOLO11 Nano", "description": "Standard YOLO11 lightweight"},
]


def get_detector() -> ObjectDetector:
    global detector, app_config
    if detector is None:
        print("[INFO] Initializing ObjectDetector...")
        detector = ObjectDetector(app_config)
    return detector


class ConfigUpdateRequest(BaseModel):
    model_path: Optional[str] = None
    conf_threshold: Optional[float] = None
    iou_threshold: Optional[float] = None
    imgsz: Optional[int] = None
    enable_tracking: Optional[bool] = None
    tracker_type: Optional[str] = None
    target_classes: Optional[List[str]] = None


@app.on_event("startup")
def startup_event():
    try:
        get_detector()
    except Exception as e:
        print(f"[WARNING] Could not pre-warm model: {e}")


# ─── API Endpoints ─────────────────────────────────────────────────────────────
@app.get("/api/health")
def health_check():
    det = get_detector()
    return {
        "status": "online",
        "device": det.device_str,
        "cuda_available": torch.cuda.is_available(),
        "loaded_model": det.config.model_path,
        "class_count": len(det.class_names)
    }


@app.get("/api/models")
def list_models():
    return {"models": SUPPORTED_MODELS, "current": app_config.model_path}


@app.get("/api/classes")
def list_classes():
    det = get_detector()
    classes_list = [{"id": cid, "name": name} for cid, name in det.class_names.items()]
    return {"total": len(classes_list), "classes": classes_list, "active_filter": app_config.target_classes}


@app.get("/api/config")
def get_config():
    return app_config.to_dict()


@app.post("/api/config")
def update_config(req: ConfigUpdateRequest):
    global detector, app_config
    reload_model = False

    if req.model_path is not None and req.model_path != app_config.model_path:
        app_config.model_path = req.model_path
        reload_model = True

    if req.conf_threshold is not None: app_config.conf_threshold = req.conf_threshold
    if req.iou_threshold is not None: app_config.iou_threshold = req.iou_threshold
    if req.imgsz is not None: app_config.imgsz = req.imgsz
    if req.enable_tracking is not None: app_config.enable_tracking = req.enable_tracking
    if req.tracker_type is not None: app_config.tracker_type = req.tracker_type
    if req.target_classes is not None:
        app_config.target_classes = req.target_classes if len(req.target_classes) > 0 else None

    app_config.validate()

    if reload_model:
        detector = ObjectDetector(app_config)
    elif detector:
        detector.config = app_config
        detector.target_class_ids = detector._resolve_target_classes(app_config.target_classes)

    return {"message": "Configuration updated", "config": app_config.to_dict()}


def process_image_frame(cv_img: np.ndarray) -> Dict[str, Any]:
    """Core inference pipeline: run YOLO, annotate, return JSON + base64 image."""
    det = get_detector()
    start_time = time.perf_counter()

    infer_kwargs = {
        "conf": det.config.conf_threshold,
        "iou": det.config.iou_threshold,
        "classes": det.target_class_ids,
        "imgsz": det.config.imgsz,
        "verbose": False
    }
    if det.config.device is not None:
        infer_kwargs["device"] = det.config.device
    if det.config.half:
        infer_kwargs["half"] = True

    if det.config.enable_tracking:
        infer_kwargs["tracker"] = det.config.tracker_type
        infer_kwargs["persist"] = True
        results = det.model.track(cv_img, **infer_kwargs)
    else:
        results = det.model(cv_img, **infer_kwargs)

    result = results[0]
    boxes = result.boxes.xyxy.cpu().numpy() if len(result.boxes) > 0 else np.array([])
    scores = result.boxes.conf.cpu().numpy() if len(result.boxes) > 0 else np.array([])
    class_ids = result.boxes.cls.cpu().numpy() if len(result.boxes) > 0 else np.array([])
    track_ids = result.boxes.id.cpu().numpy() if (det.config.enable_tracking and result.boxes.id is not None) else None

    latency_ms = (time.perf_counter() - start_time) * 1000.0
    current_fps = det.fps_calculator.update()

    annotated = det.annotator.draw_detections(
        frame=cv_img, boxes=boxes, scores=scores,
        class_ids=class_ids, class_names=det.class_names, track_ids=track_ids
    )

    detections = []
    for idx, box in enumerate(boxes):
        x1, y1, x2, y2 = map(float, box[:4])
        score = float(scores[idx]) if idx < len(scores) else 0.0
        cls_id = int(class_ids[idx]) if idx < len(class_ids) else 0
        cls_name = det.class_names.get(cls_id, f"Class {cls_id}")
        t_id = int(track_ids[idx]) if (track_ids is not None and idx < len(track_ids) and track_ids[idx] is not None) else None
        color_bgr = det.annotator.get_color(cls_id)
        detections.append({
            "id": idx,
            "class_id": cls_id,
            "class_name": cls_name,
            "confidence": round(score, 3),
            "box": [round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1)],
            "track_id": t_id,
            "color": [color_bgr[2], color_bgr[1], color_bgr[0]]
        })

    _, buffer = cv2.imencode(".jpg", annotated, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
    base64_str = base64.b64encode(buffer).decode("utf-8")

    return {
        "fps": round(current_fps, 1),
        "latency_ms": round(latency_ms, 1),
        "detections": detections,
        "count": len(detections),
        "annotated_image": f"data:image/jpeg;base64,{base64_str}",
        "width": cv_img.shape[1],
        "height": cv_img.shape[0]
    }


@app.post("/api/detect")
async def detect_image(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise HTTPException(status_code=400, detail="Invalid or corrupt image format")
        return JSONResponse(content=process_image_frame(img))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Detection error: {str(e)}")


@app.websocket("/ws/stream")
async def websocket_stream(websocket: WebSocket):
    await websocket.accept()
    print("[INFO] WebSocket client connected.")
    try:
        while True:
            data = await websocket.receive_text()
            if not data:
                continue
            if "," in data:
                data = data.split(",")[1]
            img_bytes = base64.b64decode(data)
            nparr = np.frombuffer(img_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is not None:
                result_data = process_image_frame(img)
                await websocket.send_json(result_data)
            else:
                await websocket.send_json({"error": "Failed to decode frame"})
    except WebSocketDisconnect:
        print("[INFO] WebSocket client disconnected.")
    except Exception as e:
        print(f"[ERROR] WebSocket exception: {e}")


@app.get("/api/video_feed")
def video_feed(source: str = "0"):
    """MJPEG stream — only works when server has camera access (local deployment)."""
    def generate_mjpeg():
        src_val = int(source) if source.isdigit() else source
        if isinstance(src_val, int):
            cap = cv2.VideoCapture(src_val, cv2.CAP_DSHOW)
            if not cap.isOpened():
                cap = cv2.VideoCapture(src_val)
        else:
            cap = cv2.VideoCapture(src_val)

        try:
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret or frame is None:
                    break
                res = process_image_frame(frame)
                annotated_base64 = res["annotated_image"].split(",")[1]
                jpg_bytes = base64.b64decode(annotated_base64)
                yield (b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + jpg_bytes + b'\r\n')
                time.sleep(0.03)
        finally:
            cap.release()

    return StreamingResponse(generate_mjpeg(), media_type="multipart/x-mixed-replace; boundary=frame")


class ScreenshotSaveRequest(BaseModel):
    image_base64: str


@app.post("/api/screenshot")
def capture_screenshot(req: ScreenshotSaveRequest):
    try:
        data = req.image_base64
        if "," in data:
            data = data.split(",")[1]
        img_bytes = base64.b64decode(data)
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        filepath = save_screenshot(img, app_config.screenshot_dir)
        filename = os.path.basename(filepath)
        return {"success": True, "filename": filename, "url": f"/screenshots/{filename}", "filepath": filepath}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Screenshot save failed: {str(e)}")


@app.get("/api/screenshots")
def get_screenshots():
    s_dir = app_config.screenshot_dir
    files = []
    if os.path.exists(s_dir):
        for f in sorted(os.listdir(s_dir), reverse=True):
            if f.lower().endswith(('.png', '.jpg', '.jpeg')):
                f_path = os.path.join(s_dir, f)
                stat = os.stat(f_path)
                files.append({
                    "filename": f,
                    "url": f"/screenshots/{f}",
                    "size_bytes": stat.st_size,
                    "created_at": time.ctime(stat.st_mtime)
                })
    return {"screenshots": files, "count": len(files)}


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 7860))
    uvicorn.run("server:app", host="0.0.0.0", port=port)
