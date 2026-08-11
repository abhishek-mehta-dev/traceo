import type { TraceEventQuery } from '@traceo/storage';
import type { TraceoStorageLike, TraceoRequestDetail, TraceoRequestSummary, TraceoTimeline, TraceoListResponse } from './types';

export interface RequestListOptions {
  page?: number;
  limit?: number;
  sort?: string;
  order?: string;
  method?: string;
  status?: string;
  statusCode?: number;
  eventType?: string;
  traceId?: string;
  requestId?: string;
  search?: string;
}

const ALLOWED_SORT_FIELDS = new Set(['timestamp', 'duration', 'statusCode']);
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeStatusCode(status: string | undefined, statusCode?: number): number | undefined {
  if (statusCode !== undefined) {
    return statusCode;
  }

  if (status === undefined) {
    return undefined;
  }

  const parsed = Number(status);
  return Number.isInteger(parsed) ? parsed : undefined;
}

function toSummary(event: Record<string, unknown>): TraceoRequestSummary {
  const payload = isRecord(event.payload) ? event.payload : {};
  const request = isRecord(payload.request) ? payload.request : {};
  const response = isRecord(payload.response) ? payload.response : {};
  const statusCode = typeof response.statusCode === 'number' ? response.statusCode : undefined;
  const durationMs = typeof response.durationMs === 'number' ? response.durationMs : undefined;

  return {
    id: String(event.id ?? ''),
    traceId: String(payload.traceId ?? ''),
    requestId: String(payload.requestId ?? ''),
    eventType: String(event.type ?? ''),
    method: String(request.method ?? ''),
    url: String(request.url ?? ''),
    statusCode,
    durationMs,
    timestamp: String(event.timestamp ?? ''),
    route: typeof request.route === 'string' ? request.route : undefined
  };
}

function toDetail(event: Record<string, unknown>): TraceoRequestDetail {
  const payload = isRecord(event.payload) ? event.payload : {};
  const request = isRecord(payload.request) ? payload.request : {};
  const response = isRecord(payload.response) ? payload.response : {};
  const base = toSummary(event);

  return {
    ...base,
    request: request as Record<string, unknown>,
    response: response as Record<string, unknown>,
    payload
  };
}

function resolveSort(sort: string | undefined, order: string | undefined): { sort: string; order: 'ASC' | 'DESC' } {
  const normalizedSort = sort?.trim().toLowerCase();
  const normalizedOrder = order?.trim().toUpperCase();

  if (normalizedSort !== undefined && !ALLOWED_SORT_FIELDS.has(normalizedSort)) {
    throw new Error('invalid sort');
  }

  const sortField = normalizedSort ?? 'timestamp';
  const direction = normalizedOrder === 'ASC' ? 'ASC' : 'DESC';
  return { sort: sortField, order: direction };
}

function applySorting(events: Record<string, unknown>[], sortField: string, direction: 'ASC' | 'DESC'): Record<string, unknown>[] {
  return [...events].sort((left, right) => {
    const leftValue = left[sortField] as Record<string, unknown> | undefined;
    const rightValue = right[sortField] as Record<string, unknown> | undefined;
    const leftComparable = sortField === 'timestamp' ? String(leftValue ?? '') : Number(leftValue ?? 0);
    const rightComparable = sortField === 'timestamp' ? String(rightValue ?? '') : Number(rightValue ?? 0);

    if (leftComparable < rightComparable) {
      return direction === 'ASC' ? -1 : 1;
    }
    if (leftComparable > rightComparable) {
      return direction === 'ASC' ? 1 : -1;
    }
    return 0;
  });
}

export class RequestService {
  constructor(private readonly storage: TraceoStorageLike) {}

  public async list(options: RequestListOptions = {}): Promise<TraceoListResponse> {
    const page = this.parsePage(options.page);
    const limit = this.parseLimit(options.limit);
    const { sort, order } = resolveSort(options.sort, options.order);

    const query = this.buildQuery(options);
    let events = (await this.storage.query(query)) as Record<string, unknown>[];

    events = applySorting(events, sort, order);

    const total = events.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const startIndex = (page - 1) * limit;
    const paged = events.slice(startIndex, startIndex + limit);

    return {
      data: paged.map((event) => toSummary(event)),
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    };
  }

  public async getById(id: string): Promise<TraceoRequestDetail | undefined> {
    const event = (await this.storage.getById(id)) as Record<string, unknown> | undefined;
    return event ? toDetail(event) : undefined;
  }

  public async getTimeline(traceId: string): Promise<TraceoTimeline> {
    const events = (await this.storage.query({ traceId })) as Record<string, unknown>[];
    return {
      traceId,
      events: events.map((event) => toDetail(event))
    };
  }

  private buildQuery(options: RequestListOptions): TraceEventQuery {
    const statusCode = normalizeStatusCode(options.status, options.statusCode);
    const query: TraceEventQuery = {};

    if (options.method) {
      query.method = options.method;
    }

    if (statusCode !== undefined) {
      query.statusCode = statusCode;
    }

    if (options.eventType) {
      query.type = options.eventType;
    }

    if (options.traceId) {
      query.traceId = options.traceId;
    }

    if (options.requestId) {
      query.requestId = options.requestId;
    }

    if (options.search) {
      query.search = options.search;
    }

    return query;
  }

  private parsePage(value: number | undefined): number {
    const parsed = value ?? DEFAULT_PAGE;
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new Error('invalid page');
    }
    return parsed;
  }

  private parseLimit(value: number | undefined): number {
    const parsed = value ?? DEFAULT_LIMIT;
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new Error('invalid limit');
    }
    if (parsed > MAX_LIMIT) {
      throw new Error('invalid limit');
    }
    return parsed;
  }
}
