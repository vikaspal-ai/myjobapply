import { describe, it, expect } from 'vitest';
import { sql } from '../db/index.js';
import { answerMemoryService } from './answer-memory.js';
import { autoFillService } from './autofill.js';
import { formInspector } from './form-inspector.js';
import { DiscoveryService } from '../discovery/service.js';
import { DeduplicationEngine } from '../jobs/dedup.js';
import { masterTemplateEngine } from '../docs/master.js';
import { pdfCompiler } from '../docs/compiler.js';
import { renderLatexResume } from '../docs/latex.js';

describe('Phase 4.2: Answer Memory & Auto-Fill Service', () => {
  it('resolves answers and maps dropdown options accurately', async () => {
    if (!sql) {
      console.warn('Skipping test: No database connection');
      return;
    }

    const [cand] = await sql<{ id: string }[]>`
      INSERT INTO profile.candidate_profiles (full_name, email)
      VALUES ('Memory Tester', ${`memtest-${Date.now()}@example.com`})
      RETURNING id
    `;

    // 1. Store verified answers
    await answerMemoryService.saveAnswer({
      candidateId: cand.id,
      questionPattern: 'require sponsorship',
      answerText: 'No',
      category: 'sponsorship',
      verified: true,
    });

    await answerMemoryService.saveAnswer({
      candidateId: cand.id,
      questionPattern: 'notice period',
      answerText: '2 weeks',
      category: 'notice_period',
      verified: true,
    });

    // 2. Resolve sponsorship with dropdown options
    const resolvedSponsorship = await answerMemoryService.resolveAnswer(cand.id, {
      name: 'sponsorship',
      label: 'Will you now or in the future require visa sponsorship?',
      standardCategory: 'sponsorship',
      options: [
        { label: 'Yes', value: 'yes_visa' },
        { label: 'No', value: 'no_visa' },
      ],
    });

    expect(resolvedSponsorship.source).toBe('ANSWER_MEMORY');
    expect(resolvedSponsorship.optionValue).toBe('no_visa');

    // 3. Sensitive question with NO stored answer triggers safety pause (NEEDS_HUMAN_ANSWER)
    const resolvedAuth = await answerMemoryService.resolveAnswer(cand.id, {
      name: 'security_clearance',
      label: 'Do you hold an active top secret security clearance?',
      standardCategory: 'work_authorization',
    });

    expect(resolvedAuth.source).toBe('NEEDS_HUMAN_ANSWER');
    expect(resolvedAuth.answerText).toBeUndefined();
  });

  it('auto-fills inspected form with candidate profile, resume artifact, and verified answers', async () => {
    if (!sql) {
      console.warn('Skipping test: No database connection');
      return;
    }

    const discoveryService = new DiscoveryService();
    const dedupEngine = new DeduplicationEngine();

    // 1. Setup Candidate
    const [candidate] = await sql<{ id: string }[]>`
      INSERT INTO profile.candidate_profiles (full_name, email)
      VALUES ('Rohan Gupta', ${`rohan-${Date.now()}@example.com`})
      RETURNING id
    `;

    const [fact] = await sql<{ id: string }[]>`
      INSERT INTO profile.candidate_facts (candidate_id, category, statement, verified)
      VALUES (${candidate.id}, 'skill', 'TypeScript microservice architecture', true)
      RETURNING id
    `;

    // 2. Setup Master Resume & Compiled PDF Artifact
    const master = await masterTemplateEngine.createMasterResume(
      candidate.id,
      'Rohan Master Resume',
      {
        contact: { fullName: 'Rohan Gupta', email: 'rohan@example.com' },
        summary: 'Senior Backend Engineer',
        skills: [{ category: 'Languages', skills: ['TypeScript'], factIds: [fact.id] }],
        experience: [],
        projects: [],
        education: [],
      }
    );

    const latex = renderLatexResume(
      {
        contact: { fullName: 'Rohan Gupta', email: 'rohan@example.com' },
        summary: 'Senior Backend Engineer',
        skills: [{ category: 'Languages', skills: ['TypeScript'], factIds: [fact.id] }],
        experience: [],
        projects: [],
        education: [],
      },
      { factIds: [fact.id], sectionOrder: ['summary', 'skills'], templateName: 'modern-deedy' }
    );

    await pdfCompiler.compileAndStore(latex, master.versionId);

    // 3. Setup Job
    const company = await discoveryService.registerCompany({
      name: `AutoFill Tech ${Date.now()}`,
      domain: `autofill-${Date.now()}.com`,
    });

    const [src] = await sql<{ id: string }[]>`
      INSERT INTO ingest.job_sources (company_id, connector, base_url)
      VALUES (${company.id}, 'generic', 'https://autofilltech.com/careers')
      RETURNING id
    `;

    const job = await dedupEngine.processJob({
      sourceId: src.id,
      companyId: company.id,
      externalId: `AUTOFILL-JOB-${Date.now()}`,
      sourceUrl: 'https://autofilltech.com/job/1',
      applyUrl: 'https://autofilltech.com/apply/1',
      title: 'Backend Engineer',
      description: 'Senior engineer role.',
    });

    // 4. Save Verified Answers
    await answerMemoryService.saveAnswer({
      candidateId: candidate.id,
      questionPattern: 'sponsorship',
      answerText: 'No',
      category: 'sponsorship',
      verified: true,
    });

    // 5. Inspect HTML Form
    const sampleHtml = `
      <form id="apply_form" action="/apply">
        <label for="first_name">First Name</label>
        <input type="text" id="first_name" name="first_name" required>

        <label for="last_name">Last Name</label>
        <input type="text" id="last_name" name="last_name" required>

        <label for="email">Email</label>
        <input type="email" id="email" name="email" required>

        <label for="resume">Resume</label>
        <input type="file" id="resume" name="resume" required>

        <label for="sponsorship">Require Sponsorship?</label>
        <select id="sponsorship" name="sponsorship" required>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </form>
    `;
    const formResult = formInspector.inspectForm(sampleHtml);

    // 6. Execute Auto-Fill
    const fillResult = await autoFillService.fillForm({
      candidateId: candidate.id,
      jobId: job.canonicalJobId,
      form: formResult,
      resumeVersionId: master.versionId,
    });

    expect(fillResult.canSubmit).toBe(true);
    expect(fillResult.unresolvedFields.length).toBe(0);

    const fNameField = fillResult.filledFields.find((f) => f.field.name === 'first_name');
    expect(fNameField?.value).toBe('Rohan');
    expect(fNameField?.source).toBe('CANDIDATE_PROFILE');

    const lNameField = fillResult.filledFields.find((f) => f.field.name === 'last_name');
    expect(lNameField?.value).toBe('Gupta');

    const emailField = fillResult.filledFields.find((f) => f.field.name === 'email');
    expect(emailField?.value).toContain('@example.com');

    const resumeField = fillResult.filledFields.find((f) => f.field.name === 'resume');
    expect(resumeField?.value).toContain('artifacts/resumes/');
    expect(resumeField?.source).toBe('RESUME_ARTIFACT');

    const spField = fillResult.filledFields.find((f) => f.field.name === 'sponsorship');
    expect(spField?.value).toBe('no');
    expect(spField?.source).toBe('ANSWER_MEMORY');
  });

  it('triggers safety pause when required custom question is unanswerable', async () => {
    if (!sql) {
      console.warn('Skipping test: No database connection');
      return;
    }

    const [candidate] = await sql<{ id: string }[]>`
      INSERT INTO profile.candidate_profiles (full_name, email)
      VALUES ('Safety Tester', ${`safety-${Date.now()}@example.com`})
      RETURNING id
    `;

    const formResult = formInspector.inspectForm(`
      <form>
        <input type="email" name="email" value="test@test.com" required>
        <label>Provide your government security clearance level *</label>
        <textarea name="clearance_details" required></textarea>
      </form>
    `);

    const result = await autoFillService.fillForm({
      candidateId: candidate.id,
      jobId: '00000000-0000-0000-0000-000000000000',
      form: formResult,
    });

    expect(result.canSubmit).toBe(false);
    expect(result.pauseReason).toBe('NEEDS_HUMAN_ANSWER');
    expect(result.unresolvedFields.length).toBe(1);
    expect(result.unresolvedFields[0].name).toBe('clearance_details');
  });
});
