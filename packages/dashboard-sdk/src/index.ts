import type {
  TraceoListResponse,
  TraceoRequestDetail,
  TraceoRequestSummary,
  TraceoTimeline
} from '@traceo/server';

export type {
  TraceoListResponse,
  TraceoRequestDetail,
  TraceoRequestSummary,
  TraceoTimeline
};

export interface TraceoClientOptions {
  baseUrl?: string;
  fetch?: typeof fetch;
}

export interface RequestQueryOptions {
  page?: number;
  limit?: number;
  sort?: 'timestamp' | 'duration' | 'statusCode';
  order?: 'ASC' | 'DESC';
  method?: string;
  status?: number | string;
  eventType?: string;
  traceId?: string;
  requestId?: string;
  search?: string;
}

export class TraceoClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: TraceoClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? 'http://127.0.0.1:3030').replace(/\/+$/, '');
    this.fetchImpl = options.fetch ?? globalThis.fetch;
  }

  public async getHealth(): Promise<{ status: string }> {
    const res = await this.fetchImpl(`${this.baseUrl}/health`);
    if (!res.ok) {
      throw new Error(`Health check failed with status ${res.status}`);
    }
    return (await res.json()) as { status: string };
  }

  public async getRequests(query: RequestQueryOptions = {}): Promise<TraceoListResponse> {
    const url = new URL(`${this.baseUrl}/requests`);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }

    const res = await this.fetchImpl(url.toString());
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? `Failed to list requests with status ${res.status}`);
    }
    return (await res.json()) as TraceoListResponse;
  }

  public async getRequestById(id: string): Promise<TraceoRequestDetail> {
    const res = await this.fetchImpl(`${this.baseUrl}/requests/${encodeURIComponent(id)}`);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? `Failed to get request detail with status ${res.status}`);
    }
    return (await res.json()) as TraceoRequestDetail;
  }

  public async getTraceTimeline(traceId: string): Promise<TraceoTimeline> {
    const res = await this.fetchImpl(`${this.baseUrl}/requests/${encodeURIComponent(traceId)}/timeline`);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? `Failed to get trace timeline with status ${res.status}`);
    }
    return (await res.json()) as TraceoTimeline;
  }
}

export function createTraceoClient(options?: TraceoClientOptions): TraceoClient {
  return new TraceoClient(options);
}
