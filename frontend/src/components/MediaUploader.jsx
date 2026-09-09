import React, { useState } from 'react';
import { Upload, Image as ImageIcon, CheckCircle2, Box, Activity, AlertCircle } from 'lucide-react';
import { detectImage } from '../services/api';

export default function MediaUploader() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResult(null);
      setError('');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResult(null);
      setError('');
    }
  };

  const handleRunDetection = async () => {
    if (!selectedFile) return;
    setLoading(true);
    setError('');
    try {
      const data = await detectImage(selectedFile);
      setResult(data);
    } catch (err) {
      console.error(err);
      setError('Failed to process image with YOLO backend.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="studio-card">
      <div className="studio-card-header">
        <div className="studio-card-title">
          <Upload color="#00f2fe" size={20} />
          <span>Upload Image / Video for Detection</span>
        </div>

        {selectedFile && (
          <button className="btn btn-primary" onClick={handleRunDetection} disabled={loading}>
            {loading ? 'Processing YOLO Inference...' : 'Run Object Detection'}
          </button>
        )}
      </div>

      {error && (
        <div style={{ background: 'rgba(255, 0, 128, 0.15)', border: '1px solid var(--accent-pink)', padding: '10px 14px', borderRadius: '8px', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={16} color="var(--accent-pink)" />
          <span>{error}</span>
        </div>
      )}

      {/* Drag & Drop File Zone */}
      {!result ? (
        <div
          className="dropzone"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => document.getElementById('fileInput').click()}
        >
          <input
            id="fileInput"
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />

          {previewUrl ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <img src={previewUrl} alt="Preview" style={{ maxHeight: '360px', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>File selected: {selectedFile.name}</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <ImageIcon size={48} color="var(--primary-cyan)" />
              <p style={{ fontSize: '1rem', fontWeight: '600' }}>Drag & Drop Image Here, or Click to Browse</p>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>Supports JPG, PNG, WEBP files</p>
            </div>
          )}
        </div>
      ) : (
        /* Detection Results Display */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="video-stage-wrapper">
            <img src={result.annotated_image} alt="Annotated Result" className="video-element" />

            <div className="hud-top-bar">
              <div className="hud-badge">
                <Activity size={14} color="#00f2fe" />
                <span>Latency: <strong>{result.latency_ms} ms</strong></span>
              </div>

              <div className="hud-badge">
                <Box size={14} color="#4facfe" />
                <span>Count: <strong style={{ color: '#fff' }}>{result.count}</strong> objects</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setResult(null);
                setSelectedFile(null);
                setPreviewUrl(null);
              }}
            >
              Upload Another Image
            </button>

            <a
              href={result.annotated_image}
              download={`yolo_detection_${Date.now()}.jpg`}
              className="btn btn-primary"
            >
              Download Annotated Image
            </a>
          </div>

          {/* Detections breakdown */}
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '10px' }}>
              Detection Results Summary ({result.detections.length} objects)
            </div>

            <div className="detections-grid">
              {result.detections.map((d) => (
                <div
                  key={d.id}
                  className="detection-card"
                  style={{ borderLeftColor: `rgb(${d.color ? d.color.join(',') : '0,242,254'})` }}
                >
                  <div className="detection-card-header">
                    <span>{d.class_name}</span>
                    <span className="detection-conf">{(d.confidence * 100).toFixed(0)}%</span>
                  </div>
                  <div className="detection-track">
                    BBox: [{d.box.join(', ')}]
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
