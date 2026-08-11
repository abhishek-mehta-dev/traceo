import React from 'react';

interface EmptyStateProps {
  title?: string;
  description?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No requests captured yet',
  description = 'Start your Node.js Express application with Traceo middleware to view captured request traces here.'
}) => {
  return (
    <div className="empty-state">
      <div className="empty-title">{title}</div>
      <div style={{ fontSize: 13, maxWidth: 400, margin: '0 auto' }}>{description}</div>
    </div>
  );
};
