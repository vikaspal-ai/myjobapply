import { sql } from '../db/index.js';
import type {
  CircuitBreakerOptions,
  CircuitState,
  RobotsComplianceStatus,
} from './types.js';

const db = sql!;

/**
 * In-memory domain-level rate limiter enforcing polite crawling intervals.
 */
export class DomainRateLimiter {
  private lastRequestTimes = new Map<string, number>();
  private defaultMinIntervalMs: number;

  constructor(defaultMinIntervalMs: number = 500) {
    this.defaultMinIntervalMs = defaultMinIntervalMs;
  }

  /**
   * Waits if necessary to ensure the minimum interval between requests to the given domain has elapsed.
   */
  async acquire(domain: string, minIntervalMs?: number): Promise<void> {
    const interval = minIntervalMs ?? this.defaultMinIntervalMs;
    const now = Date.now();
    const last = this.lastRequestTimes.get(domain) ?? 0;
    const elapsed = now - last;

    if (elapsed < interval) {
      const waitTime = interval - elapsed;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastRequestTimes.set(domain, Date.now());
  }

  /**
   * Checks whether an immediate request can be made without waiting.
   */
  canRequest(domain: string, minIntervalMs?: number): boolean {
    const interval = minIntervalMs ?? this.defaultMinIntervalMs;
    const last = this.lastRequestTimes.get(domain) ?? 0;
    return Date.now() - last >= interval;
  }

  /**
   * Resets rate limiter memory.
   */
  reset(domain?: string): void {
    if (domain) {
      this.lastRequestTimes.delete(domain);
    } else {
      this.lastRequestTimes.clear();
    }
  }
}

/**
 * Circuit breaker protecting scrapers from hammering failing or rate-limited endpoints.
 */
export class CircuitBreaker {
  private failureThreshold: number;
  private cooldownPeriodMs: number;
  private states = new Map<
    string,
    {
      state: CircuitState;
      failureCount: number;
      lastFailureTime: number;
      lastSuccessTime: number;
    }
  >();

  constructor(options?: CircuitBreakerOptions) {
    this.failureThreshold = options?.failureThreshold ?? 3;
    this.cooldownPeriodMs = options?.cooldownPeriodMs ?? 10000; // 10 seconds default
  }

  getState(domain: string): CircuitState {
    const entry = this.states.get(domain);
    if (!entry) return 'CLOSED';

    if (entry.state === 'OPEN') {
      const now = Date.now();
      if (now - entry.lastFailureTime >= this.cooldownPeriodMs) {
        entry.state = 'HALF_OPEN';
      }
    }

    return entry.state;
  }

  recordSuccess(domain: string): void {
    const entry = this.states.get(domain);
    if (entry) {
      entry.state = 'CLOSED';
      entry.failureCount = 0;
      entry.lastSuccessTime = Date.now();
    }
  }

  recordFailure(domain: string, statusCode?: number): void {
    let entry = this.states.get(domain);
    if (!entry) {
      entry = {
        state: 'CLOSED',
        failureCount: 0,
        lastFailureTime: 0,
        lastSuccessTime: 0,
      };
      this.states.set(domain, entry);
    }

    entry.failureCount++;
    entry.lastFailureTime = Date.now();

    // 429 Too Many Requests trips circuit breaker immediately
    if (statusCode === 429 || entry.failureCount >= this.failureThreshold) {
      entry.state = 'OPEN';
    }
  }

  async execute<T>(domain: string, fn: () => Promise<T>): Promise<T> {
    const currentState = this.getState(domain);

    if (currentState === 'OPEN') {
      throw new Error(`Circuit breaker is OPEN for domain: ${domain}. Requests are throttled.`);
    }

    try {
      const result = await fn();
      this.recordSuccess(domain);
      return result;
    } catch (err: any) {
      const statusCode = err?.status ?? err?.statusCode;
      this.recordFailure(domain, statusCode);
      throw err;
    }
  }

  reset(domain?: string): void {
    if (domain) {
      this.states.delete(domain);
    } else {
      this.states.clear();
    }
  }
}

/**
 * Service evaluating robots.txt politeness and persisting compliance status to ingest.job_sources.
 */
export class RobotsPolitenessService {
  /**
   * Parses robots.txt and verifies whether a target path is allowed for crawling.
   */
  isAllowed(robotsTxt: string, targetPath: string): boolean {
    const disallowedPaths = this.extractDisallowedPaths(robotsTxt);
    for (const pattern of disallowedPaths) {
      if (this.matchesPattern(targetPath, pattern)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Extracts Crawl-delay from robots.txt.
   */
  getCrawlDelay(robotsTxt: string): number | undefined {
    const lines = robotsTxt.split('\n');
    for (const line of lines) {
      const clean = line.trim();
      if (clean.toLowerCase().startsWith('crawl-delay:')) {
        const val = clean.split(':')[1]?.trim();
        const num = parseFloat(val);
        if (!isNaN(num) && num > 0) return num;
      }
    }
    return undefined;
  }

  /**
   * Evaluates robots.txt compliance and persists to ingest.job_sources.compliance_status in Supabase.
   */
  async updateJobSourceCompliance(
    jobSourceId: string,
    robotsTxt: string,
    targetUrl: string,
  ): Promise<RobotsComplianceStatus> {
    if (!db) throw new Error('Database client not initialized');

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      parsedUrl = new URL(targetUrl, 'https://example.com');
    }

    const path = parsedUrl.pathname || '/';
    const disallowed = this.extractDisallowedPaths(robotsTxt);
    const allowed = this.isAllowed(robotsTxt, path);
    const crawlDelay = this.getCrawlDelay(robotsTxt);

    const compliance: RobotsComplianceStatus = {
      robots_checked: true,
      allowed,
      crawl_delay_seconds: crawlDelay,
      checked_at: new Date().toISOString(),
      disallowed_paths: disallowed,
    };

    await db`
      UPDATE ingest.job_sources
      SET compliance_status = ${db.json(compliance as any)},
          updated_at = now()
      WHERE id = ${jobSourceId}
    `;

    return compliance;
  }

  private extractDisallowedPaths(robotsTxt: string): string[] {
    const lines = robotsTxt.split('\n');
    const disallowed: string[] = [];
    let isUniversalAgent = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const lower = trimmed.toLowerCase();
      if (lower.startsWith('user-agent:')) {
        const agent = trimmed.split(':')[1]?.trim();
        isUniversalAgent = agent === '*';
      } else if (isUniversalAgent && lower.startsWith('disallow:')) {
        const path = trimmed.split(':')[1]?.trim();
        if (path) disallowed.push(path);
      }
    }

    return disallowed;
  }

  private matchesPattern(path: string, pattern: string): boolean {
    if (pattern === '/') return true;
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      return path.startsWith(prefix);
    }
    return path.startsWith(pattern);
  }
}
