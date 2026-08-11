import React, { useEffect, useState } from 'react';
import type { TraceoDbQueryDetail } from '@traceo/dashboard-sdk';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorState } from '../components/common/ErrorState';
import { LoadingState } from '../components/common/LoadingState';
import { JsonViewer } from '../components/common/JsonViewer';
import { traceoClient } from '../services/api';

export const QueriesPage: React.FC = () => {
  const [queries, setQueries] = useState<TraceoDbQueryDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedQuery, setSelectedQuery] = useState<TraceoDbQueryDetail | null>(null);

  const fetchQueries = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await traceoClient.getQueries({ search: search || undefined });
      setQueries(res.data);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load database queries.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueries();
  }, [search]);

  const getOpBadgeStyle = (op: string) => {
    switch (op.toUpperCase()) {
      case 'SELECT':
        return { bg: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent-blue)', border: 'rgba(59, 130, 246, 0.3)' };
      case 'INSERT':
        return { bg: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-emerald)', border: 'rgba(16, 185, 129, 0.3)' };
      case 'UPDATE':
        return { bg: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-amber)', border: 'rgba(245, 158, 11, 0.3)' };
      case 'DELETE':
        return { bg: 'rgba(244, 63, 94, 0.15)', color: 'var(--accent-rose)', border: 'rgba(244, 63, 94, 0.3)' };
      default:
        return { bg: 'rgba(148, 163, 184, 0.15)', color: 'var(--text-secondary)', border: 'rgba(148, 163, 184, 0.3)' };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Database Query Observability</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Captured SQL queries, execution durations, row counts, and masked parameters.
          </p>
        </div>
        <button
          onClick={fetchQueries}
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
          placeholder="Filter queries by SQL text, operation, or trace ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 400 }}
        />
      </div>

      {loading ? (
        <LoadingState message="Loading database queries..." />
      ) : errorMsg ? (
        <ErrorState message={errorMsg} onRetry={fetchQueries} />
      ) : queries.length === 0 ? (
        <EmptyState title="No Database Queries Recorded" message="No query events matching your search criteria." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: selectedQuery ? '1fr 1fr' : '1fr', gap: 24 }}>
          <div className="table-container">
            <table className="traceo-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Operation</th>
                  <th>SQL Query</th>
                  <th>System</th>
                  <th>Duration</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {queries.map((item) => {
                  const style = getOpBadgeStyle(item.operation);
                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedQuery(item)}
                      style={{
                        cursor: 'pointer',
                        backgroundColor: selectedQuery?.id === item.id ? 'rgba(99, 102, 241, 0.1)' : undefined
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
                            border: `1px solid ${style.border}`
                          }}
                        >
                          {item.operation}
                        </span>
                      </td>
                      <td className="url-col" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                        {item.query}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.databaseSystem}</td>
                      <td className="duration-col">{item.durationMs.toFixed(2)} ms</td>
                      <td>
                        <span
                          style={{
                            color: item.success ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                            fontWeight: 600,
                            fontSize: 12
                          }}
                        >
                          {item.success ? 'OK' : 'ERROR'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {selectedQuery && (
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
                      ...getOpBadgeStyle(selectedQuery.operation)
                    }}
                  >
                    {selectedQuery.operation} ({selectedQuery.databaseSystem})
                  </span>
                  <h2 style={{ fontSize: 16, fontWeight: 700, margin: '8px 0 0 0', fontFamily: 'var(--font-mono)' }}>
                    Query Inspector
                  </h2>
                </div>
                <button
                  onClick={() => setSelectedQuery(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18 }}
                  type="button"
                >
                  ✕
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Duration:</span>{' '}
                  <strong>{selectedQuery.durationMs.toFixed(2)} ms</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Row Count:</span>{' '}
                  <strong>{selectedQuery.rowCount !== undefined && selectedQuery.rowCount !== null ? selectedQuery.rowCount : 'N/A'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Trace ID:</span>{' '}
                  <code style={{ fontFamily: 'var(--font-mono)' }}>{selectedQuery.traceId || 'N/A'}</code>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Request ID:</span>{' '}
                  <code style={{ fontFamily: 'var(--font-mono)' }}>{selectedQuery.requestId || 'N/A'}</code>
                </div>
              </div>

              <div>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  SQL Query Statement
                </span>
                <pre
                  style={{
                    backgroundColor: 'rgba(0,0,0,0.3)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    padding: 16,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    color: 'var(--accent-blue)',
                    overflowX: 'auto',
                    whiteSpace: 'pre-wrap',
                    marginTop: 6
                  }}
                >
                  {selectedQuery.query}
                </pre>
              </div>

              {selectedQuery.parameters && (
                <JsonViewer title="Masked Parameters" data={selectedQuery.parameters} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
