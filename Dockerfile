# Hugging Face Spaces Deployment Dockerfile for Vizo Backend
FROM python:3.11-slim

# Install system dependencies for OpenCV
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libsm6 \
    libxrender1 \
    libxext6 \
    libgomp1 \
    libgl1-mesa-glx \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies first (layer cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code
COPY config.py .
COPY utils.py .
COPY detector.py .
COPY server.py .

# Create screenshots directory
RUN mkdir -p screenshots

# Pre-download YOLO26 model weights on build (bake into image)
RUN python -c "from ultralytics import YOLO; YOLO('yolo26n.pt')" 2>/dev/null || \
    python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')" || true

# HuggingFace Spaces runs on port 7860
EXPOSE 7860

CMD ["python", "-m", "uvicorn", "server:app", "--host", "0.0.0.0", "--port", "7860"]
