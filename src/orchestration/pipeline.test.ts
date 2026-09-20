import { describe, it, expect, beforeAll } from 'vitest';
import { sql } from '../db/index.js';
import { OutboxConsumer } from './consumer.js';
import { PipelineOrchestrator } from './pipeline.js';
import { IngestionCrawler } from '../ingest/crawler.js';

const db = sql!;

describe('Phase 5.3: Outbox Event Consumer & Autonomous Pipeline Orchestrator', () => {
  let testCandidateId: string;
  let testCompanyId: string;
  let testJobSourceId: string;

  beforeAll(async () => {
    // Clean outbox queue for deterministic test execution
    await db`
      UPDATE platform.outbox_events
      SET published_at = now()
      WHERE published_at IS NULL
    `;

    // 1. Seed candidate & fact
    const [candidate] = await db`
      INSERT INTO profile.candidate_profiles (full_name, email)
      VALUES ('Pipeline Candidate', ${`pipeline-${Date.now()}@example.com`})
      RETURNING id
    `;
    testCandidateId = candidate.id;

    await db`
      INSERT INTO profile.candidate_facts (candidate_id, category, statement, verified)
      VALUES (
        ${testCandidateId},
        'skill',
        'Expertise in TypeScript microservices, Node.js, and Docker architecture.',
        true
      )
    `;

    // 2. Seed company & job source
    const [company] = await db`
      INSERT INTO discovery.companies (name)
      VALUES (${'Pipeline Corp ' + Date.now()})
      RETURNING id
    `;
    testCompanyId = company.id;

    const [src] = await db`
      INSERT INTO ingest.job_sources (company_id, connector, base_url)
      VALUES (${testCompanyId}, 'generic', 'https://pipelinecorp.com/careers')
      RETURNING id
    `;
    testJobSourceId = src.id;
  });

  describe('OutboxConsumer', () => {
    it('processes unpublished events idempotently and marks published_at in Supabase', async () => {
      const consumer = new OutboxConsumer(`test-worker-${Date.now()}`);
      let handledCount = 0;

      consumer.subscribe('TestPipelineEvent', async () => {
        handledCount++;
      });

      // Insert test outbox event
      const [event] = await db`
        INSERT INTO platform.outbox_events (
          type, producer, correlation_id, idempotency_key, payload, occurred_at
        ) VALUES (
          'TestPipelineEvent',
          'test-suite',
          gen_random_uuid(),
          ${'test_key_' + Date.now()},
          '{"message": "hello"}'::jsonb,
          now()
        )
        RETURNING id
      `;

      // 1. First process batch
      const result1 = await consumer.processBatch({ batchSize: 10 });
      expect(result1.processed).toBeGreaterThanOrEqual(1);
      expect(handledCount).toBe(1);

      // Verify event in Supabase now has published_at set
      const [updatedEvent] = await db`
        SELECT published_at FROM platform.outbox_events WHERE id = ${event.id}
      `;
      expect(updatedEvent.published_at).not.toBeNull();

      // Verify recorded in platform.processed_events
      const [processedRow] = await db`
        SELECT * FROM platform.processed_events WHERE event_id = ${event.id}
      `;
      expect(processedRow).toBeDefined();

      // 2. Re-processing should not re-trigger handler (idempotency check)
      const result2 = await consumer.processBatch({ batchSize: 10 });
      expect(handledCount).toBe(1); // Still 1
    });

    it('routes failing handlers to platform.dead_letters table', async () => {
      const consumer = new OutboxConsumer(`failing-worker-${Date.now()}`);

      consumer.subscribe('FailingEvent', async () => {
        throw new Error('Simulated worker crash');
      });

      const [event] = await db`
        INSERT INTO platform.outbox_events (
          type, producer, correlation_id, idempotency_key, payload, occurred_at
        ) VALUES (
          'FailingEvent',
          'test-suite',
          gen_random_uuid(),
          ${'failing_key_' + Date.now()},
          '{"attempt": 1}'::jsonb,
          now()
        )
        RETURNING id
      `;

      const result = await consumer.processBatch({ batchSize: 10 });
      expect(result.errors.length).toBeGreaterThanOrEqual(1);

      // Verify record in platform.dead_letters
      const [dlq] = await db`
        SELECT * FROM platform.dead_letters
        WHERE event_id = ${event.id}
        LIMIT 1
      `;
      expect(dlq).toBeDefined();
      expect(dlq.reason).toContain('Simulated worker crash');
    });
  });

  describe('PipelineOrchestrator End-to-End Reactive Cascade', () => {
    it('reactively chains JobDiscovered -> Dedup -> Requirements -> Fit -> Notification', async () => {
      const orchestrator = new PipelineOrchestrator(`cascade-worker-${Date.now()}`);
      const crawler = new IngestionCrawler();

      const externalId = `ORCH-JOB-${Date.now()}`;
      const sampleHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "JobPosting",
              "title": "Senior TypeScript Backend Engineer",
              "identifier": {
                "@type": "PropertyValue",
                "value": "${externalId}"
              },
              "description": "Develop scalable distributed backend services with TypeScript, Node.js, and Docker. 4+ years of experience required.",
              "datePosted": "2026-09-20",
              "url": "https://pipelinecorp.com/apply/101"
            }
            </script>
          </head>
          <body><h1>Job Listing</h1></body>
        </html>
      `;

      // 1. Crawl raw posting (emits JobDiscovered)
      const crawlResult = await crawler.crawlSource({
        jobSourceId: testJobSourceId,
        htmlOverride: sampleHtml,
      });
      expect(crawlResult.stats.fetched).toBe(1);

      // 2. Run Pipeline Cycle 1: Processes JobDiscovered -> triggers Dedup -> emits JobCanonicalized
      const cycle1 = await orchestrator.processPendingEvents({ batchSize: 20 });
      expect(cycle1.processed).toBeGreaterThanOrEqual(1);

      // 3. Run Pipeline Cycle 2: Processes JobCanonicalized -> triggers Requirements -> emits JobRequirementsExtracted
      const cycle2 = await orchestrator.processPendingEvents({ batchSize: 20 });
      expect(cycle2.processed).toBeGreaterThanOrEqual(1);

      // 4. Run Pipeline Cycle 3: Processes JobRequirementsExtracted -> triggers Matching -> emits JobMatched
      const cycle3 = await orchestrator.processPendingEvents({ batchSize: 20 });
      expect(cycle3.processed).toBeGreaterThanOrEqual(1);

      // 5. Run Pipeline Cycle 4: Processes JobMatched -> triggers High-Match Alert -> inserts platform.notifications
      const cycle4 = await orchestrator.processPendingEvents({ batchSize: 20 });
      expect(cycle4.processed).toBeGreaterThanOrEqual(1);

      // Verify the full end-to-end outcome in Supabase:
      // A. Canonical job created in jobs.jobs
      const jobs = await db`
        SELECT * FROM jobs.jobs
        WHERE company_id = ${testCompanyId}
        ORDER BY created_at DESC
        LIMIT 1
      `;
      expect(jobs.length).toBe(1);
      expect(jobs[0].title).toContain('TypeScript');

      // B. Requirements extracted in jobs.job_requirements
      const [reqs] = await db`
        SELECT * FROM jobs.job_requirements
        WHERE job_id = ${jobs[0].id}
      `;
      expect(reqs).toBeDefined();
      expect(reqs.required_skills).toContain('typescript');

      // C. Match computed in jobs.job_matches
      const [match] = await db`
        SELECT * FROM jobs.job_matches
        WHERE job_id = ${jobs[0].id} AND candidate_id = ${testCandidateId}
      `;
      expect(match).toBeDefined();
      expect(Number(match.score)).toBeGreaterThanOrEqual(70);

      // D. High-match notification emitted in platform.notifications!
      const [notification] = await db`
        SELECT * FROM platform.notifications
        WHERE kind = 'HIGH_MATCH_ALERT'
          AND payload->>'candidateId' = ${testCandidateId}
        ORDER BY created_at DESC
        LIMIT 1
      `;
      expect(notification).toBeDefined();
      expect(notification.payload.jobId).toBe(jobs[0].id);
    }, 30000);
  });
});
