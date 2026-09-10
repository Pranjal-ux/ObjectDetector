import React, { useEffect, useRef, useState } from "react";
import {
  Play,
  VideoOff,
  Camera as SnapIcon,
  Activity,
  Box,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

import { connectDetectionWebSocket, captureScreenshot } from "../services/api";

export default function LiveWebcamStudio({ config }) {
  const videoRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const hiddenCanvasRef = useRef(null);

  const [isStreaming, setIsStreaming] = useState(false);
  const [streamStats, setStreamStats] = useState({
    fps: 0,
    latency_ms: 0,
    count: 0,
  });
  const [detections, setDetections] = useState([]);
  const [notification, setNotification] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const wsRef = useRef(null);
  const frameIntervalRef = useRef(null);
  const streamRef = useRef(null);
  const isSendingFrameRef = useRef(false);
  const lastFrameSentTimeRef = useRef(0);
  const isStreamingRef = useRef(false);

  // ─────────────────────────────────────────────
  // START CAMERA
  // ─────────────────────────────────────────────

  const startWebcam = async () => {
    try {
      console.log("[Camera] Requesting camera stream...");
      setErrorMessage("");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });

      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) {
        throw new Error("Video element not initialized in DOM");
      }

      video.srcObject = stream;

      // Wait until browser loaded video metadata & dimensions
      await new Promise((resolve) => {
        if (video.readyState >= 2 && video.videoWidth > 0) {
          resolve();
          return;
        }

        video.onloadedmetadata = () => {
          resolve();
        };
      });

      await video.play();

      console.log(`[Camera] Active resolution: ${video.videoWidth}x${video.videoHeight}`);

      setIsStreaming(true);
      isStreamingRef.current = true;

      // Connect to WebSocket backend stream
      initWebSocket();
    } catch (err) {
      console.error("[Camera] Failed to open webcam:", err);
      setErrorMessage("Could not access webcam. Please check browser camera permissions.");
      setIsStreaming(false);
      isStreamingRef.current = false;
    }
  };

  // ─────────────────────────────────────────────
  // CONNECT WEBSOCKET
  // ─────────────────────────────────────────────

  const initWebSocket = () => {
    if (!isStreamingRef.current) return;

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (e) {
        // ignore
      }
    }

    console.log("[WebSocket] Connecting to backend server...");

    const ws = connectDetectionWebSocket(
      (payload) => {
        // Always reset sending flag when response is received
        isSendingFrameRef.current = false;

        if (!isStreamingRef.current) return;

        if (payload.error) {
          console.error("[Backend Error]", payload.error);
          return;
        }

        if (payload.fps !== undefined) {
          setStreamStats({
            fps: payload.fps,
            latency_ms: payload.latency_ms,
            count: payload.count,
          });

          setDetections(payload.detections || []);

          renderBoundingBoxes(
            payload.detections || [],
            payload.width,
            payload.height
          );
        }
      },

      (err) => {
        console.error("[WebSocket] Transport error:", err);
        isSendingFrameRef.current = false;
      },

      () => {
        console.log("[WebSocket] Connection closed.");
        isSendingFrameRef.current = false;

        // Auto-reconnect if streaming is still active
        if (isStreamingRef.current) {
          console.log("[WebSocket] Attempting reconnection in 1.5s...");
          setTimeout(() => {
            if (isStreamingRef.current) {
              initWebSocket();
            }
          }, 1500);
        }
      }
    );

    wsRef.current = ws;

    // Poll until WebSocket transitions to OPEN state
    const waitForWebSocket = () => {
      if (!isStreamingRef.current || !wsRef.current) {
        return;
      }

      if (wsRef.current.readyState === WebSocket.OPEN) {
        console.log("[WebSocket] Connection OPEN. Starting frame transmission loop.");
        startFrameLoop();
        return;
      }

      if (wsRef.current.readyState === WebSocket.CLOSED) {
        console.error("[WebSocket] Connection failed to open.");
        return;
      }

      setTimeout(waitForWebSocket, 100);
    };

    waitForWebSocket();
  };

  // ─────────────────────────────────────────────
  // FRAME LOOP
  // ─────────────────────────────────────────────

  const startFrameLoop = () => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
    }

    console.log("[Camera] Starting frame transmission interval (120ms)...");

    frameIntervalRef.current = setInterval(() => {
      sendFrame();
    }, 120);
  };

  // ─────────────────────────────────────────────
  // SEND FRAME
  // ─────────────────────────────────────────────

  const sendFrame = () => {
    if (!isStreamingRef.current) return;

    const video = videoRef.current;
    const canvas = hiddenCanvasRef.current;
    const ws = wsRef.current;

    if (!video || !canvas || !ws) return;

    if (ws.readyState !== WebSocket.OPEN) return;

    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    // Safety timeout: If pending frame hasn't received response in > 2000ms, unlock
    if (isSendingFrameRef.current) {
      if (Date.now() - lastFrameSentTimeRef.current > 2000) {
        console.warn("[Camera] Frame response timed out. Unlocking transmission.");
        isSendingFrameRef.current = false;
      } else {
        return;
      }
    }

    isSendingFrameRef.current = true;
    lastFrameSentTimeRef.current = Date.now();

    // Preserve true aspect ratio when resizing frame for model inference
    const videoW = video.videoWidth;
    const videoH = video.videoHeight;
    const maxDim = 640;

    let sendW = videoW;
    let sendH = videoH;

    if (videoW > maxDim || videoH > maxDim) {
      if (videoW >= videoH) {
        sendW = maxDim;
        sendH = Math.round(maxDim * (videoH / videoW));
      } else {
        sendH = maxDim;
        sendW = Math.round(maxDim * (videoW / videoH));
      }
    }

    canvas.width = sendW;
    canvas.height = sendH;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      isSendingFrameRef.current = false;
      return;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const base64Data = canvas.toDataURL("image/jpeg", 0.65);

    try {
      ws.send(base64Data);
    } catch (error) {
      console.error("[WebSocket] Failed to send frame:", error);
      isSendingFrameRef.current = false;
    }
  };

  // ─────────────────────────────────────────────
  // STOP CAMERA
  // ─────────────────────────────────────────────

  const stopWebcam = () => {
    console.log("[Camera] Stopping webcam stream...");

    isStreamingRef.current = false;
    setIsStreaming(false);

    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }

    isSendingFrameRef.current = false;

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (error) {
        console.error("[WebSocket] Close error:", error);
      }
      wsRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    setDetections([]);
    setStreamStats({
      fps: 0,
      latency_ms: 0,
      count: 0,
    });

    clearOverlay();
  };

  // ─────────────────────────────────────────────
  // CLEAR OVERLAY
  // ─────────────────────────────────────────────

  const clearOverlay = () => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  // ─────────────────────────────────────────────
  // DRAW BOUNDING BOXES (LETTERBOX-AWARE)
  // ─────────────────────────────────────────────

  const renderBoundingBoxes = (items, origW, origH) => {
    const canvas = overlayCanvasRef.current;
    const video = videoRef.current;

    if (!canvas || !video) return;

    const displayWidth = video.clientWidth;
    const displayHeight = video.clientHeight;

    if (displayWidth === 0 || displayHeight === 0) return;

    canvas.width = displayWidth;
    canvas.height = displayHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate actual letterboxing / pillarboxing offset inside <video> container
    const sourceW = origW || video.videoWidth || 640;
    const sourceH = origH || video.videoHeight || 480;

    const videoAspect = sourceW / sourceH;
    const containerAspect = displayWidth / displayHeight;

    let renderW, renderH, offsetX, offsetY;

    if (containerAspect > videoAspect) {
      renderH = displayHeight;
      renderW = displayHeight * videoAspect;
      offsetX = (displayWidth - renderW) / 2;
      offsetY = 0;
    } else {
      renderW = displayWidth;
      renderH = displayWidth / videoAspect;
      offsetX = 0;
      offsetY = (displayHeight - renderH) / 2;
    }

    const scaleX = renderW / sourceW;
    const scaleY = renderH / sourceH;

    items.forEach((item) => {
      const [x1, y1, x2, y2] = item.box;

      const sx1 = offsetX + x1 * scaleX;
      const sy1 = offsetY + y1 * scaleY;
      const sw = (x2 - x1) * scaleX;
      const sh = (y2 - y1) * scaleY;

      // Color selection (use backend color if provided or default bright white)
      let strokeColor = "#ffffff";
      let fillColor = "rgba(255, 255, 255, 0.12)";

      if (item.color && Array.isArray(item.color) && item.color.length === 3) {
        const [r, g, b] = item.color;
        strokeColor = `rgb(${r}, ${g}, ${b})`;
        fillColor = `rgba(${r}, ${g}, ${b}, 0.18)`;
      }

      // Draw bounding box
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = strokeColor;
      ctx.fillStyle = fillColor;

      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(sx1, sy1, sw, sh, 6);
      } else {
        ctx.rect(sx1, sy1, sw, sh);
      }

      ctx.fill();
      ctx.stroke();

      // Format label text
      const labelText =
        item.track_id !== null && item.track_id !== undefined
          ? `#${item.track_id} ${item.class_name} ${(item.confidence * 100).toFixed(0)}%`
          : `${item.class_name} ${(item.confidence * 100).toFixed(0)}%`;

      ctx.font = "600 13px Outfit, sans-serif";
      const textMetrics = ctx.measureText(labelText);
      const textW = textMetrics.width;
      const textH = 20;

      const labelY = Math.max(sy1 - textH - 4, offsetY);

      // Label background pill
      ctx.fillStyle = strokeColor;
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(sx1, labelY, textW + 14, textH, 4);
      } else {
        ctx.rect(sx1, labelY, textW + 14, textH);
      }
      ctx.fill();

      // Label text (black for contrast on bright pill)
      ctx.fillStyle = "#000000";
      ctx.fillText(labelText, sx1 + 7, labelY + 14);
    });
  };

  // ─────────────────────────────────────────────
  // SNAPSHOT (COMPOSITE VIDEO + ANNOTATIONS)
  // ─────────────────────────────────────────────

  const handleTakeSnapshot = async () => {
    const video = videoRef.current;
    if (!video || !isStreaming) return;

    try {
      const snapCanvas = document.createElement("canvas");
      const w = video.videoWidth || 640;
      const h = video.videoHeight || 480;

      snapCanvas.width = w;
      snapCanvas.height = h;

      const sCtx = snapCanvas.getContext("2d");
      if (!sCtx) return;

      // Draw original camera video frame
      sCtx.drawImage(video, 0, 0, w, h);

      // Draw bounding box overlays on top
      if (overlayCanvasRef.current) {
        sCtx.drawImage(overlayCanvasRef.current, 0, 0, w, h);
      }

      const base64Data = snapCanvas.toDataURL("image/jpeg", 0.9);
      const res = await captureScreenshot(base64Data);

      setNotification(`Snapshot saved as ${res.filename}`);
      setTimeout(() => {
        setNotification("");
      }, 4000);
    } catch (e) {
      console.error("Failed to capture screenshot:", e);
    }
  };

  // ─────────────────────────────────────────────
  // CLEANUP ON UNMOUNT
  // ─────────────────────────────────────────────

  useEffect(() => {
    return () => {
      stopWebcam();
    };
  }, []);

  // ─────────────────────────────────────────────
  // UI RENDER
  // ─────────────────────────────────────────────

  return (
    <div className="studio-card">
      <div className="studio-card-header">
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div className="studio-card-title">
            <Sparkles size={20} />
            <span>Live Camera Studio</span>
          </div>

          <span className={`camera-status-pill ${isStreaming ? "active" : "off"}`}>
            {isStreaming ? "• Camera Active" : "• Camera Off"}
          </span>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {!isStreaming ? (
            <button className="btn btn-primary" onClick={startWebcam}>
              <Play size={16} />
              <span>Turn On Camera</span>
            </button>
          ) : (
            <>
              <button className="btn btn-secondary" onClick={handleTakeSnapshot}>
                <SnapIcon size={16} />
                <span>Take Snapshot</span>
              </button>

              <button className="btn btn-danger" onClick={stopWebcam}>
                <VideoOff size={16} />
                <span>Turn Off Camera</span>
              </button>
            </>
          )}
        </div>
      </div>

      {errorMessage && (
        <div
          style={{
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            color: "var(--accent-red)",
            padding: "10px 14px",
            borderRadius: "8px",
            fontSize: "0.88rem",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      {notification && (
        <div
          style={{
            background: "var(--badge-bg)",
            border: "1px solid var(--border-color)",
            padding: "10px 14px",
            borderRadius: "8px",
            fontSize: "0.88rem",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <CheckCircle2 size={16} color="var(--accent-green)" />
          <span>{notification}</span>
        </div>
      )}

      <div className="video-stage-wrapper">
        <video ref={videoRef} className="video-element" playsInline muted />
        <canvas ref={overlayCanvasRef} className="canvas-overlay" />
        <canvas ref={hiddenCanvasRef} style={{ display: "none" }} />

        {isStreaming && (
          <div className="hud-top-bar">
            <div className="hud-badge">
              <Activity size={14} />
              <span>
                FPS: <span className="fps-text">{streamStats.fps}</span>
              </span>
            </div>

            <div className="hud-badge">
              <Box size={14} />
              <span>
                Objects: <strong>{streamStats.count}</strong>
              </span>
            </div>

            <div className="hud-badge">
              <span>
                Latency: <strong>{streamStats.latency_ms} ms</strong>
              </span>
            </div>
          </div>
        )}

        {!isStreaming && (
          <div
            style={{
              textAlign: "center",
              color: "var(--text-dim)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "14px",
            }}
          >
            <VideoOff size={54} style={{ opacity: 0.6 }} />

            <div
              style={{
                fontSize: "1.05rem",
                fontWeight: "600",
                color: "var(--text-muted)",
              }}
            >
              Camera is Turned Off
            </div>

            <p style={{ fontSize: "0.85rem" }}>
              Click "Turn On Camera" to start live object detection
            </p>

            <button
              className="btn btn-primary"
              style={{ marginTop: "6px" }}
              onClick={startWebcam}
            >
              <Play size={16} />
              <span>Start Camera Stream</span>
            </button>
          </div>
        )}
      </div>

      {isStreaming && detections.length > 0 && (
        <div>
          <div
            style={{
              fontSize: "0.9rem",
              fontWeight: "700",
              marginBottom: "10px",
              color: "var(--text-main)",
            }}
          >
            Real-Time Detections ({detections.length})
          </div>

          <div className="detections-grid">
            {detections.map((d, i) => (
              <div key={i} className="detection-card">
                <div className="detection-card-header">
                  <span>{d.class_name}</span>
                  <span className="detection-conf">
                    {(d.confidence * 100).toFixed(0)}%
                  </span>
                </div>

                {d.track_id !== null && d.track_id !== undefined && (
                  <div className="detection-track">Track ID: #{d.track_id}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
