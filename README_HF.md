---
title: Vizo - Real-Time Object Detection API
emoji: 🎯
colorFrom: gray
colorTo: black
sdk: docker
app_port: 7860
pinned: false
license: mit
short_description: Real-Time YOLO26 Object Detection & Tracking Backend API
---

# Vizo Backend API

FastAPI backend for **Vizo** — a real-time object detection and multi-object tracking web application powered by Ultralytics YOLO26.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | System health & model status |
| `/api/models` | GET | List available YOLO model variants |
| `/api/classes` | GET | All 80 COCO detection classes |
| `/api/config` | GET/POST | Read / update detector configuration |
| `/api/detect` | POST | Run detection on uploaded image file |
| `/ws/stream` | WS | Real-time WebSocket frame streaming |
| `/api/screenshot` | POST | Save snapshot image |
| `/api/screenshots` | GET | List saved screenshot gallery |

## Interactive Docs

Visit `/docs` for the full Swagger interactive API documentation.
