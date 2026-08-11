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
  apiKey?: string;
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
  private apiKey: string | undefined;
  private readonly fetchImpl: typeof fetch;

  constructor(options: TraceoClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? 'http://127.0.0.1:3030').replace(/\/+$/, '');
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetch ?? globalThis.fetch;
  }

  public setApiKey(key: string): void {
    this.apiKey = key;
  }

  public clearApiKey(): void {
    this.apiKey = undefined;
  }

  private getHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = { ...extraHeaders };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  public async getHealth(): Promise<{ status: string }> {
    const res = await this.fetchImpl(`${this.baseUrl}/health`);
    if (!res.ok) {
      throw new Error(`Health check failed with status ${res.status}`);
    }
    return (await res.json()) as { status: string };
  }

  public async verifyAuth(): Promise<{ authenticated: boolean; principal?: { id: string; role?: string } }> {
    const res = await this.fetchImpl(`${this.baseUrl}/auth/verify`, {
      method: 'POST',
      headers: this.getHeaders()
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string; details?: string };
      throw new Error(body.details || body.error || `Authentication failed with status ${res.status}`);
    }

    return (await res.json()) as { authenticated: boolean; principal?: { id: string; role?: string } };
  }

  public async getRequests(query: RequestQueryOptions = {}): Promise<TraceoListResponse> {
    const url = new URL(`${this.baseUrl}/requests`);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }

    const res = await this.fetchImpl(url.toString(), {
      headers: this.getHeaders()
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      const err = new Error(body.error ?? `Failed to list requests with status ${res.status}`);
      (err as unknown as { status: number }).status = res.status;
      throw err;
    }
    return (await res.json()) as TraceoListResponse;
  }

  public async getRequestById(id: string): Promise<TraceoRequestDetail> {
    const res = await this.fetchImpl(`${this.baseUrl}/requests/${encodeURIComponent(id)}`, {
      headers: this.getHeaders()
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      const err = new Error(body.error ?? `Failed to get request detail with status ${res.status}`);
      (err as unknown as { status: number }).status = res.status;
      throw err;
    }
    return (await res.json()) as TraceoRequestDetail;
  }

  public async getTraceTimeline(traceId: string): Promise<TraceoTimeline> {
    const res = await this.fetchImpl(`${this.baseUrl}/requests/${encodeURIComponent(traceId)}/timeline`, {
      headers: this.getHeaders()
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      const err = new Error(body.error ?? `Failed to get trace timeline with status ${res.status}`);
      (err as unknown as { status: number }).status = res.status;
      throw err;
    }
    return (await res.json()) as TraceoTimeline;
  }
}

export function createTraceoClient(options?: TraceoClientOptions): TraceoClient {
  return new TraceoClient(options);
}
