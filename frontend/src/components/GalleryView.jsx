import React, { useEffect, useState } from 'react';
import { Images, Download, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { fetchScreenshots } from '../services/api';

export default function GalleryView() {
  const [screenshots, setScreenshots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedImg, setSelectedImg] = useState(null);

  const loadGallery = async () => {
    setLoading(true);
    try {
      const data = await fetchScreenshots();
      setScreenshots(data.screenshots || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGallery();
  }, []);

  return (
    <div className="studio-card">
      <div className="studio-card-header">
        <div className="studio-card-title">
          <Images color="#00f2fe" size={20} />
          <span>Screenshot Gallery ({screenshots.length})</span>
        </div>


        <button className="btn btn-secondary" onClick={loadGallery} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>Refresh Gallery</span>
        </button>
      </div>

      {screenshots.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-dim)' }}>
          <ImageIcon size={48} style={{ marginBottom: '12px', opacity: 0.5 }} />
          <p>No saved screenshots found in backend directory.</p>
          <p style={{ fontSize: '0.82rem', marginTop: '4px' }}>
            Click "Snapshot" in the Live Studio to capture annotated detection frames!
          </p>
        </div>
      ) : (
        <div className="gallery-grid">
          {screenshots.map((s) => {
            const imgUrl = `http://localhost:8000${s.url}`;
            return (
              <div key={s.filename} className="gallery-card">
                <img
                  src={imgUrl}
                  alt={s.filename}
                  className="gallery-img"
                  onClick={() => setSelectedImg(imgUrl)}
                  style={{ cursor: 'pointer' }}
                />
                <div className="gallery-meta">
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
                    {s.filename}
                  </span>
                  <a
                    href={imgUrl}
                    download={s.filename}
                    className="btn btn-secondary"
                    style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  >
                    <Download size={12} />
                    <span>Download</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox Modal */}
      {selectedImg && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => setSelectedImg(null)}
        >
          <img
            src={selectedImg}
            alt="Full Preview"
            style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '12px', boxShadow: '0 0 30px rgba(0,0,0,0.8)' }}
          />
        </div>
      )}
    </div>
  );
}
