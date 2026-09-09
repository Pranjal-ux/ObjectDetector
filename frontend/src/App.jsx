import React, { useEffect, useState } from 'react';
import Header from './components/Header';
import ControlPanel from './components/ControlPanel';
import LiveWebcamStudio from './components/LiveWebcamStudio';
import MediaUploader from './components/MediaUploader';
import ServerFeedView from './components/ServerFeedView';
import GalleryView from './components/GalleryView';
import AnalyticsHUD from './components/AnalyticsHUD';

import {
  fetchHealth,
  fetchModels,
  fetchClasses,
  fetchConfig,
  updateConfig
} from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('webcam');
  const [theme, setTheme] = useState('dark');
  const [healthStatus, setHealthStatus] = useState({ connected: false });
  const [models, setModels] = useState([]);
  const [classesList, setClassesList] = useState([]);
  const [config, setConfig] = useState({
    model_path: 'yolo26n.pt',
    conf_threshold: 0.35,
    iou_threshold: 0.45,
    enable_tracking: false,
    target_classes: []
  });
  const [loadingConfig, setLoadingConfig] = useState(false);

  // Toggle Theme (Dark / Light B&W)
  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  // Initialize App Data
  const initializeApp = async () => {
    try {
      const health = await fetchHealth();
      setHealthStatus({ connected: true, ...health });

      const modelsRes = await fetchModels();
      setModels(modelsRes.models || []);

      const classesRes = await fetchClasses();
      setClassesList(classesRes.classes || []);

      const cfgRes = await fetchConfig();
      setConfig(cfgRes);
    } catch (err) {
      console.error('[App] Backend connection failed:', err);
      setHealthStatus({ connected: false });
    }
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
    initializeApp();
    const interval = setInterval(initializeApp, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdateConfig = async (newParams) => {
    setLoadingConfig(true);
    try {
      const res = await updateConfig(newParams);
      setConfig(res.config);
    } catch (err) {
      console.error('Failed to update config:', err);
    } finally {
      setLoadingConfig(false);
    }
  };

  return (
    <div className="app-container">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        healthStatus={healthStatus}
        theme={theme}
        toggleTheme={toggleTheme}
      />

      <div className="main-layout">
        <ControlPanel
          models={models}
          classesList={classesList}
          config={config}
          onUpdateConfig={handleUpdateConfig}
          loading={loadingConfig}
        />

        <main className="stage-container">
          {activeTab === 'webcam' && (
            <LiveWebcamStudio config={config} />
          )}

          {activeTab === 'upload' && (
            <MediaUploader />
          )}

          {activeTab === 'server' && (
            <ServerFeedView config={config} />
          )}

          {activeTab === 'gallery' && (
            <GalleryView />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsHUD
              healthStatus={healthStatus}
              config={config}
              classesList={classesList}
            />
          )}
        </main>
      </div>
    </div>
  );
}
