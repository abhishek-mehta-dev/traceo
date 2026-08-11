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
    const leftSummary = toSummary(left);
    const rightSummary = toSummary(right);

    let leftVal: string | number = 0;
    let rightVal: string | number = 0;

    if (sortField === 'timestamp') {
      leftVal = leftSummary.timestamp;
      rightVal = rightSummary.timestamp;
    } else if (sortField === 'duration') {
      leftVal = leftSummary.durationMs ?? 0;
      rightVal = rightSummary.durationMs ?? 0;
    } else if (sortField === 'statusCode') {
      leftVal = leftSummary.statusCode ?? 0;
      rightVal = rightSummary.statusCode ?? 0;
    }

    if (leftVal < rightVal) {
      return direction === 'ASC' ? -1 : 1;
    }
    if (leftVal > rightVal) {
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

  public async listErrors(options: RequestListOptions = {}): Promise<import('./types').TraceoErrorListResponse> {
    const page = this.parsePage(options.page);
    const limit = this.parseLimit(options.limit);

    const query: TraceEventQuery = { type: 'ERROR' };
    if (options.search) query.search = options.search;
    if (options.traceId) query.traceId = options.traceId;
    if (options.requestId) query.requestId = options.requestId;

    let events = (await this.storage.query(query)) as Record<string, unknown>[];
    if (events.length === 0) {
      // Fallback check for lowercase 'error' type
      events = (await this.storage.query({ ...query, type: 'error' })) as Record<string, unknown>[];
    }

    const formatted = events.map((event) => {
      const payload = isRecord(event.payload) ? event.payload : {};
      return {
        id: String(event.id ?? ''),
        traceId: typeof payload.traceId === 'string' ? payload.traceId : undefined,
        requestId: typeof payload.requestId === 'string' ? payload.requestId : undefined,
        name: String(payload.name ?? 'Error'),
        message: String(payload.message ?? ''),
        stack: typeof payload.stack === 'string' ? payload.stack : undefined,
        route: typeof payload.route === 'string' ? payload.route : undefined,
        method: typeof payload.method === 'string' ? payload.method : undefined,
        statusCode: typeof payload.statusCode === 'number' ? payload.statusCode : 500,
        timestamp: String(event.timestamp ?? ''),
        metadata: isRecord(payload.metadata) ? payload.metadata : undefined,
        payload
      };
    });

    formatted.sort((a, b) => (a.timestamp > b.timestamp ? -1 : 1));

    const total = formatted.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const startIndex = (page - 1) * limit;
    const paged = formatted.slice(startIndex, startIndex + limit);

    return {
      data: paged,
      pagination: { page, limit, total, totalPages }
    };
  }

  public async getErrorById(id: string): Promise<import('./types').TraceoErrorDetail | undefined> {
    const event = (await this.storage.getById(id)) as Record<string, unknown> | undefined;
    if (!event) return undefined;
    const type = String(event.type ?? '').toUpperCase();
    if (type !== 'ERROR') return undefined;

    const payload = isRecord(event.payload) ? event.payload : {};
    return {
      id: String(event.id ?? ''),
      traceId: typeof payload.traceId === 'string' ? payload.traceId : undefined,
      requestId: typeof payload.requestId === 'string' ? payload.requestId : undefined,
      name: String(payload.name ?? 'Error'),
      message: String(payload.message ?? ''),
      stack: typeof payload.stack === 'string' ? payload.stack : undefined,
      route: typeof payload.route === 'string' ? payload.route : undefined,
      method: typeof payload.method === 'string' ? payload.method : undefined,
      statusCode: typeof payload.statusCode === 'number' ? payload.statusCode : 500,
      timestamp: String(event.timestamp ?? ''),
      metadata: isRecord(payload.metadata) ? payload.metadata : undefined,
      payload
    };
  }

  public async listQueries(options: RequestListOptions = {}): Promise<import('./types').TraceoDbQueryListResponse> {
    const page = this.parsePage(options.page);
    const limit = this.parseLimit(options.limit);

    const query: TraceEventQuery = { type: 'DB_QUERY' };
    if (options.search) query.search = options.search;
    if (options.traceId) query.traceId = options.traceId;
    if (options.requestId) query.requestId = options.requestId;

    let events = (await this.storage.query(query)) as Record<string, unknown>[];
    if (events.length === 0) {
      events = (await this.storage.query({ ...query, type: 'query' })) as Record<string, unknown>[];
    }

    const formatted = events.map((event) => {
      const payload = isRecord(event.payload) ? event.payload : {};
      return {
        id: String(event.id ?? ''),
        traceId: typeof payload.traceId === 'string' ? payload.traceId : undefined,
        requestId: typeof payload.requestId === 'string' ? payload.requestId : undefined,
        query: String(payload.query ?? ''),
        databaseSystem: String(payload.databaseSystem ?? 'sqlite'),
        operation: String(payload.operation ?? 'QUERY'),
        durationMs: typeof payload.durationMs === 'number' ? payload.durationMs : 0,
        parameters: (isRecord(payload.parameters) || Array.isArray(payload.parameters)) ? (payload.parameters as Record<string, unknown> | unknown[]) : undefined,
        rowCount: typeof payload.rowCount === 'number' ? payload.rowCount : undefined,
        success: typeof payload.success === 'boolean' ? payload.success : true,
        error: typeof payload.error === 'string' ? payload.error : undefined,
        timestamp: String(event.timestamp ?? ''),
        payload
      };
    });

    formatted.sort((a, b) => (a.timestamp > b.timestamp ? -1 : 1));

    const total = formatted.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const startIndex = (page - 1) * limit;
    const paged = formatted.slice(startIndex, startIndex + limit);

    return {
      data: paged,
      pagination: { page, limit, total, totalPages }
    };
  }

  public async getQueryById(id: string): Promise<import('./types').TraceoDbQueryDetail | undefined> {
    const event = (await this.storage.getById(id)) as Record<string, unknown> | undefined;
    if (!event) return undefined;
    const type = String(event.type ?? '').toUpperCase();
    if (type !== 'DB_QUERY' && type !== 'QUERY') return undefined;

    const payload = isRecord(event.payload) ? event.payload : {};
    return {
      id: String(event.id ?? ''),
      traceId: typeof payload.traceId === 'string' ? payload.traceId : undefined,
      requestId: typeof payload.requestId === 'string' ? payload.requestId : undefined,
      query: String(payload.query ?? ''),
      databaseSystem: String(payload.databaseSystem ?? 'sqlite'),
      operation: String(payload.operation ?? 'QUERY'),
      durationMs: typeof payload.durationMs === 'number' ? payload.durationMs : 0,
      parameters: (isRecord(payload.parameters) || Array.isArray(payload.parameters)) ? (payload.parameters as Record<string, unknown> | unknown[]) : undefined,
      rowCount: typeof payload.rowCount === 'number' ? payload.rowCount : undefined,
      success: typeof payload.success === 'boolean' ? payload.success : true,
      error: typeof payload.error === 'string' ? payload.error : undefined,
      timestamp: String(event.timestamp ?? ''),
      payload
    };
  }

  public async listExternalApis(options: RequestListOptions = {}): Promise<import('./types').TraceoExternalApiListResponse> {
    const page = this.parsePage(options.page);
    const limit = this.parseLimit(options.limit);

    const query: TraceEventQuery = { type: 'EXTERNAL_API' };
    if (options.search) query.search = options.search;
    if (options.traceId) query.traceId = options.traceId;
    if (options.requestId) query.requestId = options.requestId;

    let events = (await this.storage.query(query)) as Record<string, unknown>[];
    if (events.length === 0) {
      events = (await this.storage.query({ ...query, type: 'external' })) as Record<string, unknown>[];
    }

    const formatted = events.map((event) => {
      const payload = isRecord(event.payload) ? event.payload : {};
      return {
        id: String(event.id ?? ''),
        traceId: typeof payload.traceId === 'string' ? payload.traceId : undefined,
        requestId: typeof payload.requestId === 'string' ? payload.requestId : undefined,
        url: String(payload.url ?? ''),
        hostname: String(payload.hostname ?? 'unknown'),
        method: String(payload.method ?? 'GET'),
        statusCode: typeof payload.statusCode === 'number' ? payload.statusCode : 0,
        durationMs: typeof payload.durationMs === 'number' ? payload.durationMs : 0,
        success: typeof payload.success === 'boolean' ? payload.success : true,
        error: typeof payload.error === 'string' ? payload.error : undefined,
        requestHeaders: isRecord(payload.requestHeaders) ? payload.requestHeaders : undefined,
        responseHeaders: isRecord(payload.responseHeaders) ? payload.responseHeaders : undefined,
        timestamp: String(event.timestamp ?? ''),
        payload
      };
    });

    formatted.sort((a, b) => (a.timestamp > b.timestamp ? -1 : 1));

    const total = formatted.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const startIndex = (page - 1) * limit;
    const paged = formatted.slice(startIndex, startIndex + limit);

    return {
      data: paged,
      pagination: { page, limit, total, totalPages }
    };
  }

  public async getExternalApiById(id: string): Promise<import('./types').TraceoExternalApiDetail | undefined> {
    const event = (await this.storage.getById(id)) as Record<string, unknown> | undefined;
    if (!event) return undefined;
    const type = String(event.type ?? '').toUpperCase();
    if (type !== 'EXTERNAL_API' && type !== 'EXTERNAL') return undefined;

    const payload = isRecord(event.payload) ? event.payload : {};
    return {
      id: String(event.id ?? ''),
      traceId: typeof payload.traceId === 'string' ? payload.traceId : undefined,
      requestId: typeof payload.requestId === 'string' ? payload.requestId : undefined,
      url: String(payload.url ?? ''),
      hostname: String(payload.hostname ?? 'unknown'),
      method: String(payload.method ?? 'GET'),
      statusCode: typeof payload.statusCode === 'number' ? payload.statusCode : 0,
      durationMs: typeof payload.durationMs === 'number' ? payload.durationMs : 0,
      success: typeof payload.success === 'boolean' ? payload.success : true,
      error: typeof payload.error === 'string' ? payload.error : undefined,
      requestHeaders: isRecord(payload.requestHeaders) ? payload.requestHeaders : undefined,
      responseHeaders: isRecord(payload.responseHeaders) ? payload.responseHeaders : undefined,
      timestamp: String(event.timestamp ?? ''),
      payload
    };
  }

  public async listAuthEvents(options: RequestListOptions = {}): Promise<import('./types').TraceoAuthEventListResponse> {
    const page = this.parsePage(options.page);
    const limit = this.parseLimit(options.limit);

    const query: TraceEventQuery = { type: 'AUTH' };
    if (options.search) query.search = options.search;
    if (options.traceId) query.traceId = options.traceId;
    if (options.requestId) query.requestId = options.requestId;

    let events = (await this.storage.query(query)) as Record<string, unknown>[];
    if (events.length === 0) {
      events = (await this.storage.query({ ...query, type: 'auth' })) as Record<string, unknown>[];
    }

    const formatted = events.map((event) => {
      const payload = isRecord(event.payload) ? event.payload : {};
      return {
        id: String(event.id ?? ''),
        traceId: typeof payload.traceId === 'string' ? payload.traceId : undefined,
        requestId: typeof payload.requestId === 'string' ? payload.requestId : undefined,
        action: String(payload.action ?? 'auth_action'),
        userId: String(payload.userId ?? 'anonymous'),
        success: typeof payload.success === 'boolean' ? payload.success : true,
        error: typeof payload.error === 'string' ? payload.error : undefined,
        metadata: isRecord(payload.metadata) ? payload.metadata : undefined,
        timestamp: String(event.timestamp ?? ''),
        payload
      };
    });

    formatted.sort((a, b) => (a.timestamp > b.timestamp ? -1 : 1));

    const total = formatted.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const startIndex = (page - 1) * limit;
    const paged = formatted.slice(startIndex, startIndex + limit);

    return {
      data: paged,
      pagination: { page, limit, total, totalPages }
    };
  }

  public async getAuthEventById(id: string): Promise<import('./types').TraceoAuthEventDetail | undefined> {
    const event = (await this.storage.getById(id)) as Record<string, unknown> | undefined;
    if (!event) return undefined;
    const type = String(event.type ?? '').toUpperCase();
    if (type !== 'AUTH') return undefined;

    const payload = isRecord(event.payload) ? event.payload : {};
    return {
      id: String(event.id ?? ''),
      traceId: typeof payload.traceId === 'string' ? payload.traceId : undefined,
      requestId: typeof payload.requestId === 'string' ? payload.requestId : undefined,
      action: String(payload.action ?? 'auth_action'),
      userId: String(payload.userId ?? 'anonymous'),
      success: typeof payload.success === 'boolean' ? payload.success : true,
      error: typeof payload.error === 'string' ? payload.error : undefined,
      metadata: isRecord(payload.metadata) ? payload.metadata : undefined,
      timestamp: String(event.timestamp ?? ''),
      payload
    };
  }

  public async ingestEvent(rawEvent: Record<string, unknown>): Promise<{ success: boolean; id: string }> {
    if (!isRecord(rawEvent) || typeof rawEvent.type !== 'string') {
      throw new Error('Invalid trace event: type is required');
    }
    const event = {
      id: typeof rawEvent.id === 'string' ? rawEvent.id : `evt_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      type: String(rawEvent.type).toUpperCase(),
      timestamp: typeof rawEvent.timestamp === 'string' ? rawEvent.timestamp : new Date().toISOString(),
      source: typeof rawEvent.source === 'string' ? rawEvent.source : 'ingestion_api',
      payload: isRecord(rawEvent.payload) ? rawEvent.payload : {}
    };

    if (typeof this.storage.capture === 'function') {
      await this.storage.capture(event);
    }
    return { success: true, id: event.id };
  }

  public async listCustomEvents(options: RequestListOptions = {}): Promise<import('./types').TraceoCustomEventListResponse> {
    const page = this.parsePage(options.page);
    const limit = this.parseLimit(options.limit);

    const query: TraceEventQuery = { type: 'CUSTOM' };
    if (options.search) query.search = options.search;
    if (options.traceId) query.traceId = options.traceId;
    if (options.requestId) query.requestId = options.requestId;

    let events = (await this.storage.query(query)) as Record<string, unknown>[];
    if (events.length === 0) {
      events = (await this.storage.query({ ...query, type: 'custom' })) as Record<string, unknown>[];
    }

    const formatted = events.map((event) => {
      const payload = isRecord(event.payload) ? event.payload : {};
      return {
        id: String(event.id ?? ''),
        traceId: typeof payload.traceId === 'string' ? payload.traceId : undefined,
        requestId: typeof payload.requestId === 'string' ? payload.requestId : undefined,
        name: String(payload.name ?? 'custom_event'),
        category: String(payload.category ?? 'general'),
        customPayload: isRecord(payload.customPayload) ? payload.customPayload : undefined,
        timestamp: String(event.timestamp ?? ''),
        payload
      };
    });

    formatted.sort((a, b) => (a.timestamp > b.timestamp ? -1 : 1));

    const total = formatted.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const startIndex = (page - 1) * limit;
    const paged = formatted.slice(startIndex, startIndex + limit);

    return {
      data: paged,
      pagination: { page, limit, total, totalPages }
    };
  }

  public async getCustomEventById(id: string): Promise<import('./types').TraceoCustomEventDetail | undefined> {
    const event = (await this.storage.getById(id)) as Record<string, unknown> | undefined;
    if (!event) return undefined;
    const type = String(event.type ?? '').toUpperCase();
    if (type !== 'CUSTOM') return undefined;

    const payload = isRecord(event.payload) ? event.payload : {};
    return {
      id: String(event.id ?? ''),
      traceId: typeof payload.traceId === 'string' ? payload.traceId : undefined,
      requestId: typeof payload.requestId === 'string' ? payload.requestId : undefined,
      name: String(payload.name ?? 'custom_event'),
      category: String(payload.category ?? 'general'),
      customPayload: isRecord(payload.customPayload) ? payload.customPayload : undefined,
      timestamp: String(event.timestamp ?? ''),
      payload
    };
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
