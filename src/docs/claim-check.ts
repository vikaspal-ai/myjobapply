import { sql } from '../db/index.js';
import { CandidateFact } from '../jobs/matching.js';
import {
  MasterResumeData,
  ResumePlan,
  ClaimCheckResult,
  ClaimViolation,
  TailoredResumeDraft,
} from './types.js';

export class ClaimCheckValidator {
  /**
   * Validates a ResumePlan ensuring all cited fact IDs are verified and belong to the candidate.
   */
  validatePlan(
    candidateId: string,
    plan: ResumePlan,
    candidateFacts: CandidateFact[]
  ): ClaimCheckResult {
    const violations: ClaimViolation[] = [];
    const factMap = new Map(candidateFacts.map((f) => [f.id, f]));

    if (!plan.factIds || plan.factIds.length === 0) {
      violations.push({
        type: 'MISSING_CITATION',
        field: 'plan.factIds',
        details: 'ResumePlan must cite at least one verified candidate fact ID.',
      });
      return { valid: false, violations };
    }

    for (const factId of plan.factIds) {
      const fact = factMap.get(factId);
      if (!fact) {
        violations.push({
          type: 'UNKNOWN_FACT_ID',
          factId,
          field: 'plan.factIds',
          details: `Fact ID ${factId} does not exist in the candidate fact repository.`,
        });
        continue;
      }

      if (fact.candidateId !== candidateId) {
        violations.push({
          type: 'FACT_CANDIDATE_MISMATCH',
          factId,
          field: 'plan.factIds',
          details: `Fact ID ${factId} belongs to candidate ${fact.candidateId}, not ${candidateId}.`,
        });
      }

      if (!fact.verified) {
        violations.push({
          type: 'UNVERIFIED_FACT',
          factId,
          field: 'plan.factIds',
          details: `Fact ID ${factId} is marked unverified. Only verified facts can be included in tailored resumes.`,
        });
      }
    }

    return {
      valid: violations.length === 0,
      violations,
    };
  }

