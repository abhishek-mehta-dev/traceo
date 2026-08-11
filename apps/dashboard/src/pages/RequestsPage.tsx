import React, { useEffect, useState, useCallback } from 'react';
import { traceoClient } from '../services/api';
import { TraceoRequestSummary, PaginationMeta } from '@traceo/dashboard-sdk';
import { HttpMethodBadge } from '../components/common/HttpMethodBadge';
import { StatusBadge } from '../components/common/StatusBadge';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { EmptyState } from '../components/common/EmptyState';

interface RequestsPageProps {
  onSelectRequest: (id: string) => void;
}

export const RequestsPage: React.FC<RequestsPageProps> = ({ onSelectRequest }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<TraceoRequestSummary[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, limit: 25, total: 0, totalPages: 1 });

  // Filters & Sorting state initialized from URL search params
  const [method, setMethod] = useState(() => new URLSearchParams(window.location.search).get('method') || '');
  const [status, setStatus] = useState(() => new URLSearchParams(window.location.search).get('status') || '');
  const [eventType, setEventType] = useState(() => new URLSearchParams(window.location.search).get('eventType') || '');
  const [search, setSearch] = useState(() => new URLSearchParams(window.location.search).get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [sort, setSort] = useState<'timestamp' | 'duration' | 'statusCode'>(
    (new URLSearchParams(window.location.search).get('sort') as 'timestamp' | 'duration' | 'statusCode') || 'timestamp'
  );
  const [order, setOrder] = useState<'ASC' | 'DESC'>(
    (new URLSearchParams(window.location.search).get('order') as 'ASC' | 'DESC') || 'DESC'
  );
  const [page, setPage] = useState(() => Number(new URLSearchParams(window.location.search).get('page')) || 1);
  const [limit, setLimit] = useState(() => Number(new URLSearchParams(window.location.search).get('limit')) || 25);

  // Debounce search query input (300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Sync state to URL search parameters
  useEffect(() => {
    const params = new URLSearchParams();
    if (page > 1) params.set('page', String(page));
    if (limit !== 25) params.set('limit', String(limit));
    if (method) params.set('method', method);
    if (status) params.set('status', status);
    if (eventType) params.set('eventType', eventType);
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (sort !== 'timestamp') params.set('sort', sort);
    if (order !== 'DESC') params.set('order', order);

    const queryString = params.toString();
    const newUrl = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
  }, [page, limit, method, status, eventType, debouncedSearch, sort, order]);

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await traceoClient.getRequests({
        page,
        limit,
        method: method || undefined,
        status: status ? Number(status) : undefined,
        eventType: eventType || undefined,
        search: debouncedSearch || undefined,
        sort,
        order
      });
      setRequests(res.data || []);
      setPagination(res.pagination || { page, limit, total: 0, totalPages: 1 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  }, [page, limit, method, status, eventType, debouncedSearch, sort, order]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleFilterChange = (setter: (val: string) => void) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    setter(e.target.value);
    setPage(1); // Reset to page 1 on filter change
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Requests</h1>
        <p className="page-subtitle">Inspect captured HTTP requests, durations, status codes, and trace identifiers.</p>
      </div>

      <div className="filter-bar">
        <div className="search-box">
          <input
            className="search-input"
            type="text"
            placeholder="Search request path, ID, body..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <select className="select-input" value={method} onChange={handleFilterChange(setMethod)}>
          <option value="">All Methods</option>
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
          <option value="PATCH">PATCH</option>
        </select>

        <select className="select-input" value={status} onChange={handleFilterChange(setStatus)}>
          <option value="">All Statuses</option>
          <option value="200">200 OK</option>
          <option value="201">201 Created</option>
          <option value="400">400 Bad Request</option>
          <option value="404">404 Not Found</option>
          <option value="500">500 Server Error</option>
        </select>

        <select className="select-input" value={eventType} onChange={handleFilterChange(setEventType)}>
          <option value="">All Events</option>
          <option value="REQUEST_STARTED">REQUEST_STARTED</option>
          <option value="REQUEST_COMPLETED">REQUEST_COMPLETED</option>
        </select>

        <select
          className="select-input"
          value={sort}
          onChange={(e) => setSort(e.target.value as 'timestamp' | 'duration' | 'statusCode')}
        >
          <option value="timestamp">Sort: Time</option>
          <option value="duration">Sort: Duration</option>
          <option value="statusCode">Sort: Status Code</option>
        </select>

        <button
          className="btn-page"
          onClick={() => setOrder(order === 'ASC' ? 'DESC' : 'ASC')}
          type="button"
          title="Toggle Direction"
        >
          {order === 'ASC' ? '↑ ASC' : '↓ DESC'}
        </button>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={fetchRequests} />
      ) : loading ? (
        <LoadingState message="Fetching request list..." />
      ) : requests.length === 0 ? (
        <EmptyState
          title={debouncedSearch || method || status ? 'No matching requests' : 'No requests captured yet'}
          description={
            debouncedSearch || method || status
              ? 'Try adjusting your search criteria or clearing filters.'
              : 'Make HTTP requests against your application to populate this table.'
          }
        />
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Method</th>
                <th>URL / Route</th>
                <th>Status</th>
                <th>Duration</th>
                <th>Event Type</th>
                <th>Trace ID</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr key={req.id} className="clickable" onClick={() => onSelectRequest(req.id)}>
                  <td><HttpMethodBadge method={req.method} /></td>
                  <td className="url-cell">{req.url || req.route || '/'}</td>
                  <td><StatusBadge status={req.statusCode} /></td>
                  <td className="time-cell">{req.durationMs !== undefined ? `${req.durationMs} ms` : '--'}</td>
                  <td className="time-cell">{req.eventType}</td>
                  <td className="time-cell">{req.traceId ? `${req.traceId.slice(0, 12)}...` : '--'}</td>
                  <td className="time-cell">{new Date(req.timestamp).toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pagination-bar">
            <div>
              Showing page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong> ({pagination.total} total)
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <select
                className="select-input"
                style={{ padding: '4px 8px', fontSize: 12 }}
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
              >
                <option value="10">10 per page</option>
                <option value="25">25 per page</option>
                <option value="50">50 per page</option>
                <option value="100">100 per page</option>
              </select>

              <div className="pagination-buttons">
                <button
                  className="btn-page"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage(page - 1)}
                  type="button"
                >
                  ← Previous
                </button>
                <button
                  className="btn-page"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage(page + 1)}
                  type="button"
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
