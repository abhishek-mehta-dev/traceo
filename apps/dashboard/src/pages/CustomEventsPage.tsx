import React, { useEffect, useState } from 'react';
import type { TraceoCustomEventDetail } from '@traceo/dashboard-sdk';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorState } from '../components/common/ErrorState';
import { LoadingState } from '../components/common/LoadingState';
import { JsonViewer } from '../components/common/JsonViewer';
import { traceoClient } from '../services/api';

export const CustomEventsPage: React.FC = () => {
  const [items, setItems] = useState<TraceoCustomEventDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<TraceoCustomEventDetail | null>(null);

  const fetchCustomEvents = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await traceoClient.getCustomEvents({ search: search || undefined });
      setItems(res.data);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load custom events.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomEvents();
  }, [search]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Custom Developer Telemetry</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Captured custom developer events, categories, and arbitrary JSON payloads.
          </p>
        </div>
        <button
          onClick={fetchCustomEvents}
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
          placeholder="Filter custom events by name, category, or trace ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 400 }}
        />
      </div>

      {loading ? (
        <LoadingState message="Loading custom events..." />
      ) : errorMsg ? (
        <ErrorState message={errorMsg} onRetry={fetchCustomEvents} />
      ) : items.length === 0 ? (
        <EmptyState title="No Custom Events Recorded" message="No developer custom events ingested." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: selectedItem ? '1fr 1fr' : '1fr', gap: 24 }}>
          <div className="table-container">
            <table className="traceo-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Event Name</th>
                  <th>Category</th>
                  <th>Trace / Request ID</th>
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
                    <td style={{ fontWeight: 600, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
                      {item.name}
                    </td>
                    <td>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: 11,
                          fontWeight: 600,
                          backgroundColor: 'rgba(99, 102, 241, 0.15)',
                          color: 'var(--accent-primary)',
                          border: '1px solid rgba(99, 102, 241, 0.3)'
                        }}
                      >
                        {item.category}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      {item.traceId || item.requestId || 'N/A'}
                    </td>
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
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 11,
                      fontWeight: 600,
                      backgroundColor: 'rgba(99, 102, 241, 0.15)',
                      color: 'var(--accent-primary)',
                      border: '1px solid rgba(99, 102, 241, 0.3)'
                    }}
                  >
                    {selectedItem.category}
                  </span>
                  <h2 style={{ fontSize: 18, fontWeight: 700, margin: '8px 0 0 0', fontFamily: 'var(--font-mono)' }}>
                    {selectedItem.name}
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
                  <span style={{ color: 'var(--text-muted)' }}>Timestamp:</span>{' '}
                  <span>{new Date(selectedItem.timestamp).toLocaleString()}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Trace ID:</span>{' '}
                  <code style={{ fontFamily: 'var(--font-mono)' }}>{selectedItem.traceId || 'N/A'}</code>
                </div>
              </div>

              {selectedItem.customPayload && (
                <JsonViewer title="Custom Event Payload" data={selectedItem.customPayload} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
