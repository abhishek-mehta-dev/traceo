import type { IncomingMessage } from 'node:http';

export interface AuthResult {
  authenticated: boolean;
  principal?: { id: string; role?: string };
  reason?: string;
  statusCode?: number;
}

export interface TraceoAuthProvider {
  authenticate(req: IncomingMessage): Promise<AuthResult> | AuthResult;
}

export class BruteForceProtector {
  private failures = new Map<string, { count: number; expiresAt: number }>();
  private readonly maxFailures: number;
  private readonly windowMs: number;

  constructor(maxFailures = 5, windowMs = 60000) {
    this.maxFailures = maxFailures;
    this.windowMs = windowMs;
  }

  public isBlocked(ip: string): boolean {
    const record = this.failures.get(ip);
    if (!record) return false;
    if (Date.now() > record.expiresAt) {
      this.failures.delete(ip);
      return false;
    }
    return record.count >= this.maxFailures;
  }

  public recordFailure(ip: string): void {
    const now = Date.now();
    const record = this.failures.get(ip);
    if (!record || now > record.expiresAt) {
      this.failures.set(ip, { count: 1, expiresAt: now + this.windowMs });
    } else {
      record.count += 1;
    }
  }

  public recordSuccess(ip: string): void {
    this.failures.delete(ip);
  }
}

export class ApiKeyAuthProvider implements TraceoAuthProvider {
  private readonly protector: BruteForceProtector;

  constructor(private readonly validApiKey: string, protector?: BruteForceProtector) {
    this.protector = protector ?? new BruteForceProtector();
  }

  public authenticate(req: IncomingMessage): AuthResult {
    const ip = req.socket.remoteAddress || '127.0.0.1';

    if (this.protector.isBlocked(ip)) {
      return {
        authenticated: false,
        reason: 'Too many authentication failures. Temporary lockout.',
        statusCode: 429
      };
    }

    const authHeader = req.headers['authorization'];
    const apiKeyHeader = req.headers['x-traceo-api-key'];

    let providedKey: string | undefined;

    if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
      providedKey = authHeader.slice(7).trim();
    } else if (typeof apiKeyHeader === 'string') {
      providedKey = apiKeyHeader.trim();
    }

    if (providedKey && providedKey === this.validApiKey) {
      this.protector.recordSuccess(ip);
      return {
        authenticated: true,
        principal: { id: 'admin', role: 'admin' }
      };
    }

    this.protector.recordFailure(ip);
    return {
      authenticated: false,
      reason: 'Invalid API key',
      statusCode: 401
    };
  }
}

export class NoopAuthProvider implements TraceoAuthProvider {
  public authenticate(): AuthResult {
    return {
      authenticated: true,
      principal: { id: 'anonymous', role: 'viewer' }
    };
  }
}

export class DisabledAuthProvider implements TraceoAuthProvider {
  public authenticate(): AuthResult {
    return {
      authenticated: false,
      reason: 'Traceo dashboard API is disabled in this environment.',
      statusCode: 403
    };
  }
}
