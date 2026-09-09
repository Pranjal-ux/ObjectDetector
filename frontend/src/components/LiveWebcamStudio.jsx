import React, { useEffect, useRef, useState } from 'react';
import { Camera, Play, VideoOff, Camera as SnapIcon, Activity, Box, Sparkles, CheckCircle2, ShieldOff } from 'lucide-react';
import { connectDetectionWebSocket, captureScreenshot } from '../services/api';

export default function LiveWebcamStudio({ config }) {
  const videoRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const hiddenCanvasRef = useRef(null);

  const [isStreaming, setIsStreaming] = useState(false);
  const [streamStats, setStreamStats] = useState({ fps: 0, latency_ms: 0, count: 0 });
  const [detections, setDetections] = useState([]);
  const [notification, setNotification] = useState('');

  const wsRef = useRef(null);
  const frameIntervalRef = useRef(null);

  // Start Browser Webcam
  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
        audio: false
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      setIsStreaming(true);

      // Connect WebSocket
      wsRef.current = connectDetectionWebSocket(
        (payload) => {
          if (payload.fps !== undefined) {
            setStreamStats({
              fps: payload.fps,
              latency_ms: payload.latency_ms,
              count: payload.count
            });
            setDetections(payload.detections || []);
            renderBoundingBoxes(payload.detections || [], payload.width, payload.height);
          }
        },
        (err) => console.error('WS Error:', err),
        () => setIsStreaming(false)
      );

      // Start frame capture loop (approx 20-30 FPS)
      frameIntervalRef.current = setInterval(() => {
        sendFrame();
      }, 45);
    } catch (err) {
      console.error('Failed to open browser webcam:', err);
      alert('Could not access webcam. Please check browser permissions.');
    }
  };

  // Turn Off Camera Completely
  const stopWebcam = () => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((track) => {
        track.stop(); // Turn off camera hardware sensor
      });
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
    setDetections([]);
    clearOverlay();
  };

  const sendFrame = () => {
    if (!videoRef.current || !hiddenCanvasRef.current || !wsRef.current) return;
    if (wsRef.current.readyState !== WebSocket.OPEN) return;

    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    const canvas = hiddenCanvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const base64Data = canvas.toDataURL('image/jpeg', 0.7);
    wsRef.current.send(base64Data);
  };

  const clearOverlay = () => {
    if (!overlayCanvasRef.current) return;
    const ctx = overlayCanvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
  };

  const renderBoundingBoxes = (items, origW, origH) => {
    if (!overlayCanvasRef.current || !videoRef.current) return;

    const canvas = overlayCanvasRef.current;
    const video = videoRef.current;

    canvas.width = video.clientWidth;
    canvas.height = video.clientHeight;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scaleX = canvas.width / (origW || video.videoWidth || 1);
    const scaleY = canvas.height / (origH || video.videoHeight || 1);

    items.forEach((item) => {
      const [x1, y1, x2, y2] = item.box;
      const sx1 = x1 * scaleX;
      const sy1 = y1 * scaleY;
      const sw = (x2 - x1) * scaleX;
      const sh = (y2 - y1) * scaleY;

      // Clean monochrome outline for sleek theme
      const strokeColor = '#ffffff';
      const fillColor = 'rgba(255, 255, 255, 0.12)';

      // Bounding Box
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = strokeColor;
      ctx.fillStyle = fillColor;
      ctx.beginPath();
      ctx.roundRect(sx1, sy1, sw, sh, 6);
      ctx.fill();
      ctx.stroke();

      // Label Tag
      const labelText = item.track_id !== null && item.track_id !== undefined
        ? `#${item.track_id} ${item.class_name} ${(item.confidence * 100).toFixed(0)}%`
        : `${item.class_name} ${(item.confidence * 100).toFixed(0)}%`;

      ctx.font = '600 13px Outfit, sans-serif';
      const textMetrics = ctx.measureText(labelText);
      const textW = textMetrics.width;
      const textH = 20;

      const labelY = Math.max(sy1 - textH - 4, 0);

      // Label pill
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(sx1, labelY, textW + 12, textH, 4);
      ctx.fill();

      // Text inside pill
      ctx.fillStyle = '#000000';
      ctx.fillText(labelText, sx1 + 6, labelY + 14);
    });
  };

  const handleTakeSnapshot = async () => {
    if (!hiddenCanvasRef.current || !isStreaming) return;
    try {
      const canvas = hiddenCanvasRef.current;
      const base64Data = canvas.toDataURL('image/jpeg', 0.9);
      const res = await captureScreenshot(base64Data);
      setNotification(`Snapshot saved as ${res.filename}`);
      setTimeout(() => setNotification(''), 4000);
    } catch (e) {
      console.error('Failed to take screenshot:', e);
    }
  };

  useEffect(() => {
    return () => {
      stopWebcam();
    };
  }, []);

  return (
    <div className="studio-card">
      <div className="studio-card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="studio-card-title">
            <Sparkles size={20} />
            <span>Live Camera Studio</span>
          </div>

          <span className={`camera-status-pill ${isStreaming ? 'active' : 'off'}`}>
            {isStreaming ? '• Camera Active' : '• Camera Off'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
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

      {notification && (
        <div style={{ background: 'var(--badge-bg)', border: '1px solid var(--border-color)', padding: '10px 14px', borderRadius: '8px', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={16} color="var(--accent-green)" />
          <span>{notification}</span>
        </div>
      )}

      {/* Main Video Stream Stage */}
      <div className="video-stage-wrapper">
        <video ref={videoRef} className="video-element" playsInline muted />
        <canvas ref={overlayCanvasRef} className="canvas-overlay" />
        <canvas ref={hiddenCanvasRef} style={{ display: 'none' }} />

        {isStreaming && (
          <div className="hud-top-bar">
            <div className="hud-badge">
              <Activity size={14} />
              <span>FPS: <span className="fps-text">{streamStats.fps}</span></span>
            </div>

            <div className="hud-badge">
              <Box size={14} />
              <span>Objects: <strong>{streamStats.count}</strong></span>
            </div>

            <div className="hud-badge">
              <span>Latency: <strong>{streamStats.latency_ms} ms</strong></span>
            </div>
          </div>
        )}

        {!isStreaming && (
          <div style={{ textAlign: 'center', color: 'var(--text-dim)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
            <VideoOff size={54} style={{ opacity: 0.6 }} />
            <div style={{ fontSize: '1.05rem', fontWeight: '600', color: 'var(--text-muted)' }}>Camera is Turned Off</div>
            <p style={{ fontSize: '0.85rem' }}>Click "Turn On Camera" to start live object detection</p>
            <button className="btn btn-primary" style={{ marginTop: '6px' }} onClick={startWebcam}>
              <Play size={16} />
              <span>Start Camera Stream</span>
            </button>
          </div>
        )}
      </div>

      {/* Detections Breakdown Grid */}
      {isStreaming && detections.length > 0 && (
        <div>
          <div style={{ fontSize: '0.9rem', fontWeight: '700', marginBottom: '10px', color: 'var(--text-main)' }}>
            Real-Time Detections ({detections.length})
          </div>

          <div className="detections-grid">
            {detections.map((d, i) => (
              <div key={i} className="detection-card">
                <div className="detection-card-header">
                  <span>{d.class_name}</span>
                  <span className="detection-conf">{(d.confidence * 100).toFixed(0)}%</span>
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
