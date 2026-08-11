import React, { useEffect, useState } from 'react';
import type { TraceoExternalApiDetail } from '@traceo/dashboard-sdk';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorState } from '../components/common/ErrorState';
import { LoadingState } from '../components/common/LoadingState';
import { JsonViewer } from '../components/common/JsonViewer';
import { HttpMethodBadge } from '../components/common/HttpMethodBadge';
import { StatusBadge } from '../components/common/StatusBadge';
import { traceoClient } from '../services/api';

export const ExternalApisPage: React.FC = () => {
  const [items, setItems] = useState<TraceoExternalApiDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<TraceoExternalApiDetail | null>(null);

  const fetchExternalApis = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await traceoClient.getExternalApis({ search: search || undefined });
      setItems(res.data);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load external API telemetry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExternalApis();
  }, [search]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>External API Tracing</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Captured outgoing HTTP calls, service hostnames, latency, and sanitized headers.
          </p>
        </div>
        <button
          onClick={fetchExternalApis}
          style={{
            padding: '8px 16px',
            backgroundColor: 'var(--bg-panel)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-main)',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            fontWeight: 500
          }}
          type="button"
        >
          Refresh
        </button>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <input
          type="text"
          className="search-input"
          placeholder="Filter external calls by URL, hostname, or method..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 400 }}
        />
      </div>

      {loading ? (
        <LoadingState message="Loading external API events..." />
      ) : errorMsg ? (
        <ErrorState message={errorMsg} onRetry={fetchExternalApis} />
      ) : items.length === 0 ? (
        <EmptyState title="No External API Calls Recorded" message="No outgoing HTTP request events found." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: selectedItem ? '1fr 1fr' : '1fr', gap: 24 }}>
          <div className="table-container">
            <table className="traceo-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Method</th>
                  <th>Hostname / Target URL</th>
                  <th>Status</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    style={{
                      cursor: 'pointer',
                      backgroundColor: selectedItem?.id === item.id ? 'rgba(99, 102, 241, 0.1)' : undefined
                    }}
                  >
                    <td className="timestamp-col">{new Date(item.timestamp).toLocaleTimeString()}</td>
                    <td>
                      <HttpMethodBadge method={item.method} />
                    </td>
                    <td className="url-col">
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{item.hostname}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 300, fontFamily: 'var(--font-mono)' }}>
                        {item.url}
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={item.statusCode || 500} />
                    </td>
                    <td className="duration-col">{item.durationMs.toFixed(2)} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedItem && (
            <div
              style={{
                backgroundColor: 'var(--bg-panel)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-lg)',
                padding: 24,
                display: 'flex',
                flexDirection: 'column',
                gap: 16
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <HttpMethodBadge method={selectedItem.method} />
                    <StatusBadge status={selectedItem.statusCode || 500} />
                  </div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, wordBreak: 'break-all', fontFamily: 'var(--font-mono)' }}>
                    {selectedItem.url}
                  </h2>
                </div>
                <button
                  onClick={() => setSelectedItem(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18 }}
                  type="button"
                >
                  ✕
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Target Host:</span>{' '}
                  <strong>{selectedItem.hostname}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Duration:</span>{' '}
                  <strong>{selectedItem.durationMs.toFixed(2)} ms</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Trace ID:</span>{' '}
                  <code style={{ fontFamily: 'var(--font-mono)' }}>{selectedItem.traceId || 'N/A'}</code>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Request ID:</span>{' '}
                  <code style={{ fontFamily: 'var(--font-mono)' }}>{selectedItem.requestId || 'N/A'}</code>
                </div>
              </div>

              {selectedItem.requestHeaders && (
                <JsonViewer title="Sanitized Request Headers" data={selectedItem.requestHeaders} />
              )}

              {selectedItem.responseHeaders && (
                <JsonViewer title="Response Headers" data={selectedItem.responseHeaders} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
