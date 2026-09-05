# Real-Time Object Detection & Tracking with Ultralytics YOLO26

A production-ready, modular Python application for real-time object detection and multi-object tracking using **Ultralytics YOLO26** and **OpenCV**.

---

## 🌟 Features

- **Latest Model Support**: Native support for `yolo26n.pt` (nano for extreme speed), `yolo26s.pt`, `yolo26m.pt`, `yolo26l.pt`, `yolo26x.pt`, as well as standard YOLO11 / YOLOv8 weights and custom `.pt` files.
- **Multiple Video Input Sources**:
  - Webcams (default device index `0` or specified device)
  - Pre-recorded video files (`.mp4`, `.avi`, `.mkv`, etc.)
  - IP camera streams & RTSP feeds (`rtsp://...`, `http://...`)
- **Interactive Controls**:
  - **Live FPS Display**: Real-time rolling average FPS counter on HUD overlay.
  - **Confidence & IoU Threshold Control**: Adjust detection sensitivity dynamically via CLI arguments.
  - **Class Filtering**: Option to filter specific target object classes (e.g. `--classes person car dog`).
  - **Multi-Object Tracking**: Track objects across frames with persistent unique IDs using ByteTrack or BoT-SORT (`--track`).
  - **Interactive Keybindings**:
    - Press **`s`**: Save current frame as a timestamped screenshot into `screenshots/`.
    - Press **`q`**: Cleanly quit the stream.
- **Two Execution Modes**:
  - **Advanced Mode (Default)**: Custom OpenCV processing loop with modern bounding box styling, status HUD, and keyboard interactions.
  - **Simple Mode**: Direct execution utilizing Ultralytics' built-in stream window viewer.

---

## 📁 Project Architecture

```text
ObjectDetector/
├── config.py          # Centralized configuration schema & parameter validation
├── utils.py           # Stream parser, rolling FPS counter, screenshot exporter & FrameAnnotator
├── detector.py        # ObjectDetector core class implementing inference & capture loops
├── main.py            # CLI entry point with comprehensive argument parsing
├── requirements.txt   # Required Python libraries
└── README.md          # Complete user guide and technical documentation
```

---

## 🚀 Getting Started

### 1. Prerequisites

- Python **3.8+** installed.
- (Optional but recommended) CUDA-enabled GPU for maximum inference performance.

### 2. Installation

Clone or download the project directory, navigate into it, and install dependencies:

```bash
# Navigate to project directory
cd ObjectDetector

# Create virtual environment (optional but recommended)
python -m venv venv

# Activate virtual environment
# On Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# On Linux/macOS:
source venv/bin/activate

# Install required dependencies
pip install -r requirements.txt
```

---

## 💻 How to Run the Project

### 1. Default Webcam Detection (Advanced Mode)

Runs real-time detection on your default webcam (`index 0`) using `yolo26n.pt`:

```bash
python main.py
```

### 2. Enable Multi-Object Tracking with Unique IDs

Track objects and display unique IDs per detected object:

```bash
python main.py --track
```

### 3. Filter Specific Classes

Detect only specified target classes (e.g., only "person" and "car"):

```bash
python main.py --classes person car
```

### 4. Adjust Confidence Threshold

Set custom confidence threshold (e.g., `0.50`):

```bash
python main.py --conf 0.50
```

### 5. Detect from Video File

Process a pre-recorded video:

```bash
python main.py --source path/to/sample_video.mp4
```

### 6. Detect from RTSP / IP Camera Feed

Process a live network RTSP stream:

```bash
python main.py --source "rtsp://username:password@192.168.1.100:554/stream1"
```

### 7. Run in Simple Mode

Use Ultralytics' built-in native streaming window:

```bash
python main.py --mode simple
```

---

## ⚡ How to Change Model Sizes (n / s / m / l / x)

Ultralytics YOLO models come in different scale variants balancing speed and accuracy:

