import React from 'react';

interface LoadingStateProps {
  message?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ message = 'Loading requests...' }) => {
  return (
    <div className="empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div className="loading-spinner"></div>
      <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{message}</div>
    </div>
  );
};
