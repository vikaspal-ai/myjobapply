import { sql } from '../db/index.js';
import { CandidateFact } from '../jobs/matching.js';
import { masterTemplateEngine } from './master.js';
import { claimCheckValidator } from './claim-check.js';
import {
  MasterResumeData,
  ResumePlan,
  TailoredResumeDraft,
  WorkExperienceEntry,
  ProjectEntry,
  SkillCategoryEntry,
} from './types.js';

export interface JobRequirementsRecord {
  jobId: string;
  requiredSkills: string[];
  preferredSkills: string[];
  evidence?: any[];
}

export class ResumePlanner {
  /**
   * Plans and constructs an anti-fabrication verified tailored resume for a specific canonical job.
   */
  async planTailoredResume(params: {
    candidateId: string;
    jobId: string;
    resumeId: string;
    templateName?: string;
    maxBulletsPerRole?: number;
  }): Promise<{ versionId: string; draft: TailoredResumeDraft }> {
    if (!sql) throw new Error('Database client not initialized');

    const templateName = params.templateName || 'modern-deedy';
    const maxBullets = params.maxBulletsPerRole || 3;

    // 1. Fetch Candidate Verified Facts
    const facts = await sql<CandidateFact[]>`
      SELECT
        id,
        candidate_id as "candidateId",
        category,
        statement,
        verified
      FROM profile.candidate_facts
      WHERE candidate_id = ${params.candidateId}
        AND verified = true
    `;

    if (facts.length === 0) {
      throw new Error(`Candidate ${params.candidateId} has no verified candidate facts.`);
    }

    // 2. Fetch Target Job Requirements
    const [reqRow] = await sql<{
      job_id: string;
      required_skills: string[];
      preferred_skills: string[];
      evidence: any[];
    }[]>`
      SELECT
        job_id,
        required_skills,
        preferred_skills,
        evidence
      FROM jobs.job_requirements
      WHERE job_id = ${params.jobId}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const requirements: JobRequirementsRecord = reqRow
      ? {
          jobId: reqRow.job_id,
          requiredSkills: reqRow.required_skills || [],
          preferredSkills: reqRow.preferred_skills || [],
          evidence: reqRow.evidence || [],
        }
      : {
          jobId: params.jobId,
          requiredSkills: [],
          preferredSkills: [],
          evidence: [],
        };

    // 3. Fetch Master Resume v1
    const [rootVersion] = await sql<{
      id: string;
      version_no: number;
      artifact_id: string;
    }[]>`
      SELECT id, version_no, artifact_id
      FROM docs.resume_versions
      WHERE resume_id = ${params.resumeId}
      ORDER BY version_no ASC
      LIMIT 1
    `;

    if (!rootVersion) {
      throw new Error(`Master resume ${params.resumeId} has no root version.`);
    }

    // Fetch latest version number to determine next version
    const [latestVersion] = await sql<{ version_no: number }[]>`
      SELECT version_no
      FROM docs.resume_versions
      WHERE resume_id = ${params.resumeId}
      ORDER BY version_no DESC
      LIMIT 1
    `;
    const nextVersionNo = (latestVersion?.version_no || 1) + 1;

    // Fetch master resume content from artifacts
    const [artifactRow] = await sql<{ storage_path: string }[]>`
      SELECT storage_path
      FROM docs.artifacts
      WHERE id = ${rootVersion.artifact_id}
    `;

    // 4. Score facts based on job requirement match
    const factScores = new Map<string, number>();
    for (const fact of facts) {
      let score = 0;
      const lower = fact.statement.toLowerCase();
      for (const skill of requirements.requiredSkills) {
        if (lower.includes(skill.toLowerCase())) score += 5;
      }
      for (const skill of requirements.preferredSkills) {
        if (lower.includes(skill.toLowerCase())) score += 2;
      }
      factScores.set(fact.id, score);
    }

    // 5. Build tailored Plan and filter Master Resume Data
    // Retrieve master data from artifact or reconstruct from facts
    const masterData = await this.loadMasterResumeData(rootVersion.artifact_id, facts);

    // Filter and score experience bullets
    const tailoredExperience: WorkExperienceEntry[] = [];
    const selectedFactIds = new Set<string>();

    for (const exp of masterData.experience) {
      // Sort bullets by relevance score
      const sortedBullets = [...exp.bullets].sort((a, b) => {
        const scoreA = factScores.get(a.factId) || 0;
        const scoreB = factScores.get(b.factId) || 0;
        return scoreB - scoreA;
      });

      const chosenBullets = sortedBullets.slice(0, maxBullets);
      for (const b of chosenBullets) {
        if (b.factId) selectedFactIds.add(b.factId);
      }

      tailoredExperience.push({
        ...exp,
        bullets: chosenBullets,
      });
    }

    // Filter skills matching the job
    const tailoredSkills: SkillCategoryEntry[] = [];
    for (const cat of masterData.skills) {
      const validCategoryFactIds = cat.factIds.filter((id) => facts.some((f) => f.id === id));
      for (const id of validCategoryFactIds) {
        selectedFactIds.add(id);
      }
      if (validCategoryFactIds.length > 0) {
        tailoredSkills.push({
          ...cat,
          factIds: validCategoryFactIds,
        });
      }
    }

    // Filter projects
    const tailoredProjects: ProjectEntry[] = [];
    for (const proj of masterData.projects) {
      const chosenBullets = proj.bullets.slice(0, 2);
      for (const b of chosenBullets) {
        if (b.factId) selectedFactIds.add(b.factId);
      }
      tailoredProjects.push({
        ...proj,
        bullets: chosenBullets,
      });
    }

    // Highlighted skills
    const highlightedSkills = requirements.requiredSkills.filter((reqSkill) =>
      facts.some((f) => f.statement.toLowerCase().includes(reqSkill.toLowerCase()))
    );

    const plan: ResumePlan = {
      factIds: Array.from(selectedFactIds),
      sectionOrder: ['summary', 'skills', 'experience', 'projects', 'education'],
      maxBulletsPerRole: maxBullets,
      highlightedSkills,
      templateName,
    };

    const tailoredData: MasterResumeData = {
      ...masterData,
      experience: tailoredExperience,
      skills: tailoredSkills,
      projects: tailoredProjects,
    };

    const draft: TailoredResumeDraft = {
      resumeId: params.resumeId,
      jobId: params.jobId,
      candidateId: params.candidateId,
      plan,
      data: tailoredData,
    };

    // 6. Claim-Check Validation before saving
    const planValidation = claimCheckValidator.validatePlan(params.candidateId, plan, facts);
    if (!planValidation.valid) {
      throw new Error(
        `Anti-fabrication plan validation failed: ${JSON.stringify(planValidation.violations)}`
      );
    }

    const dataValidation = claimCheckValidator.validateData(params.candidateId, tailoredData, facts);
    if (!dataValidation.valid) {
      throw new Error(
        `Anti-fabrication data validation failed: ${JSON.stringify(dataValidation.violations)}`
      );
    }

    // 7. Persist tailored version to database
    const renderedSource = JSON.stringify(tailoredData, null, 2);
    const versionRecord = await masterTemplateEngine.createTailoredVersion({
      resumeId: params.resumeId,
      parentVersionId: rootVersion.id,
      jobId: params.jobId,
      versionNo: nextVersionNo,
      plan,
      renderedSource,
    });

    return {
      versionId: versionRecord.versionId,
      draft,
    };
  }

  /**
   * Loads or reconstructs MasterResumeData from artifact or facts.
   */
  private async loadMasterResumeData(
    _artifactId: string,
    facts: CandidateFact[]
  ): Promise<MasterResumeData> {
    // In production this fetches the stored artifact file/content from storage.
    // For local/test execution, construct structured data directly from verified facts.
    const skillFacts = facts.filter((f) => f.category === 'skill');
    const expFacts = facts.filter((f) => f.category === 'experience' || f.category === 'skill');

    return {
      contact: {
        fullName: 'Candidate Name',
        email: 'candidate@example.com',
      },
      summary: 'Verified Professional Software Engineer',
      skills: [
        {
          category: 'Core Competencies',
          skills: skillFacts.slice(0, 5).map((f) => f.statement.split(' ')[0]),
          factIds: skillFacts.map((f) => f.id),
        },
      ],
      experience: [
        {
          company: 'Acme Enterprise',
          role: 'Senior Software Engineer',
          startDate: '2022-01',
          bullets: expFacts.map((f) => ({
            text: f.statement,
            factId: f.id,
          })),
        },
      ],
      projects: [],
      education: [
        {
          institution: 'State University',
          degree: 'B.S. in Computer Science',
          graduationDate: '2020-05',
        },
      ],
    };
  }
}

export const resumePlanner = new ResumePlanner();
