import { createHash, randomUUID } from 'crypto';
import { sql, emitOutboxEvent } from '../db/index.js';
import { MasterResumeData, ResumePlan, ArtifactRecord } from './types.js';

export class MasterTemplateEngine {
  /**
   * Saves an artifact (PDF or source document) with SHA-256 deduplication.
   */
  async saveArtifact(
    content: Buffer | string,
    mimeType: string,
    pathPrefix = 'artifacts/resumes'
  ): Promise<ArtifactRecord> {
    if (!sql) throw new Error('Database client not initialized');

    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf-8');
    const contentHash = createHash('sha256').update(buffer).digest('hex');
    const extension = mimeType === 'application/pdf' ? 'pdf' : mimeType === 'text/markdown' ? 'md' : 'json';
    const storagePath = `${pathPrefix}/${contentHash.slice(0, 16)}.${extension}`;
    const sizeBytes = buffer.length;

    const [row] = await sql<ArtifactRecord[]>`
      INSERT INTO docs.artifacts (
        content_hash,
        mime_type,
        storage_path,
        size_bytes
      ) VALUES (
        ${contentHash},
        ${mimeType},
        ${storagePath},
        ${sizeBytes}
      )
      ON CONFLICT (content_hash) DO UPDATE SET
        mime_type = EXCLUDED.mime_type
      RETURNING id, content_hash as "contentHash", mime_type as "mimeType", storage_path as "storagePath", size_bytes as "sizeBytes"
    `;

    return row;
  }

  /**
   * Initializes a Candidate's Master Resume and records Version 1 (Root Master).
   */
  async createMasterResume(
    candidateId: string,
    title: string,
    data: MasterResumeData,
    templateName = 'modern-deedy'
  ): Promise<{ resumeId: string; versionId: string; artifactId: string; contentHash: string }> {
    if (!sql) throw new Error('Database client not initialized');

    // Extract all fact IDs cited in master resume data
    const allFactIds: string[] = [];
    for (const exp of data.experience) {
      for (const b of exp.bullets) {
        if (b.factId) allFactIds.push(b.factId);
      }
    }
    for (const sk of data.skills) {
      if (sk.factIds) allFactIds.push(...sk.factIds);
    }
    for (const proj of data.projects) {
      for (const b of proj.bullets) {
        if (b.factId) allFactIds.push(b.factId);
      }
    }

    const masterPlan: ResumePlan = {
      factIds: Array.from(new Set(allFactIds)),
      sectionOrder: ['summary', 'skills', 'experience', 'projects', 'education'],
      templateName,
    };

    const serializedContent = JSON.stringify(data, null, 2);
    const artifact = await this.saveArtifact(serializedContent, 'application/json', 'artifacts/masters');

    return await sql.begin(async (tx) => {
      // 1. Create Resume container
      const [resume] = await tx<{ id: string }[]>`
        INSERT INTO docs.resumes (
          candidate_id,
          title,
          is_master
        ) VALUES (
          ${candidateId},
          ${title},
          true
        )
        RETURNING id
      `;

      // 2. Create Master Version 1
      const [version] = await tx<{ id: string }[]>`
        INSERT INTO docs.resume_versions (
          resume_id,
          parent_version_id,
          job_id,
          version_no,
          content_hash,
          plan,
          template_name,
          artifact_id
        ) VALUES (
          ${resume.id},
          null,
          null,
          1,
          ${artifact.contentHash},
          ${tx.json(masterPlan as any)},
          ${templateName},
          ${artifact.id}
        )
        RETURNING id
      `;

      // 3. Emit Outbox Event
      await emitOutboxEvent(tx, {
        type: 'MasterResumeCreated',
        producer: 'document-engine',
        correlationId: randomUUID(),
        idempotencyKey: `resume:${resume.id}:v1`,
        entityRefs: {
          candidateId,
          resumeId: resume.id,
          versionId: version.id,
          artifactId: artifact.id,
        },
        payload: {
          title,
          versionNo: 1,
          contentHash: artifact.contentHash,
          factCount: masterPlan.factIds.length,
        },
      });

      return {
        resumeId: resume.id,
        versionId: version.id,
        artifactId: artifact.id,
        contentHash: artifact.contentHash,
      };
    });
  }

  /**
   * Creates an immutable tailored resume version tied to an exact canonical job.
   */
  async createTailoredVersion(params: {
    resumeId: string;
    parentVersionId: string;
    jobId: string;
    versionNo: number;
    plan: ResumePlan;
    renderedSource: string;
    pdfArtifactId?: string;
  }): Promise<{ versionId: string; contentHash: string }> {
    if (!sql) throw new Error('Database client not initialized');

    const contentHash = createHash('sha256').update(params.renderedSource).digest('hex');

    return await sql.begin(async (tx) => {
      const [version] = await tx<{ id: string }[]>`
        INSERT INTO docs.resume_versions (
          resume_id,
          parent_version_id,
          job_id,
          version_no,
          content_hash,
          plan,
          template_name,
          artifact_id
        ) VALUES (
          ${params.resumeId},
          ${params.parentVersionId},
          ${params.jobId},
          ${params.versionNo},
          ${contentHash},
          ${tx.json(params.plan as any)},
          ${params.plan.templateName},
          ${params.pdfArtifactId ?? null}
        )
        RETURNING id
      `;

      await emitOutboxEvent(tx, {
        type: 'ResumeVersionCreated',
        producer: 'document-engine',
        correlationId: randomUUID(),
        idempotencyKey: `resume:${params.resumeId}:v${params.versionNo}`,
        entityRefs: {
          resumeId: params.resumeId,
          versionId: version.id,
          jobId: params.jobId,
        },
        payload: {
          versionNo: params.versionNo,
          contentHash,
          factCount: params.plan.factIds.length,
          templateName: params.plan.templateName,
        },
      });

      return {
        versionId: version.id,
        contentHash,
      };
    });
  }
}

export const masterTemplateEngine = new MasterTemplateEngine();
