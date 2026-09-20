import { describe, it, expect } from 'vitest';
import { sql } from '../db/index.js';
import { coverLetterEngine } from './cover-letter.js';
import { DiscoveryService } from '../discovery/service.js';
import { DeduplicationEngine } from '../jobs/dedup.js';
import { RequirementsService } from '../jobs/requirements.js';

describe('Phase 3.4: Cover Letter Engine & Immutable Versioning', () => {
  it('generates grounded cover letter with company sources and candidate citations', async () => {
    if (!sql) {
      console.warn('Skipping test: No database connection');
      return;
    }

    const discoveryService = new DiscoveryService();
    const dedupEngine = new DeduplicationEngine();
    const reqService = new RequirementsService();

    // 1. Setup Candidate Profile & Verified Facts
    const [candidate] = await sql<{ id: string }[]>`
      INSERT INTO profile.candidate_profiles (full_name, email)
      VALUES ('Aarav Mehta', ${`aarav-${Date.now()}@example.com`})
      RETURNING id
    `;

    const [fact1] = await sql<{ id: string }[]>`
      INSERT INTO profile.candidate_facts (candidate_id, category, statement, verified)
      VALUES (${candidate.id}, 'skill', 'Architected multi-tenant SaaS backends using Node.js and PostgreSQL.', true)
      RETURNING id
    `;

    // 2. Setup Company with Domain and Career Page
    const domain = `fintech-${Date.now()}.com`;
    const company = await discoveryService.registerCompany({
      name: `FinTech Global ${Date.now()}`,
      domain,
    });

    await sql`
      INSERT INTO discovery.career_pages (company_id, url, page_class)
      VALUES (${company.id}, ${`https://${domain}/careers`}, 'job-list')
    `;

    // 3. Setup Job & Requirements
    const [src] = await sql<{ id: string }[]>`
      INSERT INTO ingest.job_sources (company_id, connector, base_url)
      VALUES (${company.id}, 'generic', 'https://fintechglobal.com/careers')
      RETURNING id
    `;

    const job = await dedupEngine.processJob({
      sourceId: src.id,
      companyId: company.id,
      externalId: `CL-JOB-${Date.now()}`,
      sourceUrl: 'https://fintechglobal.com/job/lead-1',
      applyUrl: 'https://fintechglobal.com/apply/lead-1',
      title: 'Lead Backend Engineer',
      description: 'Requirements: Deep knowledge of Node.js and PostgreSQL required.',
    });

    await reqService.processJobRequirements(
      job.canonicalJobId,
      'Requirements: Deep knowledge of Node.js and PostgreSQL required.'
    );

    // 4. Generate Version 1
    const v1Result = await coverLetterEngine.generateCoverLetter({
      candidateId: candidate.id,
      jobId: job.canonicalJobId,
    });

    expect(v1Result.coverLetterId).toBeDefined();
    expect(v1Result.versionId).toBeDefined();
    expect(v1Result.versionNo).toBe(1);
    expect(v1Result.markdownContent).toContain('FinTech Global');
    expect(v1Result.markdownContent).toContain(fact1.id);
    expect(v1Result.companyFactSources.length).toBeGreaterThanOrEqual(1);
    expect(v1Result.companyFactSources[0].sourceUrl).toContain(domain);

    // 5. Verify Database State
    const [clVersionRow] = await sql<{
      cover_letter_id: string;
      version_no: number;
      parent_version_id: string | null;
      job_id: string;
      company_fact_sources: any;
    }[]>`
      SELECT cover_letter_id, version_no, parent_version_id, job_id, company_fact_sources
      FROM docs.cover_letter_versions
      WHERE id = ${v1Result.versionId}
    `;
    expect(clVersionRow.cover_letter_id).toBe(v1Result.coverLetterId);
    expect(clVersionRow.version_no).toBe(1);
    expect(clVersionRow.parent_version_id).toBeNull();
    expect(clVersionRow.job_id).toBe(job.canonicalJobId);

    // 6. Generate Version 2 (Revision) for same container
    const v2Result = await coverLetterEngine.generateCoverLetter({
      candidateId: candidate.id,
      jobId: job.canonicalJobId,
      coverLetterTitle: `Cover Letter - ${company.name} (Lead Backend Engineer)`,
    });

    expect(v2Result.coverLetterId).toBe(v1Result.coverLetterId);
    expect(v2Result.versionNo).toBe(2);

    const [v2Row] = await sql<{
      parent_version_id: string;
      version_no: number;
    }[]>`
      SELECT parent_version_id, version_no
      FROM docs.cover_letter_versions
      WHERE id = ${v2Result.versionId}
    `;
    expect(v2Row.parent_version_id).toBe(v1Result.versionId);
    expect(v2Row.version_no).toBe(2);

    // 7. Verify Outbox Event Emitted
    const outboxRows = await sql<{ id: string; payload: any }[]>`
      SELECT id, payload
      FROM platform.outbox_events
      WHERE entity_refs->>'versionId' = ${v2Result.versionId}
        AND type = 'CoverLetterGenerated'
    `;
    expect(outboxRows.length).toBe(1);
    expect(outboxRows[0].payload.versionNo).toBe(2);
    expect(outboxRows[0].payload.factsCitedCount).toBeGreaterThanOrEqual(1);
  });
});
