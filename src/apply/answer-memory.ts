import { sql } from '../db/index.js';
import { CandidateAnswerRecord, FormOption, StandardFieldCategory } from './types.js';

export interface ResolveAnswerResult {
  answerText?: string;
  optionValue?: string;
  confidence: number;
  source: 'ANSWER_MEMORY' | 'NEEDS_HUMAN_ANSWER';
}

export class AnswerMemoryService {
  /**
   * Saves or updates a verified candidate answer in apply.candidate_answers.
   */
  async saveAnswer(params: {
    candidateId: string;
    questionPattern: string;
    answerText: string;
    category: 'authorization' | 'sponsorship' | 'compensation' | 'notice_period' | 'demographics' | 'custom';
    verified?: boolean;
  }): Promise<CandidateAnswerRecord> {
    if (!sql) throw new Error('Database client not initialized');

    const [row] = await sql<CandidateAnswerRecord[]>`
      INSERT INTO apply.candidate_answers (
        candidate_id,
        question_pattern,
        answer_text,
        category,
        verified
      ) VALUES (
        ${params.candidateId},
        ${params.questionPattern.toLowerCase().trim()},
        ${params.answerText},
        ${params.category},
        ${params.verified ?? true}
      )
      RETURNING
        id,
        candidate_id as "candidateId",
        question_pattern as "questionPattern",
        answer_text as "answerText",
        category,
        verified
    `;

    return row;
  }

  /**
   * Resolves a question using candidate stored answers with strict sensitive question policy.
   * Authorization, sponsorship, and legal questions NEVER hallucinate—they require verified answers.
   */
  async resolveAnswer(
    candidateId: string,
    question: {
      name: string;
      label: string;
      standardCategory: StandardFieldCategory;
      options?: FormOption[];
    }
  ): Promise<ResolveAnswerResult> {
    if (!sql) throw new Error('Database client not initialized');

    const combined = `${question.name} ${question.label}`.toLowerCase();

    // 1. Fetch candidate verified answers
    const answers = await sql<CandidateAnswerRecord[]>`
      SELECT
        id,
        candidate_id as "candidateId",
        question_pattern as "questionPattern",
        answer_text as "answerText",
        category,
        verified
      FROM apply.candidate_answers
      WHERE candidate_id = ${candidateId}
        AND verified = true
    `;

    // 2. Identify candidate matches
    let matchedAnswer: CandidateAnswerRecord | undefined;

    // Check by standardCategory first
    if (question.standardCategory === 'sponsorship') {
      matchedAnswer = answers.find(
        (a) => a.category === 'sponsorship' || /sponsorship/i.test(a.questionPattern)
      );
    } else if (question.standardCategory === 'work_authorization') {
      matchedAnswer = answers.find(
        (a) => a.category === 'authorization' || /authoriz|eligible/i.test(a.questionPattern)
      );
    } else if (question.standardCategory === 'notice_period') {
      matchedAnswer = answers.find(
        (a) => a.category === 'notice_period' || /notice|start/i.test(a.questionPattern)
      );
    } else if (question.standardCategory === 'salary') {
      matchedAnswer = answers.find(
        (a) => a.category === 'compensation' || /salary|compensation/i.test(a.questionPattern)
      );
    } else {
      // General question matching by pattern
      matchedAnswer = answers.find((a) =>
        combined.includes(a.questionPattern.toLowerCase())
      );
    }

    // 3. Strict Safety Check: If sensitive question has no verified answer, trigger human pause
    const isSensitive =
      question.standardCategory === 'sponsorship' ||
      question.standardCategory === 'work_authorization' ||
      /require.*sponsorship|visa.*sponsorship|legally.*authorized/i.test(combined);

    if (!matchedAnswer) {
      if (isSensitive) {
        return {
          confidence: 0,
          source: 'NEEDS_HUMAN_ANSWER',
        };
      }
      return {
        confidence: 0,
        source: 'NEEDS_HUMAN_ANSWER',
      };
    }

    // 4. Resolve dropdown/radio option value if options are present
    let optionValue: string | undefined;
    if (question.options && question.options.length > 0) {
      optionValue = this.mapAnswerToOption(matchedAnswer.answerText, question.options);
    }

    return {
      answerText: matchedAnswer.answerText,
      optionValue,
      confidence: 0.95,
      source: 'ANSWER_MEMORY',
    };
  }

  /**
   * Maps a natural text answer (e.g. 'No', 'Yes', 'Immediately') to select/radio options.
   */
  private mapAnswerToOption(answerText: string, options: FormOption[]): string | undefined {
    const norm = answerText.toLowerCase().trim();

    // 1. Direct label or value match
    for (const opt of options) {
      if (opt.label.toLowerCase() === norm || opt.value.toLowerCase() === norm) {
        return opt.value;
      }
    }

    // 2. Boolean Yes/No heuristics
    const isNo = /\b(?:no|not|false|none|0)\b/i.test(norm);
    const isYes = /\b(?:yes|true|require|1)\b/i.test(norm) && !isNo;

    for (const opt of options) {
      const optNorm = `${opt.label} ${opt.value}`.toLowerCase();
      if (isNo && (optNorm === 'no' || optNorm === '0' || optNorm === 'false' || opt.label.toLowerCase() === 'no')) {
        return opt.value;
      }
      if (isYes && (optNorm === 'yes' || optNorm === '1' || optNorm === 'true' || opt.label.toLowerCase() === 'yes')) {
        return opt.value;
      }
    }

    // 3. Partial substring match
    for (const opt of options) {
      if (opt.label && (norm.includes(opt.label.toLowerCase()) || opt.label.toLowerCase().includes(norm))) {
        return opt.value;
      }
    }

    return undefined;
  }
}

export const answerMemoryService = new AnswerMemoryService();
