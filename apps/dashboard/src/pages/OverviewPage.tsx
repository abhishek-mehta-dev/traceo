import React, { useEffect, useState } from 'react';
import { traceoClient } from '../services/api';
import { TraceoRequestSummary } from '@traceo/dashboard-sdk';
import { HttpMethodBadge } from '../components/common/HttpMethodBadge';
import { StatusBadge } from '../components/common/StatusBadge';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { EmptyState } from '../components/common/EmptyState';

interface OverviewPageProps {
  onSelectRequest: (id: string) => void;
  onNavigateToRequests: () => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({ onSelectRequest, onNavigateToRequests }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<TraceoRequestSummary[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  const fetchOverview = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await traceoClient.getRequests({ limit: 100 });
      setRequests(res.data || []);
      setTotalCount(res.pagination.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch overview metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  const stats = React.useMemo(() => {
    let success = 0;
    let errors = 0;
    let durationSum = 0;
    let durationCount = 0;

    for (const r of requests) {
      if (r.statusCode !== undefined) {
        if (r.statusCode >= 200 && r.statusCode < 300) {
          success++;
        } else if (r.statusCode >= 400) {
          errors++;
        }
      }
      if (typeof r.durationMs === 'number') {
        durationSum += r.durationMs;
        durationCount++;
      }
    }

    const avgDuration = durationCount > 0 ? Math.round(durationSum / durationCount) : 0;

    return { success, errors, avgDuration };
  }, [requests]);

  if (loading) return <LoadingState message="Loading overview telemetry..." />;
  if (error) return <ErrorState message={error} onRetry={fetchOverview} />;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Overview</h1>
        <p className="page-subtitle">Real-time HTTP request statistics and captured trace activity.</p>
      </div>

      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-title">Total Requests</div>
          <div className="metric-value">{totalCount}</div>
          <div className="metric-subtitle">Captured request events</div>
        </div>

        <div className="metric-card">
          <div className="metric-title">Successful (2xx)</div>
          <div className="metric-value" style={{ color: 'var(--accent-green)' }}>{stats.success}</div>
          <div className="metric-subtitle">2xx status responses</div>
        </div>

        <div className="metric-card">
          <div className="metric-title">Errors (4xx / 5xx)</div>
          <div className="metric-value" style={{ color: stats.errors > 0 ? 'var(--accent-rose)' : 'var(--text-muted)' }}>
            {stats.errors}
          </div>
          <div className="metric-subtitle">Client and server failures</div>
        </div>

        <div className="metric-card">
          <div className="metric-title">Avg Latency</div>
          <div className="metric-value" style={{ color: 'var(--accent-blue)' }}>
            {stats.avgDuration} <span style={{ fontSize: 16 }}>ms</span>
          </div>
          <div className="metric-subtitle">Average response duration</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>Recent Activity</h2>
        <button
          onClick={onNavigateToRequests}
          style={{ fontSize: 13, color: 'var(--accent-blue)', fontWeight: 500 }}
          type="button"
        >
          View all requests →
        </button>
      </div>

      {requests.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Method</th>
                <th>URL / Route</th>
                <th>Status</th>
                <th>Duration</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {requests.slice(0, 10).map((req) => (
                <tr key={req.id} className="clickable" onClick={() => onSelectRequest(req.id)}>
                  <td><HttpMethodBadge method={req.method} /></td>
                  <td className="url-cell">{req.url || req.route || '/'}</td>
                  <td><StatusBadge status={req.statusCode} /></td>
                  <td className="time-cell">{req.durationMs !== undefined ? `${req.durationMs} ms` : '--'}</td>
                  <td className="time-cell">{new Date(req.timestamp).toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
