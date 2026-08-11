import React, { useEffect, useState } from 'react';
import { traceoClient } from '../services/api';
import { TraceoRequestDetail, TraceoTimeline } from '@traceo/dashboard-sdk';
import { HttpMethodBadge } from '../components/common/HttpMethodBadge';
import { StatusBadge } from '../components/common/StatusBadge';
import { JsonViewer } from '../components/common/JsonViewer';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';

interface RequestDetailPageProps {
  requestId: string;
  onBack: () => void;
}

export const RequestDetailPage: React.FC<RequestDetailPageProps> = ({ requestId, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<TraceoRequestDetail | null>(null);
  const [timeline, setTimeline] = useState<TraceoTimeline | null>(null);
  const [activeTab, setActiveTab] = useState<'request' | 'response' | 'timeline'>('request');

  const fetchDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await traceoClient.getRequestById(requestId);
      setDetail(res);
      if (res.traceId) {
        const timelineRes = await traceoClient.getTraceTimeline(res.traceId).catch(() => null);
        setTimeline(timelineRes);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch request details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [requestId]);

  if (loading) return <LoadingState message="Loading request details..." />;
  if (error || !detail) return <ErrorState message={error || 'Request not found'} onRetry={fetchDetail} />;

  const reqObj = detail.request || {};
  const resObj = detail.response || {};
  const payload = detail.payload || {};

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <button
          onClick={onBack}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--accent-blue)', fontWeight: 500 }}
          type="button"
        >
          ← Back to Requests
        </button>
      </div>

      <div className="detail-container">
        <div className="detail-header">
          <div className="detail-title">
            <HttpMethodBadge method={detail.method} />
            <span>{detail.url || detail.route || '/'}</span>
            <StatusBadge status={detail.statusCode} />
          </div>

          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {detail.durationMs !== undefined ? `${detail.durationMs} ms` : ''}
          </div>
        </div>

        <div className="meta-grid">
          <div className="meta-item">
            <span className="meta-label">Request ID</span>
            <span className="meta-val">{detail.requestId || detail.id}</span>
          </div>

          <div className="meta-item">
            <span className="meta-label">Trace ID</span>
            <span className="meta-val">{detail.traceId || '--'}</span>
          </div>

          <div className="meta-item">
            <span className="meta-label">Event Type</span>
            <span className="meta-val">{detail.eventType}</span>
          </div>

          <div className="meta-item">
            <span className="meta-label">Timestamp</span>
            <span className="meta-val">{new Date(detail.timestamp).toLocaleString()}</span>
          </div>
        </div>

        <div className="tab-nav">
          <button
            className={`tab-button ${activeTab === 'request' ? 'active' : ''}`}
            onClick={() => setActiveTab('request')}
            type="button"
          >
            Request
          </button>
          <button
            className={`tab-button ${activeTab === 'response' ? 'active' : ''}`}
            onClick={() => setActiveTab('response')}
            type="button"
          >
            Response
          </button>
          <button
            className={`tab-button ${activeTab === 'timeline' ? 'active' : ''}`}
            onClick={() => setActiveTab('timeline')}
            type="button"
          >
            Timeline ({timeline?.events.length || 1})
          </button>
        </div>

        {activeTab === 'request' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {reqObj.headers ? (
              <JsonViewer title="HTTP Headers" data={reqObj.headers} />
            ) : null}
            {reqObj.query ? (
              <JsonViewer title="Query Parameters" data={reqObj.query} />
            ) : null}
            {reqObj.cookies ? (
              <JsonViewer title="Cookies" data={reqObj.cookies} />
            ) : null}
            {payload.body !== undefined ? (
              <JsonViewer title="Request Body" data={payload.body} />
            ) : (
              <JsonViewer title="Full Request Metadata" data={reqObj} />
            )}
          </div>
        )}

        {activeTab === 'response' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {resObj.headers ? (
              <JsonViewer title="Response Headers" data={resObj.headers} />
            ) : null}
            {resObj.body !== undefined ? (
              <JsonViewer title="Response Body" data={resObj.body} />
            ) : (
              <JsonViewer title="Response Details" data={resObj} />
            )}
          </div>
        )}

        {activeTab === 'timeline' && (
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Trace Chronology</h3>
            {timeline?.events && timeline.events.length > 0 ? (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Event ID</th>
                      <th>Event Type</th>
                      <th>Method</th>
                      <th>Status</th>
                      <th>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timeline.events.map((evt) => (
                      <tr key={evt.id}>
                        <td className="time-cell">{evt.id}</td>
                        <td><span style={{ fontWeight: 600, color: 'var(--accent-blue)' }}>{evt.eventType}</span></td>
                        <td><HttpMethodBadge method={evt.method} /></td>
                        <td><StatusBadge status={evt.statusCode} /></td>
                        <td className="time-cell">{new Date(evt.timestamp).toISOString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">No related events found for this trace.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
