import type {
  TraceoAuthEventDetail,
  TraceoAuthEventListResponse,
  TraceoCustomEventDetail,
  TraceoCustomEventListResponse,
  TraceoDbQueryDetail,
  TraceoDbQueryListResponse,
  TraceoErrorDetail,
  TraceoErrorListResponse,
  TraceoExternalApiDetail,
  TraceoExternalApiListResponse,
  TraceoListResponse,
  TraceoRequestDetail,
  TraceoRequestSummary,
  TraceoTimeline
} from '@traceo/server';

export type {
  TraceoAuthEventDetail,
  TraceoAuthEventListResponse,
  TraceoCustomEventDetail,
  TraceoCustomEventListResponse,
  TraceoDbQueryDetail,
  TraceoDbQueryListResponse,
  TraceoErrorDetail,
  TraceoErrorListResponse,
  TraceoExternalApiDetail,
  TraceoExternalApiListResponse,
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

  public async getErrors(query: RequestQueryOptions = {}): Promise<TraceoErrorListResponse> {
    const url = new URL(`${this.baseUrl}/errors`);
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
      const err = new Error(body.error ?? `Failed to list errors with status ${res.status}`);
      (err as unknown as { status: number }).status = res.status;
      throw err;
    }
    return (await res.json()) as TraceoErrorListResponse;
  }

  public async getErrorById(id: string): Promise<TraceoErrorDetail> {
    const res = await this.fetchImpl(`${this.baseUrl}/errors/${encodeURIComponent(id)}`, {
      headers: this.getHeaders()
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      const err = new Error(body.error ?? `Failed to get error detail with status ${res.status}`);
      (err as unknown as { status: number }).status = res.status;
      throw err;
    }
    return (await res.json()) as TraceoErrorDetail;
  }

  public async getQueries(query: RequestQueryOptions = {}): Promise<TraceoDbQueryListResponse> {
    const url = new URL(`${this.baseUrl}/queries`);
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
      const err = new Error(body.error ?? `Failed to list db queries with status ${res.status}`);
      (err as unknown as { status: number }).status = res.status;
      throw err;
    }
    return (await res.json()) as TraceoDbQueryListResponse;
  }

  public async getQueryById(id: string): Promise<TraceoDbQueryDetail> {
    const res = await this.fetchImpl(`${this.baseUrl}/queries/${encodeURIComponent(id)}`, {
      headers: this.getHeaders()
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      const err = new Error(body.error ?? `Failed to get db query detail with status ${res.status}`);
      (err as unknown as { status: number }).status = res.status;
    }
    return (await res.json()) as TraceoDbQueryDetail;
  }

  public async getExternalApis(query: RequestQueryOptions = {}): Promise<TraceoExternalApiListResponse> {
    const url = new URL(`${this.baseUrl}/external-apis`);
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
      const err = new Error(body.error ?? `Failed to list external APIs with status ${res.status}`);
      (err as unknown as { status: number }).status = res.status;
      throw err;
    }
    return (await res.json()) as TraceoExternalApiListResponse;
  }

  public async getExternalApiById(id: string): Promise<TraceoExternalApiDetail> {
    const res = await this.fetchImpl(`${this.baseUrl}/external-apis/${encodeURIComponent(id)}`, {
      headers: this.getHeaders()
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      const err = new Error(body.error ?? `Failed to get external API detail with status ${res.status}`);
      (err as unknown as { status: number }).status = res.status;
      throw err;
    }
    return (await res.json()) as TraceoExternalApiDetail;
  }

  public async getAuthEvents(query: RequestQueryOptions = {}): Promise<TraceoAuthEventListResponse> {
    const url = new URL(`${this.baseUrl}/auth-events`);
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
      const err = new Error(body.error ?? `Failed to list auth events with status ${res.status}`);
      (err as unknown as { status: number }).status = res.status;
      throw err;
    }
    return (await res.json()) as TraceoAuthEventListResponse;
  }

  public async getAuthEventById(id: string): Promise<TraceoAuthEventDetail> {
    const res = await this.fetchImpl(`${this.baseUrl}/auth-events/${encodeURIComponent(id)}`, {
      headers: this.getHeaders()
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      const err = new Error(body.error ?? `Failed to get auth event detail with status ${res.status}`);
      (err as unknown as { status: number }).status = res.status;
      throw err;
    }
    return (await res.json()) as TraceoAuthEventDetail;
  }

  public async sendCustomEvent(event: { type?: string; name: string; category?: string; payload?: Record<string, unknown>; requestId?: string; traceId?: string }): Promise<{ success: boolean; id: string }> {
    const res = await this.fetchImpl(`${this.baseUrl}/events`, {
      method: 'POST',
      headers: { ...this.getHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: event.type ?? 'CUSTOM',
        payload: {
          name: event.name,
          category: event.category ?? 'general',
          customPayload: event.payload ?? {},
          requestId: event.requestId ?? null,
          traceId: event.traceId ?? event.requestId ?? null
        }
      })
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      const err = new Error(body.error ?? `Failed to send custom event with status ${res.status}`);
      (err as unknown as { status: number }).status = res.status;
      throw err;
    }
    return (await res.json()) as { success: boolean; id: string };
  }

  public async getCustomEvents(query: RequestQueryOptions = {}): Promise<TraceoCustomEventListResponse> {
    const url = new URL(`${this.baseUrl}/custom-events`);
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
      const err = new Error(body.error ?? `Failed to list custom events with status ${res.status}`);
      (err as unknown as { status: number }).status = res.status;
      throw err;
    }
    return (await res.json()) as TraceoCustomEventListResponse;
  }

  public async getCustomEventById(id: string): Promise<TraceoCustomEventDetail> {
    const res = await this.fetchImpl(`${this.baseUrl}/custom-events/${encodeURIComponent(id)}`, {
      headers: this.getHeaders()
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      const err = new Error(body.error ?? `Failed to get custom event detail with status ${res.status}`);
      (err as unknown as { status: number }).status = res.status;
      throw err;
    }
    return (await res.json()) as TraceoCustomEventDetail;
  }
}

export function createTraceoClient(options?: TraceoClientOptions): TraceoClient {
  return new TraceoClient(options);
}
