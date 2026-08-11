import React from 'react';

export type DashboardView = 'overview' | 'requests' | 'settings';

interface SidebarProps {
  currentView: DashboardView;
  onSelectView: (view: DashboardView) => void;
  serverOnline: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onSelectView, serverOnline }) => {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo-mark">T</div>
        <div className="brand-name">TRACEO</div>
        <span className="version-tag">v0.1</span>
      </div>

      <nav className="nav-list">
        <div className="nav-item">
          <button
            className={currentView === 'overview' ? 'active' : ''}
            onClick={() => onSelectView('overview')}
            type="button"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
            </svg>
            Overview
          </button>
        </div>

        <div className="nav-item">
          <button
            className={currentView === 'requests' ? 'active' : ''}
            onClick={() => onSelectView('requests')}
            type="button"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            Requests
          </button>
        </div>

        <div className="nav-item">
          <button
            className={currentView === 'settings' ? 'active' : ''}
            onClick={() => onSelectView('settings')}
            type="button"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
            Settings
          </button>
        </div>
      </nav>

      <div className="sidebar-footer">
        <div className="server-status-pill">
          <span className={`status-dot ${serverOnline ? '' : 'offline'}`}></span>
          <span>{serverOnline ? 'Server Online' : 'Server Disconnected'}</span>
        </div>
      </div>
    </aside>
  );
};
