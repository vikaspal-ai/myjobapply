import type { FastifyInstance } from 'fastify';
import { sql } from '../../db/index.js';
import { PipelineOrchestrator } from '../../orchestration/pipeline.js';
import { classifyCareerPage } from '../../discovery/fingerprint.js';
import { IngestionCrawler } from '../../ingest/crawler.js';

const db = sql!;
const orchestrator = new PipelineOrchestrator('api-orchestrator');
const crawler = new IngestionCrawler();

export async function pipelineRoutes(app: FastifyInstance) {
  // GET /api/pipeline/status - Status of event queues, outbox, and leases
  app.get('/api/pipeline/status', async (_req, reply) => {
    // 1. Outbox counts
    const [outboxStats] = await db`
      SELECT 
        count(*) as total_events,
        count(*) FILTER (WHERE published_at IS NULL) as unpublished_events,
        count(*) FILTER (WHERE published_at IS NOT NULL) as published_events
      FROM platform.outbox_events
    `;

    // 2. Dead letter count
    const [deadLetters] = await db`
      SELECT count(*) as dead_letter_count
      FROM platform.dead_letters
    `;

    // 3. Active schedules
    const [schedStats] = await db`
      SELECT 
        count(*) as total_schedules,
        count(*) FILTER (WHERE enabled = true) as active_schedules,
        count(*) FILTER (WHERE locked_by IS NOT NULL AND lease_expires_at > now()) as active_leases
      FROM sched.schedules
    `;

    // 4. Job sources count
    const [sourceStats] = await db`
      SELECT count(*) as total_sources
      FROM ingest.job_sources
    `;

    // 5. Recent 10 outbox events
    const recentEvents = await db`
      SELECT id, type, producer, correlation_id, idempotency_key, published_at, created_at
      FROM platform.outbox_events
      ORDER BY created_at DESC
      LIMIT 10
    `;

    return reply.send({
      success: true,
      data: {
        outbox: {
          totalEvents: Number(outboxStats?.total_events || 0),
          unpublishedEvents: Number(outboxStats?.unpublished_events || 0),
          publishedEvents: Number(outboxStats?.published_events || 0),
        },
        deadLetters: {
          totalDeadLetters: Number(deadLetters?.dead_letter_count || 0),
        },
        schedules: {
          total: Number(schedStats?.total_schedules || 0),
          active: Number(schedStats?.active_schedules || 0),
          activeLeases: Number(schedStats?.active_leases || 0),
        },
        sources: {
          total: Number(sourceStats?.total_sources || 0),
        },
        recentEvents: recentEvents.map(e => ({
          id: e.id,
          type: e.type,
          producer: e.producer,
          correlationId: e.correlation_id,
          published: !!e.published_at,
          createdAt: e.created_at,
        })),
      },
    });
  });

  // POST /api/pipeline/consume - Trigger batch processing of unpublished outbox events
  app.post<{
    Body?: { batchSize?: number };
  }>('/api/pipeline/consume', async (req, reply) => {
    const { batchSize = 25 } = req.body || {};

    try {
      const result = await orchestrator.getConsumer().processBatch({ batchSize });
      return reply.send({
        success: true,
        data: {
          processedCount: result.processed,
          errors: result.errors,
        },
      });
    } catch (err: any) {
      return reply.code(500).send({ success: false, error: err.message });
    }
  });

  // POST /api/pipeline/crawl - Trigger career page crawl on demand
  app.post<{
    Body: { url: string; companyName?: string };
  }>('/api/pipeline/crawl', async (req, reply) => {
    const { url, companyName } = req.body;

    if (!url) {
      return reply.code(400).send({ success: false, error: 'url is required' });
    }

    try {
      // 1. Fingerprint Career Page
      let html = '';
      try {
        const fetchRes = await fetch(url, { headers: { 'User-Agent': 'JobHuntBot/1.0' } });
        if (fetchRes.ok) html = await fetchRes.text();
      } catch {
        // network fetch optional fallback
      }
      const fingerprint = classifyCareerPage({ url, html });
      const host = new URL(url).hostname;
      const effectiveName = companyName || host.replace(/^www\./, '').split('.')[0].toUpperCase();

      // 2. Ensure Company Record & Domain
      let [domainRow] = await db`
        SELECT company_id FROM discovery.company_domains WHERE domain = ${host} LIMIT 1
      `;

      let companyId: string;
      let companyNameResult = effectiveName;

      if (domainRow) {
        companyId = domainRow.company_id;
        const [comp] = await db`SELECT name FROM discovery.companies WHERE id = ${companyId}`;
        if (comp) companyNameResult = comp.name;
      } else {
        const [comp] = await db`
          INSERT INTO discovery.companies (name)
          VALUES (${effectiveName})
          RETURNING id, name
        `;
        companyId = comp.id;
        companyNameResult = comp.name;

        await db`
          INSERT INTO discovery.company_domains (company_id, domain, verified)
          VALUES (${companyId}, ${host}, true)
          ON CONFLICT (domain) DO NOTHING
        `;
      }

      // 3. Register or get Job Source
      let [source] = await db`
        SELECT * FROM ingest.job_sources
        WHERE company_id = ${companyId} AND root_url = ${url}
        LIMIT 1
      `;

      if (!source) {
        [source] = await db`
          INSERT INTO ingest.job_sources (
            company_id, root_url, source_type, compliance_status
          ) VALUES (
            ${companyId},
            ${url},
            ${fingerprint.ats || 'GENERIC_HTML'},
            ${db.json({ allowed: true, crawl_delay_seconds: 1 })}
          )
          RETURNING *
        `;
      }

      // 4. Run Crawler
      const crawlResult = await crawler.crawlSource({
        jobSourceId: source.id,
      });

      // 5. Automatically process any newly emitted outbox events
      await orchestrator.getConsumer().processBatch({ batchSize: 20 });

      return reply.send({
        success: true,
        data: {
          companyId,
          companyName: companyNameResult,
          sourceId: source.id,
          fingerprint: {
            ats: fingerprint.ats,
            pageClass: fingerprint.pageClass,
            confidence: fingerprint.confidence,
          },
          crawlResult,
        },
      });
    } catch (err: any) {
      return reply.code(500).send({ success: false, error: err.message });
    }
  });
}
