import { describe, it, expect, beforeAll } from 'vitest';
import { sql } from '../db/index.js';
import { chaosEngine } from './chaos.js';

const db = sql!;

describe('Phase 7: Failure Engineering & Chaos Resilience Drills', () => {
  let testCandidateId: string;
  let testCompanyId: string;
  let testJobId: string;

  beforeAll(async () => {
    // 1. Seed candidate
    const [candidate] = await db`
      INSERT INTO profile.candidate_profiles (full_name, email)
      VALUES ('Chaos Candidate', ${'chaos.' + Date.now() + '@example.com'})
      RETURNING id
    `;
    testCandidateId = candidate.id;

    // 2. Seed company
    const [company] = await db`
      INSERT INTO discovery.companies (name)
      VALUES (${'Chaos Corp ' + Date.now()})
      RETURNING id
    `;
    testCompanyId = company.id;

    // 3. Seed job
    const [job] = await db`
      INSERT INTO jobs.jobs (
        company_id, title, signature_hash, role_family, seniority, location, description, apply_url
      ) VALUES (
        ${testCompanyId},
        'Site Reliability Engineer',
        ${'sig_chaos_' + Date.now()},
        'Engineering',
        'Senior',
        ${db.json({ type: 'REMOTE' })},
        'Chaos engineering, resilience, fault injection',
        'https://chaoscorp.com/careers/sre'
      )
      RETURNING id
    `;
    testJobId = job.id;
  });

  it('Chaos Drill 1 (Worker Crash): secondary worker automatically reclaims expired lease without task loss', async () => {
    const result = await chaosEngine.runWorkerCrashRecoveryDrill(testCompanyId);

    expect(result.passed).toBe(true);
    expect(result.details.reclaimedBy).toContain('worker-survivor');
    expect(result.details.rowVersionAfterReclaim).toBeGreaterThan(1);
  });

  it('Chaos Drill 2 (Poison Pill): unhandled worker failure routes to dead_letters without stalling the queue', async () => {
    const result = await chaosEngine.runPoisonPillIsolationDrill();

    expect(result.passed).toBe(true);
    expect(result.details.deadLettersCount).toBe(1);
    expect(result.details.capturedError).toContain('POISON_PILL_FAILURE');
    expect(result.details.batchProcessedCount).toBeGreaterThanOrEqual(1);
  });

  it('Chaos Drill 3 (Idempotency Bombardment): 10 concurrent identical draft requests result in exactly 1 persisted row', async () => {
    const result = await chaosEngine.runIdempotencyBombardmentDrill(testCandidateId, testJobId);

    expect(result.passed).toBe(true);
    expect(result.details.uniqueReturnedIds).toBe(1);
    expect(result.details.persistedRowCount).toBe(1);
  });
});