| Model | Variant Name | Trade-off | Command |
| :--- | :--- | :--- | :--- |
| **Nano** | `yolo26n.pt` | Fastest, lightest (ideal for webcams / embedded) | `python main.py --model yolo26n.pt` |
| **Small** | `yolo26s.pt` | Balanced speed & improved accuracy | `python main.py --model yolo26s.pt` |
| **Medium** | `yolo26m.pt` | Higher accuracy, moderate speed | `python main.py --model yolo26m.pt` |
| **Large** | `yolo26l.pt` | High accuracy (GPU recommended) | `python main.py --model yolo26l.pt` |
| **XLarge** | `yolo26x.pt` | Maximum accuracy | `python main.py --model yolo26x.pt` |

> *Note: Ultralytics automatically downloads pretrained weights on the first run if the specified `.pt` file is not present locally.*

---

## 🎯 How to Use a Custom Trained Model Later

If you train a custom YOLO model on your own dataset (e.g. trained using `yolo detect train data=coco8.yaml model=yolo26n.pt epochs=50`), you will get a custom weights file `best.pt`.

To run this project with your custom weights:

```bash
python main.py --model path/to/your/best.pt --source 0
```

The application automatically loads your custom class names directly from the `.pt` file metadata.

---

## ⌨️ Interactive Controls (Advanced Mode)

| Key | Action |
| :--- | :--- |
| **`s`** | Captures and saves the current frame to the `screenshots/` directory. |
| **`q`** | Quits the stream and safely closes all OpenCV windows. |

---

## ❓ Troubleshooting Misclassifications (e.g. Speaker detected as Cup)

Standard YOLO models (`yolo26n.pt`, `yolo11n.pt`, etc.) are trained on the **COCO dataset**, which contains exactly **80 standard object categories**. "Speaker" is **not** included in the COCO dataset.

When an object is shown to the model that isn't in its 80 trained classes:
1. The neural network maps the object's visual shape to the nearest COCO class (e.g. a cylindrical speaker looks like a `cup` or `bottle`).
2. **How to fix / prevent false detections**:
   - **Increase Confidence Threshold**: `--conf 0.40` (filters out weak guess predictions).
   - **Use a Larger Model Variant**: `--model yolo26s.pt` or `--model yolo26m.pt` (higher accuracy feature extraction).
   - **Filter Target Classes**: `--classes person laptop cell\ phone` (ignores unlisted classes).

---

## ⚡ Performance Efficiency & Optimization Options

| Flag | Purpose | Usage Example |
| :--- | :--- | :--- |
| `--conf` | Adjust detection confidence threshold | `python main.py --conf 0.40` |
| `--imgsz` | Set inference resolution (320 = fast, 640 = default, 1280 = sharp) | `python main.py --imgsz 320` |
| `--device` | Specify hardware execution target (`cuda`, `cpu`, `0`) | `python main.py --device cuda` |
| `--half` | FP16 half-precision CUDA speedup on NVIDIA GPUs | `python main.py --half` |

---

## 🧩 Architectural Flow & Code Explanation

1. **`config.py` (`AppConfig`)**: Centralized dataclass validating input parameters (model path, confidence thresholds, target class filtering, resolution size, hardware acceleration, and execution mode).
2. **`utils.py` (`FrameAnnotator` & `FPSCalculator`)**:
   - `FPSCalculator` maintains a rolling average of frame inter-arrival times using high-precision timers (`time.perf_counter()`).
   - `FrameAnnotator` uses fast region-based alpha blending and renders color-coded bounding boxes, confidence pills, tracking tags, and semi-transparent HUD status bars.
3. **`detector.py` (`ObjectDetector`)**:
   - Loads the YOLO neural network with device auto-detection (CUDA vs CPU).
   - Maps string class names (`--classes person car`) to numeric COCO dataset class indices.
   - Executes frame inference (`model(frame)`) or multi-object tracking (`model.track(frame)`).
   - Manages capture loops and keyboard commands (`'s'` for screenshot, `'q'` for quit).
4. **`main.py`**: Command-line entry point parsing user flags and bootstrapping the detector.
