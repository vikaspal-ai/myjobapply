import { sql, emitOutboxEvent } from '../db/index.js';
import type {
  CompleteTaskOptions,
  CreateScheduleInput,
  ScheduleRecord,
} from './types.js';

const db = sql!;

export class SchedulerService {
  /**
   * Registers a recurring schedule for a job source, company, or followup target.
   * Enforces the single target invariant via database constraint chk_schedule_one_target.
   */
  async createSchedule(input: CreateScheduleInput): Promise<ScheduleRecord> {
    if (!db) throw new Error('Database client not initialized');

    const priority = input.priority ?? 100;
    const baseCadenceMinutes = input.baseCadenceMinutes ?? 720; // Default 12 hours
    const jitterMinutes = input.jitterMinutes ?? 5;
    const nextDueAt = input.nextDueAt ?? new Date();

    const [row] = await db`
      INSERT INTO sched.schedules (
        job_source_id,
        company_id,
        followup_id,
        priority,
        base_cadence,
        next_due_at,
        jitter,
        enabled
      ) VALUES (
        ${input.jobSourceId ?? null},
        ${input.companyId ?? null},
        ${input.followupId ?? null},
        ${priority},
        ${baseCadenceMinutes} * interval '1 minute',
        ${nextDueAt},
        ${jitterMinutes} * interval '1 minute',
        true
      )
      RETURNING *
    `;

    return this.mapScheduleRow(row);
  }

  /**
   * Atomically claims the highest priority due schedule for a worker instance.
   * Utilizes row-level locks with SKIP LOCKED to prevent race conditions.
   * Automatically recovers expired leases from crashed or timed-out workers.
   */
  async claimDueTask(
    workerId: string,
    options?: { leaseDurationSeconds?: number },
  ): Promise<ScheduleRecord | null> {
    if (!db) throw new Error('Database client not initialized');

    const leaseDurationSeconds = options?.leaseDurationSeconds ?? 300; // 5 minutes default

    const rows = await db`
      WITH candidate AS (
        SELECT id
        FROM sched.schedules
        WHERE enabled = true
          AND (backoff_until IS NULL OR backoff_until <= now())
          AND (
            -- Case 1: Unassigned and due
            (in_flight_since IS NULL AND next_due_at <= now())
            OR
            -- Case 2: Lease expired (worker crash recovery)
            (in_flight_since IS NOT NULL AND lease_expires_at <= now())
          )
        ORDER BY priority ASC, next_due_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE sched.schedules s
      SET in_flight_since = now(),
          lease_expires_at = now() + (${leaseDurationSeconds} * interval '1 second'),
          locked_by = ${workerId},
          row_version = s.row_version + 1,
          updated_at = now()
      FROM candidate
      WHERE s.id = candidate.id
      RETURNING s.*
    `;

    if (rows.length === 0) {
      return null;
    }

    const schedule = this.mapScheduleRow(rows[0]);

    await emitOutboxEvent(db, {
      type: 'ScheduleTriggered',
      producer: 'scheduler-service',
      idempotencyKey: `schedule:${schedule.id}:triggered:${schedule.rowVersion}`,
      correlationId: schedule.id,
      entityRefs: {
        scheduleId: schedule.id,
        jobSourceId: schedule.jobSourceId,
        companyId: schedule.companyId,
      },
      payload: {
        workerId,
        leaseExpiresAt: schedule.leaseExpiresAt,
        rowVersion: schedule.rowVersion,
      },
    });

    return schedule;
  }

