import React from 'react';
import { Camera, Video, Image, Images, Activity, Cpu, Sun, Moon, Layers } from 'lucide-react';

export default function Header({ activeTab, setActiveTab, healthStatus, theme, toggleTheme }) {
  return (
    <header className="app-header">
      <div className="brand-logo">
        <div className="brand-icon-box">
          <Layers size={20} />
        </div>
        <span>Vizo</span>
        <span className="brand-badge">Real-Time AI</span>
      </div>

      <nav className="nav-tabs">
        <button
          className={`tab-btn ${activeTab === 'webcam' ? 'active' : ''}`}
          onClick={() => setActiveTab('webcam')}
        >
          <Camera size={16} />
          <span>Live Studio</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'upload' ? 'active' : ''}`}
          onClick={() => setActiveTab('upload')}
        >
          <Image size={16} />
          <span>Upload Media</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'server' ? 'active' : ''}`}
          onClick={() => setActiveTab('server')}
        >
          <Video size={16} />
          <span>Server Feed</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'gallery' ? 'active' : ''}`}
          onClick={() => setActiveTab('gallery')}
        >
          <Images size={16} />
          <span>Gallery</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          <Activity size={16} />
          <span>Telemetry</span>
        </button>
      </nav>

      <div className="header-controls">
        <button
          className="theme-toggle-btn"
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Theme`}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <div className="status-indicator">
          <div className={`status-dot ${healthStatus.connected ? '' : 'offline'}`} />
          <span>{healthStatus.connected ? 'API Online' : 'Offline'}</span>
        </div>

        {healthStatus.connected && (
          <div className="hardware-tag">
            <Cpu size={14} />
            <span>{healthStatus.device || 'CPU'}</span>
          </div>
        )}
      </div>
    </header>
  );
}
