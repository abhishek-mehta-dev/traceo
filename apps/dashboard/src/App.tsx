import React, { useEffect, useState } from 'react';
import { AppShell } from './components/layout/AppShell';
import { DashboardView } from './components/layout/Sidebar';
import { OverviewPage } from './pages/OverviewPage';
import { RequestsPage } from './pages/RequestsPage';
import { RequestDetailPage } from './pages/RequestDetailPage';
import { SettingsPage } from './pages/SettingsPage';
import { AuthModal } from './components/auth/AuthModal';
import { traceoClient } from './services/api';

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<DashboardView>('overview');
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [serverOnline, setServerOnline] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const checkHealthAndAuth = async () => {
    try {
      await traceoClient.getHealth();
      setServerOnline(true);
      try {
        await traceoClient.verifyAuth();
        setNeedsAuth(false);
      } catch (err: unknown) {
        const status = (err as { status?: number }).status;
        if (status === 401 || status === 403) {
          setNeedsAuth(true);
        }
      }
    } catch {
      setServerOnline(false);
    }
  };

  useEffect(() => {
    checkHealthAndAuth();
    const interval = setInterval(checkHealthAndAuth, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleAuthenticate = async (apiKey: string): Promise<boolean> => {
    try {
      traceoClient.setApiKey(apiKey);
      await traceoClient.verifyAuth();
      setNeedsAuth(false);
      setAuthError(null);
      return true;
    } catch (err) {
      traceoClient.clearApiKey();
      setNeedsAuth(true);
      setAuthError(err instanceof Error ? err.message : 'Authentication failed.');
      return false;
    }
  };

  const handleLock = () => {
    traceoClient.clearApiKey();
    setNeedsAuth(true);
  };

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
    <>
      {needsAuth && <AuthModal onAuthenticate={handleAuthenticate} errorMessage={authError} />}
      
      <AppShell
        currentView={currentView}
        onSelectView={handleSelectView}
        serverOnline={serverOnline}
        onLock={handleLock}
      >
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
    </>
  );
};

export default App;
