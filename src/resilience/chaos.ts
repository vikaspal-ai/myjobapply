import crypto from 'node:crypto';
import { sql, emitOutboxEvent } from '../db/index.js';
import { SchedulerService } from '../orchestration/scheduler.js';
import { OutboxConsumer, type OutboxEventRecord } from '../orchestration/consumer.js';
import { ApplicationWorkflowEngine } from '../apply/workflow.js';

const db = sql!;

export interface ChaosDrillResult {
  drillName: string;
  passed: boolean;
  details: Record<string, any>;
  durationMs: number;
}

export class ChaosEngine {
  /**
   * Chaos Drill 1: Worker Crash & Lease Recovery.
   * Simulates worker death mid-execution holding a distributed lease.
   * Proves that secondary worker recovers the expired lease without task loss or deadlocks.
   */
  async runWorkerCrashRecoveryDrill(companyId: string): Promise<ChaosDrillResult> {
    const start = Date.now();
    const workerCrashedId = `worker-crashed-${Date.now()}`;
    const workerSurvivorId = `worker-survivor-${Date.now()}`;

    // 1. Create schedule with an already EXPIRED lease (simulating worker death after crash)
    const [schedule] = await db`
      INSERT INTO sched.schedules (
        company_id,
        priority,
        base_cadence,
        next_due_at,
        in_flight_since,
        lease_expires_at,
        locked_by,
        enabled,
        row_version
      ) VALUES (
        ${companyId},
        1,
        interval '1 hour',
        now() - interval '10 minutes',
        now() - interval '10 minutes',
        now() - interval '2 seconds', -- EXPIRED LEASE
        ${workerCrashedId},
        true,
        1
      )
      RETURNING *
    `;

    // 2. Survivor worker attempts to claim the expired lease
    const scheduler = new SchedulerService();
    const claimed = await scheduler.claimDueTask(workerSurvivorId, {
      scheduleId: schedule.id,
    });

    const passed = claimed !== null && claimed.id === schedule.id && claimed.lockedBy === workerSurvivorId;

    if (claimed) {
      await scheduler.completeTask({
        scheduleId: claimed.id,
        workerId: workerSurvivorId,
        outcome: 'SUCCESS',
      });
    }

    return {
      drillName: 'WorkerCrashRecoveryDrill',
      passed,
      details: {
        scheduleId: schedule.id,
        originalWorker: workerCrashedId,
        reclaimedBy: claimed?.lockedBy,
        rowVersionAfterReclaim: claimed?.rowVersion,
      },
      durationMs: Date.now() - start,
    };
  }

  /**
   * Chaos Drill 2: Dead-Letter Queue & Poison Pill Isolation.
   * Emits a poison-pill event that throws in the subscriber.
   * Proves:
   * 1. Poison pill is captured in platform.dead_letters with stack trace.
   * 2. The outbox consumer does NOT crash or stall.
   * 3. Subsequent valid events process cleanly.
   */
  async runPoisonPillIsolationDrill(): Promise<ChaosDrillResult> {
    const start = Date.now();
    const beforeTime = new Date(Date.now() - 1000);
    const consumerName = `chaos-consumer-${Date.now()}`;
    const consumer = new OutboxConsumer(consumerName);

    const poisonEventKey = `chaos:poison:${Date.now()}`;
    const validEventKey = `chaos:valid:${Date.now()}`;

    // Register handler that throws on poison pill
    consumer.subscribe('ChaosTestEvent', async (event: OutboxEventRecord) => {
      if (event.payload?.isPoison) {
        throw new Error('POISON_PILL_FAILURE: Simulated unrecoverable worker panic');
      }
    });

    // Emit poison event
    await emitOutboxEvent(db, {
      type: 'ChaosTestEvent',
      producer: 'chaos-engine',
      idempotencyKey: poisonEventKey,
      correlationId: crypto.randomUUID(),
      entityRefs: {},
      payload: { isPoison: true },
    });

    // Emit valid event right behind it
    await emitOutboxEvent(db, {
      type: 'ChaosTestEvent',
      producer: 'chaos-engine',
      idempotencyKey: validEventKey,
      correlationId: crypto.randomUUID(),
      entityRefs: {},
      payload: { isPoison: false },
    });

    // Process batch containing both
    const batchResult = await consumer.processBatch({ batchSize: 10, newerThan: beforeTime });

    // Verify poison pill captured in platform.dead_letters
    const deadLetters = await db`
      SELECT * FROM platform.dead_letters
      WHERE queue = ${consumerName}
    `;

    const passed = deadLetters.length === 1 &&
                   deadLetters[0].reason.includes('POISON_PILL_FAILURE') &&
                   batchResult.processed >= 1;

    return {
      drillName: 'PoisonPillIsolationDrill',
      passed,
      details: {
        batchProcessedCount: batchResult.processed,
        batchErrorCount: batchResult.errors.length,
        deadLettersCount: deadLetters.length,
        capturedError: deadLetters[0]?.reason,
      },
      durationMs: Date.now() - start,
    };
  }

  /**
   * Chaos Drill 3: High-Concurrency Duplicate Delivery & Idempotency Bombardment.
   * Bombards ApplicationWorkflowEngine with 10 concurrent identical draft creation requests.
   * Proves:
   * 1. Exactly 1 row is written to apply.applications.
   * 2. All 10 concurrent callers receive the same application ID without error.
   */
  async runIdempotencyBombardmentDrill(candidateId: string, jobId: string): Promise<ChaosDrillResult> {
    const start = Date.now();
    const workflow = new ApplicationWorkflowEngine();

    // Fire 10 simultaneous draft requests
    const promises = Array.from({ length: 10 }).map(() =>
      workflow.createDraft({
        candidateId,
        jobId,
        notes: 'Concurrent Idempotency Bombardment',
      }),
    );

    const results = await Promise.all(promises);

    // Verify all returned same application ID
    const uniqueIds = new Set(results.map(r => r.id));

    // Verify database row count
    const [row] = await db`
      SELECT count(*) as count FROM apply.applications
      WHERE candidate_id = ${candidateId} AND job_id = ${jobId}
    `;

    const count = Number(row.count);
    const passed = uniqueIds.size === 1 && count === 1;

    return {
      drillName: 'IdempotencyBombardmentDrill',
      passed,
      details: {
        concurrentRequests: 10,
        uniqueReturnedIds: uniqueIds.size,
        persistedRowCount: count,
        applicationId: results[0]?.id,
      },
      durationMs: Date.now() - start,
    };
  }
}

export const chaosEngine = new ChaosEngine();
