import React from 'react';

export type DashboardView = 'overview' | 'requests' | 'errors' | 'queries' | 'external' | 'auth' | 'custom' | 'settings';

interface SidebarProps {
  currentView: DashboardView;
  onSelectView: (view: DashboardView) => void;
  serverOnline: boolean;
  onLock?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onSelectView, serverOnline, onLock }) => {
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
            className={currentView === 'errors' ? 'active' : ''}
            onClick={() => onSelectView('errors')}
            type="button"
          >
            <svg width="16" height="16" fill="none" stroke="var(--accent-rose)" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            Errors
          </button>
        </div>

        <div className="nav-item">
          <button
            className={currentView === 'queries' ? 'active' : ''}
            onClick={() => onSelectView('queries')}
            type="button"
          >
            <svg width="16" height="16" fill="none" stroke="var(--accent-blue)" strokeWidth="2" viewBox="0 0 24 24">
              <ellipse cx="12" cy="5" rx="9" ry="3" />
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
            </svg>
            Queries
          </button>
        </div>

        <div className="nav-item">
          <button
            className={currentView === 'external' ? 'active' : ''}
            onClick={() => onSelectView('external')}
            type="button"
          >
            <svg width="16" height="16" fill="none" stroke="var(--accent-emerald)" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
            </svg>
            External APIs
          </button>
        </div>

        <div className="nav-item">
          <button
            className={currentView === 'auth' ? 'active' : ''}
            onClick={() => onSelectView('auth')}
            type="button"
          >
            <svg width="16" height="16" fill="none" stroke="var(--accent-amber)" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Auth Events
          </button>
        </div>

        <div className="nav-item">
          <button
            className={currentView === 'custom' ? 'active' : ''}
            onClick={() => onSelectView('custom')}
            type="button"
          >
            <svg width="16" height="16" fill="none" stroke="var(--accent-primary)" strokeWidth="2" viewBox="0 0 24 24">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            Custom Events
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
        <div className="server-status-pill" style={{ marginBottom: 8 }}>
          <span className={`status-dot ${serverOnline ? '' : 'offline'}`}></span>
          <span>{serverOnline ? 'Server Online' : 'Server Disconnected'}</span>
        </div>
        {onLock && (
          <button
            onClick={onLock}
            style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'underline' }}
            type="button"
          >
            Lock Dashboard
          </button>
        )}
      </div>
    </aside>
  );
};
