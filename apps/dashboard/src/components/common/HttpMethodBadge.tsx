import React from 'react';

interface HttpMethodBadgeProps {
  method: string;
}

export const HttpMethodBadge: React.FC<HttpMethodBadgeProps> = ({ method }) => {
  const normalized = (method || 'GET').toUpperCase();
  const lower = normalized.toLowerCase();

  return (
    <span className={`badge-method ${lower}`}>
      {normalized}
    </span>
  );
};
