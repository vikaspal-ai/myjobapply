import { sql } from '../db/index.js';
import { answerMemoryService } from './answer-memory.js';
import {
  AutoFillResult,
  FilledFormField,
  FormField,
  FormInspectionResult,
} from './types.js';

export interface AutoFillOptions {
  candidateId: string;
  jobId: string;
  form: FormInspectionResult;
  resumeVersionId?: string;
  coverLetterVersionId?: string;
}

export class AutoFillService {
  /**
   * Automatically fills an inspected form with candidate profile facts, resume/cover letter artifacts,
   * and verified answers from answer memory. Enforces safety pauses on missing sensitive questions.
   */
  async fillForm(options: AutoFillOptions): Promise<AutoFillResult> {
    if (!sql) throw new Error('Database client not initialized');

    // 1. Fetch Candidate Profile
    const [candidate] = await sql<{ id: string; full_name: string; email: string }[]>`
      SELECT id, full_name, email
      FROM profile.candidate_profiles
      WHERE id = ${options.candidateId}
    `;

    if (!candidate) {
      throw new Error(`Candidate ${options.candidateId} not found`);
    }

    const nameParts = candidate.full_name.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

    // 2. Fetch Resume Artifact Storage Path if provided
    let resumePath: string | undefined;
    if (options.resumeVersionId) {
      const [rRow] = await sql<{ storage_path: string }[]>`
        SELECT a.storage_path
        FROM docs.resume_versions v
        JOIN docs.artifacts a ON a.id = v.artifact_id
        WHERE v.id = ${options.resumeVersionId}
      `;
      resumePath = rRow?.storage_path;
    }

    // 3. Fetch Cover Letter Artifact Storage Path if provided
    let coverLetterPath: string | undefined;
    if (options.coverLetterVersionId) {
      const [clRow] = await sql<{ storage_path: string }[]>`
        SELECT a.storage_path
        FROM docs.cover_letter_versions v
        JOIN docs.artifacts a ON a.id = v.artifact_id
        WHERE v.id = ${options.coverLetterVersionId}
      `;
      coverLetterPath = clRow?.storage_path;
    }

    // 4. Fill Each Form Field
    const filledFields: FilledFormField[] = [];
    const unresolvedFields: FormField[] = [];

    for (const field of options.form.fields) {
      if (field.type === 'hidden') continue;

      let value = '';
      let source: FilledFormField['source'] = 'NEEDS_HUMAN_ANSWER';
      let confidence = 0;

      switch (field.standardCategory) {
        case 'first_name':
          value = firstName;
          source = 'CANDIDATE_PROFILE';
          confidence = 1.0;
          break;

        case 'last_name':
          value = lastName;
          source = 'CANDIDATE_PROFILE';
          confidence = 1.0;
          break;

        case 'full_name':
          value = candidate.full_name;
          source = 'CANDIDATE_PROFILE';
          confidence = 1.0;
          break;

        case 'email':
          value = candidate.email;
          source = 'CANDIDATE_PROFILE';
          confidence = 1.0;
          break;

        case 'resume':
          if (resumePath) {
            value = resumePath;
            source = 'RESUME_ARTIFACT';
            confidence = 1.0;
          }
          break;

        case 'cover_letter':
          if (coverLetterPath) {
            value = coverLetterPath;
            source = 'COVER_LETTER_ARTIFACT';
            confidence = 1.0;
          }
          break;

        default: {
          // Resolve from Answer Memory (sponsorship, authorization, notice period, custom questions)
          const resolved = await answerMemoryService.resolveAnswer(options.candidateId, {
            name: field.name,
            label: field.label,
            standardCategory: field.standardCategory,
            options: field.options,
          });

          if (resolved.source === 'ANSWER_MEMORY') {
            value = resolved.optionValue ?? resolved.answerText ?? '';
            source = 'ANSWER_MEMORY';
            confidence = resolved.confidence;
          } else {
            source = 'NEEDS_HUMAN_ANSWER';
            confidence = 0;
          }
          break;
        }
      }

      const isFilled = value.trim().length > 0;
      if (!isFilled && field.required) {
        unresolvedFields.push(field);
      }

      filledFields.push({
        field,
        value,
        source: isFilled ? source : 'NEEDS_HUMAN_ANSWER',
        confidence: isFilled ? confidence : 0,
      });
    }

    const canSubmit = unresolvedFields.length === 0;
    const pauseReason = !canSubmit ? 'NEEDS_HUMAN_ANSWER' : undefined;

    return {
      filledFields,
      unresolvedFields,
      canSubmit,
      pauseReason,
    };
  }
}

export const autoFillService = new AutoFillService();
