import React, { useEffect, useState } from 'react';
import type { TraceoErrorDetail } from '@traceo/dashboard-sdk';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorState } from '../components/common/ErrorState';
import { LoadingState } from '../components/common/LoadingState';
import { StackViewer } from '../components/common/StackViewer';
import { StatusBadge } from '../components/common/StatusBadge';
import { traceoClient } from '../services/api';

export const ErrorsPage: React.FC = () => {
  const [errors, setErrors] = useState<TraceoErrorDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedError, setSelectedError] = useState<TraceoErrorDetail | null>(null);

  const fetchErrors = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await traceoClient.getErrors({ search: search || undefined });
      setErrors(res.data);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load error events.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchErrors();
  }, [search]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Error Monitoring</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Captured application exceptions, stack traces, and HTTP error correlations.
          </p>
        </div>
        <button
          onClick={fetchErrors}
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
          placeholder="Filter errors by message, name, or route..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 400 }}
        />
      </div>

      {loading ? (
        <LoadingState message="Loading error events..." />
      ) : errorMsg ? (
        <ErrorState message={errorMsg} onRetry={fetchErrors} />
      ) : errors.length === 0 ? (
        <EmptyState title="No Errors Recorded" message="No application exceptions or error events found." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: selectedError ? '1fr 1fr' : '1fr', gap: 24 }}>
          <div className="table-container">
            <table className="traceo-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Error</th>
                  <th>Route / Source</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {errors.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedError(item)}
                    style={{
                      cursor: 'pointer',
                      backgroundColor: selectedError?.id === item.id ? 'rgba(99, 102, 241, 0.1)' : undefined
                    }}
                  >
                    <td className="timestamp-col">{new Date(item.timestamp).toLocaleTimeString()}</td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--accent-rose)' }}>{item.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 300 }}>
                        {item.message}
                      </div>
                    </td>
                    <td className="url-col">{item.route || item.method || 'Unknown'}</td>
                    <td>
                      <StatusBadge status={item.statusCode || 500} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedError && (
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
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-rose)', textTransform: 'uppercase' }}>
                    {selectedError.name}
                  </span>
                  <h2 style={{ fontSize: 18, fontWeight: 700, margin: '4px 0 0 0' }}>{selectedError.message}</h2>
                </div>
                <button
                  onClick={() => setSelectedError(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18 }}
                  type="button"
                >
                  ✕
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Status Code:</span>{' '}
                  <strong>{selectedError.statusCode || 500}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Route:</span>{' '}
                  <code style={{ fontFamily: 'var(--font-mono)' }}>{selectedError.route || 'N/A'}</code>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Trace ID:</span>{' '}
                  <code style={{ fontFamily: 'var(--font-mono)' }}>{selectedError.traceId || 'N/A'}</code>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Request ID:</span>{' '}
                  <code style={{ fontFamily: 'var(--font-mono)' }}>{selectedError.requestId || 'N/A'}</code>
                </div>
              </div>

              <StackViewer stack={selectedError.stack} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