  /**
   * Validates full MasterResumeData or Tailored Data ensuring all bullets and skills cite verified facts
   * without hallucinated metrics or numbers.
   */
  validateData(
    candidateId: string,
    data: MasterResumeData,
    candidateFacts: CandidateFact[]
  ): ClaimCheckResult {
    const violations: ClaimViolation[] = [];
    const factMap = new Map(candidateFacts.map((f) => [f.id, f]));

    // 1. Validate Work Experience Bullets
    for (let eIdx = 0; eIdx < data.experience.length; eIdx++) {
      const exp = data.experience[eIdx];
      for (let bIdx = 0; bIdx < exp.bullets.length; bIdx++) {
        const bullet = exp.bullets[bIdx];
        const field = `experience[${eIdx}].bullets[${bIdx}]`;

        if (!bullet.factId) {
          violations.push({
            type: 'MISSING_CITATION',
            field,
            details: `Bullet "${bullet.text.slice(0, 40)}..." has no factId citation.`,
          });
          continue;
        }

        const fact = factMap.get(bullet.factId);
        if (!fact) {
          violations.push({
            type: 'UNKNOWN_FACT_ID',
            factId: bullet.factId,
            field,
            details: `Fact ID ${bullet.factId} does not exist in candidate fact repository.`,
          });
          continue;
        }

        if (fact.candidateId !== candidateId) {
          violations.push({
            type: 'FACT_CANDIDATE_MISMATCH',
            factId: bullet.factId,
            field,
            details: `Fact ID ${bullet.factId} belongs to a different candidate.`,
          });
        }

        if (!fact.verified) {
          violations.push({
            type: 'UNVERIFIED_FACT',
            factId: bullet.factId,
            field,
            details: `Fact ID ${bullet.factId} is unverified.`,
          });
        }

        // Anti-Fabrication Metric Check: Check if bullet introduces numbers not present in fact
        this.verifyNumericFidelity(bullet.text, fact.statement, field, bullet.factId, violations);
      }
    }

    // 2. Validate Projects
    for (let pIdx = 0; pIdx < data.projects.length; pIdx++) {
      const proj = data.projects[pIdx];
      for (let bIdx = 0; bIdx < proj.bullets.length; bIdx++) {
        const bullet = proj.bullets[bIdx];
        const field = `projects[${pIdx}].bullets[${bIdx}]`;

        if (!bullet.factId) {
          violations.push({
            type: 'MISSING_CITATION',
            field,
            details: `Project bullet "${bullet.text.slice(0, 40)}..." has no factId citation.`,
          });
          continue;
        }

        const fact = factMap.get(bullet.factId);
        if (!fact) {
          violations.push({
            type: 'UNKNOWN_FACT_ID',
            factId: bullet.factId,
            field,
            details: `Fact ID ${bullet.factId} does not exist.`,
          });
          continue;
        }

        if (fact.candidateId !== candidateId) {
          violations.push({
            type: 'FACT_CANDIDATE_MISMATCH',
            factId: bullet.factId,
            field,
            details: `Fact ID ${bullet.factId} candidate mismatch.`,
          });
        }

        if (!fact.verified) {
          violations.push({
            type: 'UNVERIFIED_FACT',
            factId: bullet.factId,
            field,
            details: `Fact ID ${bullet.factId} is unverified.`,
          });
        }

        this.verifyNumericFidelity(bullet.text, fact.statement, field, bullet.factId, violations);
      }
    }

    // 3. Validate Skills categories
    for (let sIdx = 0; sIdx < data.skills.length; sIdx++) {
      const skillCat = data.skills[sIdx];
      const field = `skills[${sIdx}]`;

      if (!skillCat.factIds || skillCat.factIds.length === 0) {
        violations.push({
          type: 'MISSING_CITATION',
          field,
          details: `Skill category "${skillCat.category}" must cite at least one factId.`,
        });
        continue;
      }

      for (const factId of skillCat.factIds) {
        const fact = factMap.get(factId);
        if (!fact) {
          violations.push({
            type: 'UNKNOWN_FACT_ID',
            factId,
            field,
            details: `Skill category "${skillCat.category}" references unknown factId ${factId}.`,
          });
          continue;
        }

        if (fact.candidateId !== candidateId) {
          violations.push({
            type: 'FACT_CANDIDATE_MISMATCH',
            factId,
            field,
            details: `Skill category "${skillCat.category}" references factId ${factId} belonging to another candidate.`,
          });
        }

        if (!fact.verified) {
          violations.push({
            type: 'UNVERIFIED_FACT',
            factId,
            field,
            details: `Skill category "${skillCat.category}" references unverified factId ${factId}.`,
          });
        }
      }
    }

    return {
      valid: violations.length === 0,
      violations,
    };
  }

  /**
   * Validates a candidate draft directly against database facts.
   */
  async validateDraftAgainstDatabase(draft: TailoredResumeDraft): Promise<ClaimCheckResult> {
    if (!sql) throw new Error('Database client not initialized');

    const facts = await sql<CandidateFact[]>`
      SELECT
        id,
        candidate_id as "candidateId",
        category,
        statement,
        verified
      FROM profile.candidate_facts
      WHERE candidate_id = ${draft.candidateId}
    `;

    const planCheck = this.validatePlan(draft.candidateId, draft.plan, facts);
    const dataCheck = this.validateData(draft.candidateId, draft.data, facts);

    const violations = [...planCheck.violations, ...dataCheck.violations];
    return {
      valid: violations.length === 0,
      violations,
    };
  }

  /**
   * Helper: checks if numbers in the bullet (e.g. "99.99%", "50k", "10M", "300")
   * exist in the ground truth fact statement.
   */
  private verifyNumericFidelity(
    bulletText: string,
    factStatement: string,
    field: string,
    factId: string,
    violations: ClaimViolation[]
  ): void {
    // Regex matching numbers, percentages, multipliers, e.g. 50k, 99.99%, 10M, 42
    const numberRegex = /\b\d+(?:\.\d+)?(?:k|m|b|%|x)?\b/gi;
    const bulletNumbers = bulletText.toLowerCase().match(numberRegex) || [];
    const factNumbers = new Set((factStatement.toLowerCase().match(numberRegex) || []));

    for (const num of bulletNumbers) {
      if (!factNumbers.has(num)) {
        violations.push({
          type: 'TEXT_HALLUCINATION',
          factId,
          field,
          details: `Bullet claims metric or number "${num}" which does not appear in the verified ground truth statement: "${factStatement}".`,
        });
      }
    }
  }
}

export const claimCheckValidator = new ClaimCheckValidator();
