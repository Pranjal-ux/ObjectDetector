import React from 'react';
import { Activity, Cpu, Layers, CheckCircle2, ShieldAlert } from 'lucide-react';

export default function AnalyticsHUD({ healthStatus, config, classesList }) {
  return (
    <div className="studio-card">
      <div className="studio-card-header">
        <div className="studio-card-title">
          <Activity color="#00f2fe" size={20} />
          <span>System Telemetry & Model Diagnostics</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '4px' }}>Execution Hardware</div>
          <div style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--primary-cyan)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu size={20} />
            <span>{healthStatus.device || 'CUDA (GPU)'}</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            CUDA Acceleration: {healthStatus.cuda_available ? 'Available' : 'CPU Native'}
          </div>
        </div>

        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '4px' }}>Loaded Model Architecture</div>
          <div style={{ fontSize: '1.2rem', fontWeight: '700', color: '#fff' }}>
            {config.model_path}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Resolution: {config.imgsz}px | FP16 Half: {config.half ? 'ON' : 'OFF'}
          </div>
        </div>

        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '4px' }}>Detection Parameters</div>
          <div style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--primary-blue)' }}>
            Conf: {Math.round(config.conf_threshold * 100)}% | IoU: {Math.round(config.iou_threshold * 100)}%
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Tracking: {config.enable_tracking ? 'ByteTrack Persistent IDs' : 'Disabled'}
          </div>
        </div>

        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '4px' }}>Supported Classes</div>
          <div style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={20} />
            <span>{classesList.length || 80} COCO Classes</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Active Filter: {config.target_classes?.length || 'All Classes'}
          </div>
        </div>
      </div>
    </div>
  );
}
