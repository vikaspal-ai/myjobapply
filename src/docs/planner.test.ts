import { describe, it, expect } from 'vitest';
import { sql } from '../db/index.js';
import { claimCheckValidator } from './claim-check.js';
import { resumePlanner } from './planner.js';
import { masterTemplateEngine } from './master.js';
import { DiscoveryService } from '../discovery/service.js';
import { DeduplicationEngine } from '../jobs/dedup.js';
import { RequirementsService } from '../jobs/requirements.js';
import { CandidateFact } from '../jobs/matching.js';
import { MasterResumeData, ResumePlan } from './types.js';

describe('Phase 3.2: Anti-Fabrication Claim-Check Validator & Resume Planner', () => {
  const candidateId = 'cand-uuid-101';
  const otherCandidateId = 'cand-uuid-999';

  const verifiedFacts: CandidateFact[] = [
    {
      id: 'fact-001',
      candidateId,
      category: 'skill',
      statement: 'Designed distributed services in TypeScript handling 50k requests per second.',
      verified: true,
    },
    {
      id: 'fact-002',
      candidateId,
      category: 'skill',
      statement: 'Optimized PostgreSQL queries achieving 99.9% cache hit ratio.',
      verified: true,
    },
    {
      id: 'fact-003',
      candidateId,
      category: 'skill',
      statement: 'Unverified claim about AI model fine-tuning.',
      verified: false, // NOT verified!
    },
    {
      id: 'fact-004',
      candidateId: otherCandidateId, // Belongs to another candidate!
      category: 'skill',
      statement: 'Led a team of 10 engineers at Big Tech.',
      verified: true,
    },
  ];

  describe('ClaimCheckValidator Unit Rules', () => {
    it('accepts a valid plan citing only candidate verified facts', () => {
      const plan: ResumePlan = {
        factIds: ['fact-001', 'fact-002'],
        sectionOrder: ['skills', 'experience', 'projects', 'education'],
        templateName: 'modern-deedy',
      };

      const result = claimCheckValidator.validatePlan(candidateId, plan, verifiedFacts);
      expect(result.valid).toBe(true);
      expect(result.violations.length).toBe(0);
    });

    it('rejects plan citing an unknown fact ID', () => {
      const plan: ResumePlan = {
        factIds: ['fact-001', 'fact-non-existent'],
        sectionOrder: ['skills', 'experience'],
        templateName: 'modern-deedy',
      };

      const result = claimCheckValidator.validatePlan(candidateId, plan, verifiedFacts);
      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.type === 'UNKNOWN_FACT_ID')).toBe(true);
    });

    it('rejects plan citing an unverified fact', () => {
      const plan: ResumePlan = {
        factIds: ['fact-001', 'fact-003'], // fact-003 has verified: false
        sectionOrder: ['skills', 'experience'],
        templateName: 'modern-deedy',
      };

      const result = claimCheckValidator.validatePlan(candidateId, plan, verifiedFacts);
      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.type === 'UNVERIFIED_FACT')).toBe(true);
    });

    it('rejects plan citing another candidate fact ID', () => {
      const plan: ResumePlan = {
        factIds: ['fact-001', 'fact-004'], // fact-004 belongs to other candidate
        sectionOrder: ['skills', 'experience'],
        templateName: 'modern-deedy',
      };

      const result = claimCheckValidator.validatePlan(candidateId, plan, verifiedFacts);
      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.type === 'FACT_CANDIDATE_MISMATCH')).toBe(true);
    });

    it('rejects resume bullet that hallucinates or exaggerates metrics', () => {
      const data: MasterResumeData = {
        contact: { fullName: 'Alex', email: 'alex@example.com' },
        summary: 'Engineer',
        skills: [
          {
            category: 'Languages',
            skills: ['TypeScript'],
            factIds: ['fact-001'],
          },
        ],
        experience: [
          {
            company: 'Tech Corp',
            role: 'Senior Engineer',
            startDate: '2022-01',
            bullets: [
              {
                // Fact-001 actually says 50k, but bullet claims 500k!
                text: 'Designed distributed services in TypeScript handling 500k requests per second.',
                factId: 'fact-001',
              },
            ],
          },
        ],
        projects: [],
        education: [],
      };

      const result = claimCheckValidator.validateData(candidateId, data, verifiedFacts);
      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.type === 'TEXT_HALLUCINATION')).toBe(true);
      expect(result.violations[0].details).toContain('500k');
    });

    it('rejects resume bullet with missing factId citation', () => {
      const data: MasterResumeData = {
        contact: { fullName: 'Alex', email: 'alex@example.com' },
        summary: 'Engineer',
        skills: [{ category: 'Languages', skills: ['TypeScript'], factIds: ['fact-001'] }],
        experience: [
          {
            company: 'Tech Corp',
            role: 'Senior Engineer',
            startDate: '2022-01',
            bullets: [
              {
                text: 'Invented completely ungrounded project bullet with no citation.',
                factId: '', // Missing fact citation!
              },
            ],
          },
        ],
        projects: [],
        education: [],
      };

      const result = claimCheckValidator.validateData(candidateId, data, verifiedFacts);
      expect(result.valid).toBe(false);
      expect(result.violations.some((v) => v.type === 'MISSING_CITATION')).toBe(true);
    });
  });

  describe('ResumePlanner Live Integration', () => {
    it('generates a verified tailored resume plan persisted to Supabase with outbox event', async () => {
      if (!sql) {
        console.warn('Skipping test: No database connection');
        return;
      }

      const discoveryService = new DiscoveryService();
      const dedupEngine = new DeduplicationEngine();
      const reqService = new RequirementsService();

      // 1. Create Candidate Profile & Verified Facts
      const [candidate] = await sql<{ id: string }[]>`
        INSERT INTO profile.candidate_profiles (full_name, email)
        VALUES ('Priya Sharma', ${`priya-${Date.now()}@example.com`})
        RETURNING id
      `;

      const [fact1] = await sql<{ id: string }[]>`
        INSERT INTO profile.candidate_facts (candidate_id, category, statement, verified)
        VALUES (${candidate.id}, 'skill', 'Implemented GraphQL backend using TypeScript and Node.js.', true)
        RETURNING id
      `;

      const [fact2] = await sql<{ id: string }[]>`
        INSERT INTO profile.candidate_facts (candidate_id, category, statement, verified)
        VALUES (${candidate.id}, 'skill', 'Designed scalable relational databases in PostgreSQL with read replicas.', true)
        RETURNING id
      `;

      // 2. Create Master Resume v1
      const master = await masterTemplateEngine.createMasterResume(
        candidate.id,
        'Priya Master Resume',
        {
          contact: { fullName: 'Priya Sharma', email: 'priya@example.com' },
          summary: 'Senior Backend Engineer',
          skills: [
            {
              category: 'Backend',
              skills: ['TypeScript', 'GraphQL', 'PostgreSQL'],
              factIds: [fact1.id, fact2.id],
            },
          ],
          experience: [
            {
              company: 'Platform Systems Ltd',
              role: 'Senior Backend Engineer',
              startDate: '2021-06',
              bullets: [
                {
                  text: 'Implemented GraphQL backend using TypeScript and Node.js.',
                  factId: fact1.id,
                },
                {
                  text: 'Designed scalable relational databases in PostgreSQL with read replicas.',
                  factId: fact2.id,
                },
              ],
            },
          ],
          projects: [],
          education: [
            {
              institution: 'IIT Delhi',
              degree: 'B.Tech Computer Science',
              graduationDate: '2019-05',
            },
          ],
        }
      );

      // 3. Create Target Company & Job with Requirements
      const company = await discoveryService.registerCompany({
        name: `Planner Target Co ${Date.now()}`,
        domain: `plannertarget-${Date.now()}.com`,
      });

      const [src] = await sql<{ id: string }[]>`
        INSERT INTO ingest.job_sources (company_id, connector, base_url)
        VALUES (${company.id}, 'generic', 'https://plannertarget.com/careers')
        RETURNING id
      `;

      const job = await dedupEngine.processJob({
        sourceId: src.id,
        companyId: company.id,
        externalId: `PLANNER-JOB-${Date.now()}`,
        sourceUrl: 'https://plannertarget.com/job/backend-1',
        applyUrl: 'https://plannertarget.com/apply/backend-1',
        title: 'Senior Backend Engineer (TypeScript & PostgreSQL)',
        description: 'Requirements: 4+ years with TypeScript and PostgreSQL required.',
      });

      await reqService.processJobRequirements(
        job.canonicalJobId,
        'Requirements: 4+ years with TypeScript and PostgreSQL required.'
      );

      // 4. Plan Tailored Resume
      const planResult = await resumePlanner.planTailoredResume({
        candidateId: candidate.id,
        jobId: job.canonicalJobId,
        resumeId: master.resumeId,
        templateName: 'modern-deedy',
        maxBulletsPerRole: 2,
      });

      expect(planResult.versionId).toBeDefined();
      expect(planResult.draft).toBeDefined();
      expect(planResult.draft.plan.factIds).toContain(fact1.id);
      expect(planResult.draft.plan.factIds).toContain(fact2.id);
      expect(planResult.draft.plan.highlightedSkills).toContain('typescript');

      // 5. Verify Database State in docs.resume_versions
      const [versionRow] = await sql<{
        version_no: number;
        parent_version_id: string;
        job_id: string;
        plan: any;
      }[]>`
        SELECT version_no, parent_version_id, job_id, plan
        FROM docs.resume_versions
        WHERE id = ${planResult.versionId}
      `;

      expect(versionRow.version_no).toBe(2);
      expect(versionRow.parent_version_id).toBe(master.versionId);
      expect(versionRow.job_id).toBe(job.canonicalJobId);
      expect(versionRow.plan.factIds.length).toBeGreaterThanOrEqual(2);

      // 6. Verify Outbox Event Emitted
      const outboxRows = await sql<{ id: string; payload: any }[]>`
        SELECT id, payload
        FROM platform.outbox_events
        WHERE entity_refs->>'versionId' = ${planResult.versionId}
          AND type = 'ResumeVersionCreated'
      `;
      expect(outboxRows.length).toBe(1);
      expect(outboxRows[0].payload.versionNo).toBe(2);
    });
  });
});
