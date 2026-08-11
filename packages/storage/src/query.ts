export interface TraceEventLike {
  id: string;
  type: string;
  timestamp: string;
  source: string;
  payload: Record<string, unknown>;
}

export interface TraceEventQuery {
  type?: string;
  requestId?: string;
  method?: string;
  statusCode?: number;
  source?: string;
  from?: string;
  to?: string;
  search?: string;
  limit?: number;
}

function normalizeSearchValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value.toLowerCase();
  return JSON.stringify(value).toLowerCase();
}

function timestampIsWithinRange(timestamp: string, query: TraceEventQuery): boolean {
  const eventTime = Date.parse(timestamp);
  if (query.from !== undefined && eventTime < Date.parse(query.from)) return false;
  if (query.to !== undefined && eventTime > Date.parse(query.to)) return false;
  return true;
}

export function queryTraceEvents(events: TraceEventLike[], query: TraceEventQuery = {}): TraceEventLike[] {
  const search = query.search?.toLowerCase().trim();
  const filtered = events.filter((event) => {
    const payload = event.payload as Record<string, unknown>;
    if (query.type !== undefined && event.type !== query.type) return false;
    if (query.source !== undefined && event.source !== query.source) return false;
    if (query.requestId !== undefined && payload.requestId !== query.requestId) return false;
    if (query.method !== undefined && payload.method !== query.method) return false;
    if (query.statusCode !== undefined && payload.statusCode !== query.statusCode) return false;
    if (!timestampIsWithinRange(event.timestamp, query)) return false;
    if (search !== undefined && search.length > 0) {
      const haystack = normalizeSearchValue({ id: event.id, type: event.type, source: event.source, payload: event.payload });
      return haystack.includes(search);
    }
    return true;
  });
  const sorted = filtered.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return query.limit !== undefined ? sorted.slice(0, query.limit) : sorted;
}
