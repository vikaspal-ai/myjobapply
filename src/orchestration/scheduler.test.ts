import { describe, it, expect, beforeAll } from 'vitest';
import { sql } from '../db/index.js';
import { SchedulerService } from './scheduler.js';

const db = sql!;

describe('Phase 5.1: Distributed Lease Scheduler & Worker Crash Recovery', () => {
  const scheduler = new SchedulerService();

  let testCompanyId: string;

  beforeAll(async () => {
    // Seed test company
    const [company] = await db`
      INSERT INTO discovery.companies (name)
      VALUES (${'Sched Company ' + Date.now()})
      RETURNING id
    `;
    testCompanyId = company.id;
  });

  it('creates recurring schedule and enforces target invariant', async () => {
    const schedule = await scheduler.createSchedule({
      companyId: testCompanyId,
      priority: 50,
      baseCadenceMinutes: 60,
      jitterMinutes: 5,
    });

    expect(schedule.id).toBeDefined();
    expect(schedule.companyId).toBe(testCompanyId);
    expect(schedule.priority).toBe(50);
    expect(schedule.enabled).toBe(true);
    expect(schedule.lockedBy).toBeUndefined();
    expect(schedule.inFlightSince).toBeUndefined();

    // Verify exactly one target invariant chk_schedule_one_target in database
    await expect(
      db`
        INSERT INTO sched.schedules (
          company_id, followup_id, next_due_at, base_cadence, jitter
        ) VALUES (
          ${testCompanyId}, ${'00000000-0000-0000-0000-000000000000'}, now(), interval '1 hour', interval '5 mins'
        )
      `,
    ).rejects.toThrow(/chk_schedule_one_target/);
  });

  it('atomically claims due task with lease lock and prevents double claiming', async () => {
    const schedule = await scheduler.createSchedule({
      companyId: testCompanyId,
      priority: 10,
      nextDueAt: new Date(Date.now() - 5000), // Due in past
    });

    // Worker 1 claims task
    const claimed = await scheduler.claimDueTask('worker-alpha', {
      leaseDurationSeconds: 120,
      scheduleId: schedule.id,
    });
    expect(claimed).not.toBeNull();
    expect(claimed?.id).toBe(schedule.id);
    expect(claimed?.lockedBy).toBe('worker-alpha');
    expect(claimed?.leaseExpiresAt).toBeDefined();
    expect(claimed?.inFlightSince).toBeDefined();

    // Worker 2 attempts claim concurrently -> should not be able to claim the same task
    const worker2Claim = await scheduler.claimDueTask('worker-beta');
    // Either null or a different task, but never schedule.id
    if (worker2Claim) {
      expect(worker2Claim.id).not.toBe(schedule.id);
    }

    // Verify ScheduleTriggered outbox event
    const [event] = await db`
      SELECT * FROM platform.outbox_events
      WHERE entity_refs->>'scheduleId' = ${schedule.id}
        AND type = 'ScheduleTriggered'
      ORDER BY created_at DESC
      LIMIT 1
    `;
    expect(event).toBeDefined();
    expect(event.payload.workerId).toBe('worker-alpha');

    // Clean up task
    await scheduler.completeTask({
      scheduleId: schedule.id,
      workerId: 'worker-alpha',
      outcome: 'SUCCESS',
    });
  });

  it('recovers expired lease from crashed worker (crash recovery)', async () => {
    const schedule = await scheduler.createSchedule({
      companyId: testCompanyId,
      priority: 5,
      nextDueAt: new Date(Date.now() - 10000),
    });

    // Worker 1 claims task
    await scheduler.claimDueTask('worker-crashed', {
      leaseDurationSeconds: 60,
      scheduleId: schedule.id,
    });

    // Simulate worker-crashed dying by advancing lease_expires_at into the past
    await db`
      UPDATE sched.schedules
      SET lease_expires_at = now() - interval '10 seconds'
      WHERE id = ${schedule.id}
    `;

    // Worker 2 should now safely recover and claim the abandoned task
    const recoveredTask = await scheduler.claimDueTask('worker-survivor', {
      leaseDurationSeconds: 120,
      scheduleId: schedule.id,
    });
    expect(recoveredTask).not.toBeNull();
    expect(recoveredTask?.id).toBe(schedule.id);
    expect(recoveredTask?.lockedBy).toBe('worker-survivor');

    // Clean up
    await scheduler.completeTask({
      scheduleId: schedule.id,
      workerId: 'worker-survivor',
      outcome: 'SUCCESS',
    });
  });

  it('completes task and schedules next execution with jitter', async () => {
    const schedule = await scheduler.createSchedule({
      companyId: testCompanyId,
      priority: 20,
      baseCadenceMinutes: 120, // 2 hours
      jitterMinutes: 10,
      nextDueAt: new Date(Date.now() - 5000),
    });

    const claimed = await scheduler.claimDueTask('worker-finisher', {
      scheduleId: schedule.id,
    });
    expect(claimed?.id).toBe(schedule.id);

    const completed = await scheduler.completeTask({
      scheduleId: schedule.id,
      workerId: 'worker-finisher',
      outcome: 'SUCCESS',
    });

    expect(completed.lockedBy).toBeUndefined();
    expect(completed.inFlightSince).toBeUndefined();
    expect(completed.leaseExpiresAt).toBeUndefined();
    expect(completed.lastOutcome).toBe('SUCCESS');
    // nextDueAt must be in the future (around 2 hours from now)
    expect(completed.nextDueAt.getTime()).toBeGreaterThan(Date.now() + 60 * 60 * 1000);

    // Verify ScheduleCompleted outbox event
    const [event] = await db`
      SELECT * FROM platform.outbox_events
      WHERE entity_refs->>'scheduleId' = ${schedule.id}
        AND type = 'ScheduleCompleted'
      ORDER BY created_at DESC
      LIMIT 1
    `;
    expect(event).toBeDefined();
    expect(event.payload.outcome).toBe('SUCCESS');
  });

  it('applies backoff on RATE_LIMITED outcome and prevents immediate claim', async () => {
    const schedule = await scheduler.createSchedule({
      companyId: testCompanyId,
      priority: 15,
      nextDueAt: new Date(Date.now() - 5000),
    });

    await scheduler.claimDueTask('worker-throttled', {
      scheduleId: schedule.id,
    });

    const backedOff = await scheduler.completeTask({
      scheduleId: schedule.id,
      workerId: 'worker-throttled',
      outcome: 'RATE_LIMITED',
      backoffMinutes: 30,
    });

    expect(backedOff.lastOutcome).toContain('RATE_LIMITED');
    expect(backedOff.backoffUntil).toBeDefined();
    expect(backedOff.backoffUntil!.getTime()).toBeGreaterThan(Date.now() + 20 * 60 * 1000);

    // Verify schedule is NOT claimable during backoff
    const nextClaim = await scheduler.claimDueTask('worker-next');
    if (nextClaim) {
      expect(nextClaim.id).not.toBe(schedule.id);
    }
  });

  it('renews lease on long-running tasks via heartbeat', async () => {
    const schedule = await scheduler.createSchedule({
      companyId: testCompanyId,
      priority: 25,
      nextDueAt: new Date(Date.now() - 5000),
    });

    const claimed = await scheduler.claimDueTask('worker-heartbeat', {
      leaseDurationSeconds: 60,
      scheduleId: schedule.id,
    });
    expect(claimed).not.toBeNull();

    const renewed = await scheduler.renewLease(schedule.id, 'worker-heartbeat', 300);
    expect(renewed).toBe(true);

    const updated = await scheduler.getSchedule(schedule.id);
    expect(updated?.leaseExpiresAt!.getTime()).toBeGreaterThan(claimed!.leaseExpiresAt!.getTime());

    // Clean up
    await scheduler.completeTask({
      scheduleId: schedule.id,
      workerId: 'worker-heartbeat',
      outcome: 'SUCCESS',
    });
  });
});
