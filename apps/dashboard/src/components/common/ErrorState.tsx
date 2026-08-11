import React from 'react';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  message = 'Failed to communicate with Traceo API server',
  onRetry
}) => {
  return (
    <div className="error-banner">
      <div>
        <strong>Error:</strong> {message}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            background: 'var(--accent-rose)',
            color: '#fff',
            padding: '6px 12px',
            borderRadius: '4px',
            fontWeight: 600,
            fontSize: 12
          }}
          type="button"
        >
          Retry
        </button>
      )}
    </div>
  );
};
