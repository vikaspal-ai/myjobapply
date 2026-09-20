import { sql } from '../db/index.js';
import { DeduplicationEngine } from '../jobs/dedup.js';
import { requirementsService } from '../jobs/requirements.js';
import { matchingService } from '../jobs/matching.js';
import { OutboxConsumer, type OutboxEventRecord } from './consumer.js';

const db = sql!;

export class PipelineOrchestrator {
  private consumer: OutboxConsumer;
  private dedupEngine: DeduplicationEngine;

  constructor(consumerName: string = 'pipeline-orchestrator') {
    this.consumer = new OutboxConsumer(consumerName);
    this.dedupEngine = new DeduplicationEngine();
    this.registerPipelineHandlers();
  }

  getConsumer(): OutboxConsumer {
    return this.consumer;
  }

  /**
   * Registers reactive event handlers connecting:
   * JobDiscovered -> Dedup -> Requirements -> Matching -> Notifications.
   */
  private registerPipelineHandlers(): void {
    // 1. JobDiscovered -> Canonical Deduplication
    this.consumer.subscribe('JobDiscovered', async (event: OutboxEventRecord) => {
      const sourceId = event.entityRefs.sourceId;
      const postingId = event.entityRefs.rawPostingId || event.entityRefs.postingId;
      const { externalId, title, sourceUrl, applyUrl } = event.payload;

      if (!sourceId || !externalId) return;

      // Fetch company_id from job_sources
      const [source] = await db`
        SELECT company_id FROM ingest.job_sources WHERE id = ${sourceId}
      `;
      if (!source) return;

      let description: string = title || 'No description provided';
      if (postingId) {
        const [raw] = await db`
          SELECT payload FROM ingest.raw_postings WHERE id = ${postingId}
        `;
        if (raw?.payload?.description) {
          description = raw.payload.description;
        }
      }

      await this.dedupEngine.processJob({
        sourceId,
        companyId: source.company_id,
        externalId,
        title,
        description,
        sourceUrl: sourceUrl || 'https://example.com/job',
        applyUrl: applyUrl || 'https://example.com/apply',
      });
    });

    // 2. JobCanonicalized -> Requirements Extraction
    this.consumer.subscribe('JobCanonicalized', async (event: OutboxEventRecord) => {
      const jobId = event.entityRefs.jobId;
      if (!jobId) return;

      const [job] = await db`
        SELECT description FROM jobs.jobs WHERE id = ${jobId}
      `;
      if (!job) return;

      await requirementsService.processJobRequirements(jobId, job.description);
    });

    // 3. JobRequirementsExtracted -> Fit Matching
    this.consumer.subscribe('JobRequirementsExtracted', async (event: OutboxEventRecord) => {
      const jobId = event.entityRefs.jobId;
      if (!jobId) return;

      // Evaluate fit against active candidate profiles
      const candidates = await db`
        SELECT id FROM profile.candidate_profiles
        ORDER BY created_at DESC
        LIMIT 3
      `;

      for (const cand of candidates) {
        await matchingService.matchJob(jobId, cand.id);
      }
    });

    // 4. JobMatched -> High-Match Alerts & Notifications
    this.consumer.subscribe('JobMatched', async (event: OutboxEventRecord) => {
      const { jobId, candidateId } = event.entityRefs;
      const { score, verdict } = event.payload;

      // Alert candidate if match score is >= 70% or PASS
      if (score >= 70 || verdict === 'PASS') {
        await db`
          INSERT INTO platform.notifications (kind, payload)
          VALUES (
            'HIGH_MATCH_ALERT',
            ${db.json({
              candidateId,
              jobId,
              score,
              verdict,
              discoveredAt: new Date().toISOString(),
            })}
          )
        `;
      }
    });
  }

  async processPendingEvents(options?: {
    batchSize?: number;
    newerThan?: Date;
  }): Promise<{
    processed: number;
    errors: Array<{ eventId: string; error: string }>;
  }> {
    return await this.consumer.processBatch(options);
  }
}
