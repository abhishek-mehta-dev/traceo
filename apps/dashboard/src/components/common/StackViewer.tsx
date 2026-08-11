import React, { useState } from 'react';

interface StackViewerProps {
  stack?: string;
}

export const StackViewer: React.FC<StackViewerProps> = ({ stack }) => {
  const [copied, setCopied] = useState(false);

  if (!stack) {
    return <div style={{ color: 'var(--text-muted)', fontSize: 13, fontStyle: 'italic' }}>No stack trace available.</div>;
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(stack);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = stack.split('\n');

  return (
    <div className="json-viewer-container" style={{ marginTop: 8 }}>
      <div className="json-viewer-header">
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Stack Trace</span>
        <button className="copy-btn" onClick={handleCopy} type="button">
          {copied ? 'Copied!' : 'Copy Stack'}
        </button>
      </div>
      <pre
        style={{
          padding: 16,
          margin: 0,
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          lineHeight: 1.6,
          color: 'var(--accent-rose)',
          overflowX: 'auto',
          whiteSpace: 'pre-wrap'
        }}
      >
        {lines.map((line, idx) => {
          const isAtLine = line.trim().startsWith('at ');
          return (
            <div
              key={idx}
              style={{
                color: isAtLine ? 'var(--text-secondary)' : 'var(--accent-rose)',
                fontWeight: isAtLine ? 400 : 600
              }}
            >
              {line}
            </div>
          );
        })}
      </pre>
    </div>
  );
};
