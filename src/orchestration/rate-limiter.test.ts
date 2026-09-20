import { describe, it, expect, beforeAll } from 'vitest';
import { sql } from '../db/index.js';
import {
  DomainRateLimiter,
  CircuitBreaker,
  RobotsPolitenessService,
} from './rate-limiter.js';

const db = sql!;

describe('Phase 5.2: Rate Limiting, Circuit Breakers & Robots Politeness Engine', () => {
  let testCompanyId: string;
  let testJobSourceId: string;

  beforeAll(async () => {
    const [company] = await db`
      INSERT INTO discovery.companies (name)
      VALUES (${'Polite Corp ' + Date.now()})
      RETURNING id
    `;
    testCompanyId = company.id;

    const [src] = await db`
      INSERT INTO ingest.job_sources (company_id, connector, base_url)
      VALUES (${testCompanyId}, 'generic', 'https://politecorp.com/careers')
      RETURNING id
    `;
    testJobSourceId = src.id;
  });

  describe('DomainRateLimiter', () => {
    it('throttles consecutive requests to the same domain while allowing distinct domains immediately', async () => {
      const limiter = new DomainRateLimiter(50); // 50ms interval

      const start = Date.now();
      await limiter.acquire('domain-a.com');
      await limiter.acquire('domain-a.com');
      const elapsedA = Date.now() - start;

      // Must have waited at least 40-50ms for domain-a
      expect(elapsedA).toBeGreaterThanOrEqual(40);

      // Distinct domain should be able to request immediately
      expect(limiter.canRequest('domain-b.com')).toBe(true);
    });
  });

  describe('CircuitBreaker', () => {
    it('trips from CLOSED to OPEN after failure threshold and protects endpoint', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 3, cooldownPeriodMs: 100 });
      const targetDomain = 'fragile-api.com';

      expect(breaker.getState(targetDomain)).toBe('CLOSED');

      // Failure 1 & 2
      breaker.recordFailure(targetDomain, 500);
      breaker.recordFailure(targetDomain, 500);
      expect(breaker.getState(targetDomain)).toBe('CLOSED');

      // Failure 3: reaches threshold -> trips to OPEN
      breaker.recordFailure(targetDomain, 500);
      expect(breaker.getState(targetDomain)).toBe('OPEN');

      // Executing while OPEN throws fast-fail without running function
      let ran = false;
      await expect(
        breaker.execute(targetDomain, async () => {
          ran = true;
          return 'ok';
        }),
      ).rejects.toThrow(/Circuit breaker is OPEN/);
      expect(ran).toBe(false);

      // Wait for cooldown period (100ms)
      await new Promise((resolve) => setTimeout(resolve, 110));
      expect(breaker.getState(targetDomain)).toBe('HALF_OPEN');

      // Successful probe in HALF_OPEN recovers to CLOSED
      const probeResult = await breaker.execute(targetDomain, async () => 'recovered');
      expect(probeResult).toBe('recovered');
      expect(breaker.getState(targetDomain)).toBe('CLOSED');
    });

    it('trips immediately upon receiving HTTP 429 Too Many Requests', async () => {
      const breaker = new CircuitBreaker();
      const domain = 'rate-limited-ats.com';

      breaker.recordFailure(domain, 429);
      expect(breaker.getState(domain)).toBe('OPEN');
    });
  });

  describe('RobotsPolitenessService', () => {
    const robotsService = new RobotsPolitenessService();

    const sampleRobotsTxt = `
      User-agent: Googlebot
      Disallow: /private/

      User-agent: *
      Disallow: /api/internal/
      Disallow: /careers/apply/
      Disallow: /admin/*
      Crawl-delay: 2.5
    `;

    it('correctly evaluates allowed and disallowed paths against robots.txt directives', () => {
      expect(robotsService.isAllowed(sampleRobotsTxt, '/careers')).toBe(true);
      expect(robotsService.isAllowed(sampleRobotsTxt, '/careers/jobs/101')).toBe(true);
      expect(robotsService.isAllowed(sampleRobotsTxt, '/careers/apply/submit')).toBe(false);
      expect(robotsService.isAllowed(sampleRobotsTxt, '/admin/login')).toBe(false);
    });

    it('extracts crawl-delay value accurately', () => {
      const delay = robotsService.getCrawlDelay(sampleRobotsTxt);
      expect(delay).toBe(2.5);
    });

    it('persists robots compliance status to ingest.job_sources in Supabase', async () => {
      const compliance = await robotsService.updateJobSourceCompliance(
        testJobSourceId,
        sampleRobotsTxt,
        'https://politecorp.com/careers/jobs',
      );

      expect(compliance.robots_checked).toBe(true);
      expect(compliance.allowed).toBe(true);
      expect(compliance.crawl_delay_seconds).toBe(2.5);
      expect(compliance.disallowed_paths).toContain('/careers/apply/');

      // Verify row in Supabase
      const [source] = await db`
        SELECT compliance_status
        FROM ingest.job_sources
        WHERE id = ${testJobSourceId}
      `;
      expect(source.compliance_status.robots_checked).toBe(true);
      expect(source.compliance_status.allowed).toBe(true);
      expect(source.compliance_status.crawl_delay_seconds).toBe(2.5);
    });
  });
});
