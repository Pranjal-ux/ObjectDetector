import React, { useState } from 'react';
import { Video, Play, VideoOff, RefreshCw } from 'lucide-react';

export default function ServerFeedView({ config }) {
  const [sourceInput, setSourceInput] = useState('0');
  const [activeSource, setActiveSource] = useState('0');
  const [isStreaming, setIsStreaming] = useState(false);

  const handleStartStream = () => {
    setActiveSource(sourceInput);
    setIsStreaming(true);
  };

  const handleStopStream = () => {
    setIsStreaming(false);
  };

  return (
    <div className="studio-card">
      <div className="studio-card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="studio-card-title">
            <Video size={20} />
            <span>Server Camera Feed (MJPEG)</span>
          </div>

          <span className={`camera-status-pill ${isStreaming ? 'active' : 'off'}`}>
            {isStreaming ? '• Feed Active' : '• Feed Off'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {!isStreaming ? (
            <button className="btn btn-primary" onClick={handleStartStream}>
              <Play size={16} />
              <span>Launch Feed</span>
            </button>
          ) : (
            <button className="btn btn-danger" onClick={handleStopStream}>
              <VideoOff size={16} />
              <span>Turn Off Feed</span>
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="text"
          className="class-search-input"
          style={{ margin: 0, flex: 1, minWidth: '220px', padding: '10px' }}
          placeholder="Video source index '0', video file path, or RTSP URL..."
          value={sourceInput}
          onChange={(e) => setSourceInput(e.target.value)}
        />
        <button className="btn btn-secondary" onClick={handleStartStream}>
          <RefreshCw size={14} />
          <span>Apply Source</span>
        </button>
      </div>

      {/* Video Stream Stage */}
      <div className="video-stage-wrapper">
        {isStreaming ? (
          <img
            src={`http://localhost:8000/api/video_feed?source=${encodeURIComponent(activeSource)}`}
            alt="MJPEG Server Video Stream"
            className="video-element"
            onError={() => {
              console.error('MJPEG stream connection failed');
              setIsStreaming(false);
              alert('Could not open video source on server. Verify webcam access or video path.');
            }}
          />
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--text-dim)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <VideoOff size={52} style={{ opacity: 0.6 }} />
            <div style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-muted)' }}>Server Feed Disconnected</div>
            <p style={{ fontSize: '0.85rem' }}>Enter source index (e.g. '0') and click "Launch Feed"</p>
          </div>
        )}
      </div>
    </div>
  );
}
