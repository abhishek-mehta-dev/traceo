import React from 'react';

interface StatusBadgeProps {
  status?: number;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  if (status === undefined || status === null) {
    return <span className="badge-status s2xx">--</span>;
  }

  let statusClass = 's2xx';
  if (status >= 500) {
    statusClass = 's5xx';
  } else if (status >= 400) {
    statusClass = 's4xx';
  } else if (status >= 300) {
    statusClass = 's3xx';
  }

  return (
    <span className={`badge-status ${statusClass}`}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'currentColor' }}></span>
      {status}
    </span>
  );
};