  /**
   * Completes a task execution and reschedules next run with jitter or applies exponential backoff.
   */
  async completeTask(options: CompleteTaskOptions): Promise<ScheduleRecord> {
    if (!db) throw new Error('Database client not initialized');

    const schedule = await this.getSchedule(options.scheduleId);
    if (!schedule) {
      throw new Error(`Schedule not found: ${options.scheduleId}`);
    }

    if (schedule.lockedBy !== options.workerId) {
      throw new Error(
        `Invariant violation: Cannot complete schedule ${options.scheduleId}. Lease held by '${schedule.lockedBy}', caller is '${options.workerId}'.`,
      );
    }

    let nextDueAt: Date;
    let backoffUntil: Date | null = null;
    let outcomeNote: string;

    if (options.outcome === 'SUCCESS') {
      outcomeNote = 'SUCCESS';
      // Calculate next due at: now() + base_cadence + random jitter
      const [calc] = await db`
        SELECT (now() + base_cadence + (random() * jitter)) AS next_due
        FROM sched.schedules
        WHERE id = ${options.scheduleId}
      `;
      nextDueAt = new Date(calc.next_due);
    } else if (options.outcome === 'RATE_LIMITED') {
      outcomeNote = 'RATE_LIMITED: Throttled by upstream target';
      const backoffMins = options.backoffMinutes ?? 15;
      const [calc] = await db`
        SELECT (now() + (${backoffMins} * interval '1 minute')) AS backoff_due
      `;
      backoffUntil = new Date(calc.backoff_due);
      nextDueAt = backoffUntil;
    } else {
      outcomeNote = `FAILURE: ${options.error ?? 'Task execution error'}`;
      const backoffMins = options.backoffMinutes ?? 5;
      const [calc] = await db`
        SELECT (now() + (${backoffMins} * interval '1 minute')) AS backoff_due
      `;
      backoffUntil = new Date(calc.backoff_due);
      nextDueAt = backoffUntil;
    }

    const [updated] = await db`
      UPDATE sched.schedules
      SET in_flight_since = NULL,
          lease_expires_at = NULL,
          locked_by = NULL,
          last_outcome = ${outcomeNote},
          backoff_until = ${backoffUntil},
          next_due_at = ${nextDueAt},
          row_version = row_version + 1,
          updated_at = now()
      WHERE id = ${options.scheduleId}
        AND locked_by = ${options.workerId}
      RETURNING *
    `;

    if (!updated) {
      throw new Error(`Failed to complete task: lease on ${options.scheduleId} was lost.`);
    }

    const record = this.mapScheduleRow(updated);

    await emitOutboxEvent(db, {
      type: 'ScheduleCompleted',
      producer: 'scheduler-service',
      idempotencyKey: `schedule:${record.id}:completed:${record.rowVersion}`,
      correlationId: record.id,
      entityRefs: {
        scheduleId: record.id,
        jobSourceId: record.jobSourceId,
        companyId: record.companyId,
      },
      payload: {
        workerId: options.workerId,
        outcome: options.outcome,
        nextDueAt: record.nextDueAt,
        rowVersion: record.rowVersion,
      },
    });

    return record;
  }

  /**
   * Heartbeat renewal to extend an active worker's lease on long-running tasks.
   */
  async renewLease(
    scheduleId: string,
    workerId: string,
    additionalSeconds: number = 300,
  ): Promise<boolean> {
    if (!db) throw new Error('Database client not initialized');

    const rows = await db`
      UPDATE sched.schedules
      SET lease_expires_at = now() + (${additionalSeconds} * interval '1 second'),
          updated_at = now()
      WHERE id = ${scheduleId}
        AND locked_by = ${workerId}
        AND in_flight_since IS NOT NULL
      RETURNING id
    `;

    return rows.length > 0;
  }

  /**
   * Fetches a schedule by ID.
   */
  async getSchedule(scheduleId: string): Promise<ScheduleRecord | null> {
    if (!db) throw new Error('Database client not initialized');

    const rows = await db`
      SELECT * FROM sched.schedules
      WHERE id = ${scheduleId}
      LIMIT 1
    `;

    if (rows.length === 0) return null;
    return this.mapScheduleRow(rows[0]);
  }

  private mapScheduleRow(row: any): ScheduleRecord {
    return {
      id: row.id,
      jobSourceId: row.job_source_id ?? undefined,
      companyId: row.company_id ?? undefined,
      followupId: row.followup_id ?? undefined,
      priority: row.priority,
      baseCadence: typeof row.base_cadence === 'object' ? JSON.stringify(row.base_cadence) : String(row.base_cadence),
      nextDueAt: new Date(row.next_due_at),
      jitter: typeof row.jitter === 'object' ? JSON.stringify(row.jitter) : String(row.jitter),
      backoffUntil: row.backoff_until ? new Date(row.backoff_until) : undefined,
      inFlightSince: row.in_flight_since ? new Date(row.in_flight_since) : undefined,
      leaseExpiresAt: row.lease_expires_at ? new Date(row.lease_expires_at) : undefined,
      lockedBy: row.locked_by ?? undefined,
      enabled: row.enabled,
      lastOutcome: row.last_outcome ?? undefined,
      rowVersion: row.row_version,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
