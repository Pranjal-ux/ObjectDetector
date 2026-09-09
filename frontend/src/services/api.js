/**
 * api.js
 * Frontend REST & WebSocket service manager connecting React UI to FastAPI server.
 */

const API_BASE_URL = 'http://localhost:8000';
const WS_BASE_URL = 'ws://localhost:8000';

export async function fetchHealth() {
  const res = await fetch(`${API_BASE_URL}/api/health`);
  if (!res.ok) throw new Error('Failed to fetch backend health status');
  return res.json();
}

export async function fetchModels() {
  const res = await fetch(`${API_BASE_URL}/api/models`);
  if (!res.ok) throw new Error('Failed to fetch model list');
  return res.json();
}

export async function fetchClasses() {
  const res = await fetch(`${API_BASE_URL}/api/classes`);
  if (!res.ok) throw new Error('Failed to fetch class registry');
  return res.json();
}

export async function fetchConfig() {
  const res = await fetch(`${API_BASE_URL}/api/config`);
  if (!res.ok) throw new Error('Failed to fetch active config');
  return res.json();
}

export async function updateConfig(configData) {
  const res = await fetch(`${API_BASE_URL}/api/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(configData)
  });
  if (!res.ok) throw new Error('Failed to update config');
  return res.json();
}

export async function detectImage(imageFile) {
  const formData = new FormData();
  formData.append('file', imageFile);

  const res = await fetch(`${API_BASE_URL}/api/detect`, {
    method: 'POST',
    body: formData
  });
  if (!res.ok) throw new Error('Image detection failed');
  return res.json();
}

export async function captureScreenshot(imageBase64) {
  const res = await fetch(`${API_BASE_URL}/api/screenshot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_base64: imageBase64 })
  });
  if (!res.ok) throw new Error('Failed to save screenshot');
  return res.json();
}

export async function fetchScreenshots() {
  const res = await fetch(`${API_BASE_URL}/api/screenshots`);
  if (!res.ok) throw new Error('Failed to fetch screenshots gallery');
  return res.json();
}

export function connectDetectionWebSocket(onPayload, onError, onClose) {
  const ws = new WebSocket(`${WS_BASE_URL}/ws/stream`);

  ws.onopen = () => {
    console.log('[WebSocket] Connection established to backend.');
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (onPayload) onPayload(data);
    } catch (e) {
      console.error('[WebSocket] Failed to parse payload:', e);
    }
  };

  ws.onerror = (err) => {
    console.error('[WebSocket] Error:', err);
    if (onError) onError(err);
  };

  ws.onclose = () => {
    console.log('[WebSocket] Connection closed.');
    if (onClose) onClose();
  };

  return ws;
}
