import React, { useEffect, useState } from 'react';
import type { TraceoAuthEventDetail } from '@traceo/dashboard-sdk';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorState } from '../components/common/ErrorState';
import { LoadingState } from '../components/common/LoadingState';
import { JsonViewer } from '../components/common/JsonViewer';
import { traceoClient } from '../services/api';

export const AuthEventsPage: React.FC = () => {
  const [items, setItems] = useState<TraceoAuthEventDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<TraceoAuthEventDetail | null>(null);

  const fetchAuthEvents = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await traceoClient.getAuthEvents({ search: search || undefined });
      setItems(res.data);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load authentication events.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuthEvents();
  }, [search]);

  const getActionStyle = (action: string, success: boolean) => {
    if (!success || action.includes('failed')) {
      return { bg: 'rgba(244, 63, 94, 0.15)', color: 'var(--accent-rose)', border: 'rgba(244, 63, 94, 0.3)' };
    }
    if (action === 'login' || action === 'token_refresh') {
      return { bg: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-emerald)', border: 'rgba(16, 185, 129, 0.3)' };
    }
    return { bg: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent-blue)', border: 'rgba(59, 130, 246, 0.3)' };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Auth & Security Events</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Captured logins, failures, logout actions, user identifiers, and sanitized metadata.
          </p>
        </div>
        <button
          onClick={fetchAuthEvents}
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
          placeholder="Filter security events by action, user ID, or trace ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 400 }}
        />
      </div>

      {loading ? (
        <LoadingState message="Loading authentication events..." />
      ) : errorMsg ? (
        <ErrorState message={errorMsg} onRetry={fetchAuthEvents} />
      ) : items.length === 0 ? (
        <EmptyState title="No Security Events Recorded" message="No application authentication events found." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: selectedItem ? '1fr 1fr' : '1fr', gap: 24 }}>
          <div className="table-container">
            <table className="traceo-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>User Identifier</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const style = getActionStyle(item.action, item.success);
                  return (
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
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: 11,
                            fontWeight: 700,
                            backgroundColor: style.bg,
                            color: style.color,
                            border: `1px solid ${style.border}`,
                            textTransform: 'uppercase'
                          }}
                        >
                          {item.action}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--text-main)' }}>{item.userId}</td>
                      <td>
                        <span
                          style={{
                            color: item.success ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                            fontWeight: 600,
                            fontSize: 12
                          }}
                        >
                          {item.success ? 'SUCCESS' : 'FAILED'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
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
                  <span
                    style={{
                      padding: '3px 10px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      ...getActionStyle(selectedItem.action, selectedItem.success)
                    }}
                  >
                    {selectedItem.action}
                  </span>
                  <h2 style={{ fontSize: 18, fontWeight: 700, margin: '8px 0 0 0' }}>User: {selectedItem.userId}</h2>
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
                  <span style={{ color: 'var(--text-muted)' }}>Status:</span>{' '}
                  <strong>{selectedItem.success ? 'SUCCESS' : 'FAILED'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Timestamp:</span>{' '}
                  <span>{new Date(selectedItem.timestamp).toLocaleString()}</span>
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

              {selectedItem.error && (
                <div style={{ backgroundColor: 'rgba(244, 63, 94, 0.1)', padding: 12, borderRadius: 'var(--radius-md)', color: 'var(--accent-rose)', fontSize: 13 }}>
                  <strong>Error:</strong> {selectedItem.error}
                </div>
              )}

              {selectedItem.metadata && (
                <JsonViewer title="Sanitized Metadata" data={selectedItem.metadata} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
