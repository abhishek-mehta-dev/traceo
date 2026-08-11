import React, { useState } from 'react';

interface JsonViewerProps {
  data: unknown;
  title?: string;
}

export const JsonViewer: React.FC<JsonViewerProps> = ({ data, title }) => {
  const [copied, setCopied] = useState(false);

  const formattedJson = React.useMemo(() => {
    if (data === undefined) return 'undefined';
    if (data === null) return 'null';
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return JSON.stringify(data);
      }
    }
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return '[Unserializable Payload]';
    }
  }, [data]);

  const handleCopy = () => {
    navigator.clipboard.writeText(formattedJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="json-viewer">
      {title && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>{title}</div>}
      <button className="json-copy-btn" onClick={handleCopy} type="button">
        {copied ? 'Copied!' : 'Copy'}
      </button>
      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
        <code>{formattedJson}</code>
      </pre>
    </div>
  );
};
