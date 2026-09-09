import React, { useState } from 'react';
import { Sliders, Cpu, Check, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

export default function ControlPanel({
  models,
  classesList,
  config,
  onUpdateConfig,
  loading
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isMobileCollapsed, setIsMobileCollapsed] = useState(true);

  const filteredClasses = classesList.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedClasses = config.target_classes || [];

  const handleClassToggle = (className) => {
    let updated = [];
    if (selectedClasses.includes(className)) {
      updated = selectedClasses.filter((c) => c !== className);
    } else {
      updated = [...selectedClasses, className];
    }
    onUpdateConfig({ target_classes: updated });
  };

  const handleClearClasses = () => {
    onUpdateConfig({ target_classes: [] });
  };

  return (
    <>
      <div
        className="mobile-sidebar-toggle"
        onClick={() => setIsMobileCollapsed(!isMobileCollapsed)}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sliders size={18} />
          <span>Detector Parameters</span>
        </span>
        {isMobileCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
      </div>

      <aside className={`control-sidebar ${isMobileCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-title">
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sliders size={18} />
            <span>Detector Controls</span>
          </span>
          {loading && <RefreshCw className="spin" size={14} />}
        </div>

        {/* Model Selector */}
        <div className="control-group">
          <label className="control-label">
            <span>Model Variant</span>
            <Cpu size={14} />
          </label>
          <select
            className="custom-select"
            value={config.model_path}
            onChange={(e) => onUpdateConfig({ model_path: e.target.value })}
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        {/* Confidence Threshold */}
        <div className="control-group">
          <div className="control-label">
            <span>Confidence Threshold</span>
            <span className="control-value">{Math.round(config.conf_threshold * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.05"
            max="0.95"
            step="0.05"
            className="custom-slider"
            value={config.conf_threshold}
            onChange={(e) => onUpdateConfig({ conf_threshold: parseFloat(e.target.value) })}
          />
        </div>

        {/* IoU NMS Threshold */}
        <div className="control-group">
          <div className="control-label">
            <span>IoU Threshold (NMS)</span>
            <span className="control-value">{Math.round(config.iou_threshold * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.10"
            max="0.90"
            step="0.05"
            className="custom-slider"
            value={config.iou_threshold}
            onChange={(e) => onUpdateConfig({ iou_threshold: parseFloat(e.target.value) })}
          />
        </div>

        {/* Multi-Object Tracking Toggle */}
        <div className="toggle-row">
          <div>
            <div style={{ fontSize: '0.88rem', fontWeight: '600' }}>Multi-Object Tracking</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>ByteTrack Unique IDs</div>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={!!config.enable_tracking}
              onChange={(e) => onUpdateConfig({ enable_tracking: e.target.checked })}
            />
            <span className="slider-round" />
          </label>
        </div>

        {/* Target Class Filtering */}
        <div className="control-group">
          <div className="control-label">
            <span>Class Filter</span>
            <span className="control-value">
              {selectedClasses.length === 0 ? 'All 80' : `${selectedClasses.length} Selected`}
            </span>
          </div>

          <input
            type="text"
            className="class-search-input"
            placeholder="Search class (person, car, dog)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          {selectedClasses.length > 0 && (
            <button
              className="btn btn-secondary"
              style={{ padding: '4px 10px', fontSize: '0.75rem', marginBottom: '6px' }}
              onClick={handleClearClasses}
            >
              Reset Filters (Show All)
            </button>
          )}

          <div className="class-pills-container">
            {filteredClasses.map((cls) => {
              const isSelected = selectedClasses.includes(cls.name);
              return (
                <button
                  key={cls.id}
                  className={`class-pill ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleClassToggle(cls.name)}
                >
                  {cls.name}
                  {isSelected && <Check size={12} style={{ marginLeft: '4px' }} />}
                </button>
              );
            })}
          </div>
        </div>
      </aside>
    </>
  );
}
