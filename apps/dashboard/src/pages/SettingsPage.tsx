import React from 'react';

export const SettingsPage: React.FC = () => {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Configure server options, data retention, and storage adapters.</p>
      </div>

      <div className="detail-container">
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Traceo Configuration</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>
          Configuration controls, project settings, alert rules, and retention policy management will be customizable in future releases.
        </p>

        <div className="meta-grid">
          <div className="meta-item">
            <span className="meta-label">Storage Engine</span>
            <span className="meta-val">SQLite (node:sqlite)</span>
          </div>

          <div className="meta-item">
            <span className="meta-label">Default Host</span>
            <span className="meta-val">127.0.0.1:3030</span>
          </div>

          <div className="meta-item">
            <span className="meta-label">Environment</span>
            <span className="meta-val">Development / Local</span>
          </div>
        </div>
      </div>
    </div>
  );
};
