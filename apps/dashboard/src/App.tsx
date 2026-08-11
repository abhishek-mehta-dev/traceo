import React, { useEffect, useState } from 'react';
import { AppShell } from './components/layout/AppShell';
import { DashboardView } from './components/layout/Sidebar';
import { OverviewPage } from './pages/OverviewPage';
import { RequestsPage } from './pages/RequestsPage';
import { RequestDetailPage } from './pages/RequestDetailPage';
import { SettingsPage } from './pages/SettingsPage';
import { traceoClient } from './services/api';

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<DashboardView>('overview');
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [serverOnline, setServerOnline] = useState(false);

  useEffect(() => {
    const checkServerHealth = async () => {
      try {
        await traceoClient.getHealth();
        setServerOnline(true);
      } catch {
        setServerOnline(false);
      }
    };

    checkServerHealth();
    const interval = setInterval(checkServerHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleSelectRequest = (id: string) => {
    setSelectedRequestId(id);
  };

  const handleBackToList = () => {
    setSelectedRequestId(null);
  };

  const handleSelectView = (view: DashboardView) => {
    setCurrentView(view);
    setSelectedRequestId(null);
  };

  return (
    <AppShell currentView={currentView} onSelectView={handleSelectView} serverOnline={serverOnline}>
      {selectedRequestId ? (
        <RequestDetailPage requestId={selectedRequestId} onBack={handleBackToList} />
      ) : (
        <>
          {currentView === 'overview' && (
            <OverviewPage
              onSelectRequest={handleSelectRequest}
              onNavigateToRequests={() => handleSelectView('requests')}
            />
          )}
          {currentView === 'requests' && (
            <RequestsPage onSelectRequest={handleSelectRequest} />
          )}
          {currentView === 'settings' && <SettingsPage />}
        </>
      )}
    </AppShell>
  );
};

export default App;
