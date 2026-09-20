import { describe, it, expect } from 'vitest';
import { sql } from '../db/index.js';
import { formInspector } from './form-inspector.js';
import { DiscoveryService } from '../discovery/service.js';
import { DeduplicationEngine } from '../jobs/dedup.js';

describe('Phase 4.1: Form Inspection Engine & Apply Database Schema', () => {
  describe('Form Inspector HTML Classification', () => {
    it('inspects Greenhouse application form and classifies standard fields & uploads', () => {
      const greenhouseHtml = `
        <!DOCTYPE html>
        <html>
          <body>
            <div id="app-body">
              <form id="application_form" action="/jobs/12345/apply" method="POST" enctype="multipart/form-data">
                <input type="hidden" name="gh_jid" value="12345">
                
                <div class="field">
                  <label for="first_name">First Name *</label>
                  <input type="text" id="first_name" name="first_name" required>
                </div>

                <div class="field">
                  <label for="last_name">Last Name *</label>
                  <input type="text" id="last_name" name="last_name" required>
                </div>

                <div class="field">
                  <label for="email">Email *</label>
                  <input type="email" id="email" name="email" required>
                </div>

                <div class="field">
                  <label for="phone">Phone</label>
                  <input type="tel" id="phone" name="phone">
                </div>

                <div class="field">
                  <label for="resume">Resume/CV *</label>
                  <input type="file" id="resume" name="job_application[resume]" required>
                </div>

                <div class="field">
                  <label for="cover_letter">Cover Letter</label>
                  <input type="file" id="cover_letter" name="job_application[cover_letter]">
                </div>

                <div class="field">
                  <label for="question_101">Why are you interested in this role?</label>
                  <textarea id="question_101" name="job_application[answers][101]"></textarea>
                </div>

                <button type="submit">Submit Application</button>
              </form>
            </div>
          </body>
        </html>
      `;

      const result = formInspector.inspectForm(greenhouseHtml);

      expect(result.detectedAts).toBe('Greenhouse');
      expect(result.hasResumeUpload).toBe(true);
      expect(result.hasCoverLetterUpload).toBe(true);

      const fName = result.fields.find((f) => f.standardCategory === 'first_name');
      expect(fName?.name).toBe('first_name');
      expect(fName?.required).toBe(true);

      const email = result.fields.find((f) => f.standardCategory === 'email');
      expect(email?.type).toBe('email');

      const custom = result.customQuestions;
      expect(custom.length).toBe(1);
      expect(custom[0].label).toContain('Why are you interested');
      expect(custom[0].type).toBe('textarea');
    });

    it('inspects Lever application form and classifies sponsorship dropdown', () => {
      const leverHtml = `
        <html>
          <body class="lever-form">
            <form id="lever-application" action="https://jobs.lever.co/acme/apply">
              <label>Full Name
                <input type="text" name="name" required>
              </label>

              <label>Email
                <input type="email" name="email" required>
              </label>

              <label>LinkedIn Profile
                <input type="text" name="urls[LinkedIn]">
              </label>

              <label>Will you now or in the future require visa sponsorship?
                <select name="sponsorship" required>
                  <option value="">-- Select --</option>
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </label>
            </form>
          </body>
        </html>
      `;

      const result = formInspector.inspectForm(leverHtml);

      expect(result.detectedAts).toBe('Lever');

      const sponsorshipField = result.fields.find((f) => f.standardCategory === 'sponsorship');
      expect(sponsorshipField).toBeDefined();
      expect(sponsorshipField?.type).toBe('select');
      expect(sponsorshipField?.required).toBe(true);
      expect(sponsorshipField?.options?.map((o) => o.value)).toContain('no');
      expect(sponsorshipField?.options?.map((o) => o.value)).toContain('yes');

      const linkedinField = result.fields.find((f) => f.standardCategory === 'linkedin');
      expect(linkedinField).toBeDefined();
    });
  });

  describe('Database Persistence (apply.* Schema in Supabase)', () => {
    it('persists applications, candidate answers, and application runs in Supabase', async () => {
      if (!sql) {
        console.warn('Skipping test: No database connection');
        return;
      }

      const discoveryService = new DiscoveryService();
      const dedupEngine = new DeduplicationEngine();

      // 1. Setup Candidate
      const [candidate] = await sql<{ id: string }[]>`
        INSERT INTO profile.candidate_profiles (full_name, email)
        VALUES ('Apply Test Candidate', ${`apply-${Date.now()}@example.com`})
        RETURNING id
      `;

      // 2. Setup Company & Canonical Job
      const company = await discoveryService.registerCompany({
        name: `Apply Test Co ${Date.now()}`,
        domain: `applytest-${Date.now()}.com`,
      });

      const [src] = await sql<{ id: string }[]>`
        INSERT INTO ingest.job_sources (company_id, connector, base_url)
        VALUES (${company.id}, 'generic', 'https://applytest.com/careers')
        RETURNING id
      `;

      const job = await dedupEngine.processJob({
        sourceId: src.id,
        companyId: company.id,
        externalId: `APPLY-JOB-${Date.now()}`,
        sourceUrl: 'https://applytest.com/job/1',
        applyUrl: 'https://applytest.com/apply/1',
        title: 'Software Engineer',
        description: 'Frontend engineer position.',
      });

      // 3. Insert Application Record in apply.applications
      const [appRow] = await sql<{ id: string; status: string }[]>`
        INSERT INTO apply.applications (candidate_id, job_id, status)
        VALUES (${candidate.id}, ${job.canonicalJobId}, 'DRAFT')
        RETURNING id, status
      `;
      expect(appRow.id).toBeDefined();
      expect(appRow.status).toBe('DRAFT');

      // 4. Insert Verified Candidate Answer in apply.candidate_answers
      const [answerRow] = await sql<{ id: string; answer_text: string }[]>`
        INSERT INTO apply.candidate_answers (
          candidate_id,
          question_pattern,
          answer_text,
          category,
          verified
        ) VALUES (
          ${candidate.id},
          'require sponsorship',
          'No, I am authorized to work without sponsorship.',
          'sponsorship',
          true
        )
        RETURNING id, answer_text
      `;
      expect(answerRow.id).toBeDefined();
      expect(answerRow.answer_text).toContain('No');

      // 5. Insert Application Run in apply.application_runs
      const [runRow] = await sql<{ id: string; path: string; status: string }[]>`
        INSERT INTO apply.application_runs (
          application_id,
          path,
          status,
          form_data
        ) VALUES (
          ${appRow.id},
          'PLAYWRIGHT',
          'PENDING',
          ${sql.json({ first_name: 'Apply', email: 'apply@example.com' })}
        )
        RETURNING id, path, status
      `;
      expect(runRow.id).toBeDefined();
      expect(runRow.path).toBe('PLAYWRIGHT');
      expect(runRow.status).toBe('PENDING');

      // 6. Verify Unique Constraint uq_apply_candidate_job
      await expect(
        sql`
          INSERT INTO apply.applications (candidate_id, job_id, status)
          VALUES (${candidate.id}, ${job.canonicalJobId}, 'DRAFT')
        `
      ).rejects.toThrow();
    });
  });
});
