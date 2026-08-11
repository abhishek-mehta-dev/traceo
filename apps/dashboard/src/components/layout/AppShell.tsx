import React from 'react';
import { Sidebar, DashboardView } from './Sidebar';

interface AppShellProps {
  currentView: DashboardView;
  onSelectView: (view: DashboardView) => void;
  serverOnline: boolean;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  currentView,
  onSelectView,
  serverOnline,
  children
}) => {
  return (
    <div className="app-container">
      <Sidebar currentView={currentView} onSelectView={onSelectView} serverOnline={serverOnline} />
      
      <div className="main-wrapper">
        <header className="app-header">
          <div className="header-title">
            {currentView === 'overview' && 'System Overview'}
            {currentView === 'requests' && 'Request Inspector'}
            {currentView === 'settings' && 'Traceo Configuration'}
          </div>

          <div className="header-badge">
            <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>Env:</span> Local / Development
          </div>
        </header>

        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
};
