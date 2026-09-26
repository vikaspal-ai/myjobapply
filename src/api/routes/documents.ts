import type { FastifyInstance } from 'fastify';
import { sql } from '../../db/index.js';
import { supabase } from '../../db/index.js';
import { createHash } from 'crypto';
import { masterTemplateEngine } from '../../docs/master.js';
import { resumeFileParser } from '../../docs/resume-file-parser.js';

const db = sql!;

export async function documentRoutes(app: FastifyInstance) {
  // POST /api/resumes/upload - Upload resume PDF/DOCX, parse it, and create Master Resume
  app.post<{
    Body: { candidateId: string; fullName?: string; email?: string; location?: string; github?: string; linkedin?: string };
  }>('/api/resumes/upload', async (req, reply) => {
    const data = await req.file();
    if (!data) {
      return reply.code(400).send({ success: false, error: 'No file uploaded' });
    }

    // Get candidateId and optional contact info from fields
    let candidateId: string | undefined;
    let fullName: string | undefined;
    let email: string | undefined;
    let location: string | undefined;
    let github: string | undefined;
    let linkedin: string | undefined;

    if (data.fields && typeof data.fields === 'object') {
      const fields = data.fields as Record<string, { value: string }>;
      candidateId = fields.candidateId?.value;
      fullName = fields.fullName?.value;
      email = fields.email?.value;
      location = fields.location?.value;
      github = fields.github?.value;
      linkedin = fields.linkedin?.value;
    }
    if (!candidateId) {
      return reply.code(400).send({ success: false, error: 'candidateId is required' });
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(data.mimetype)) {
      return reply.code(400).send({ success: false, error: 'Only PDF and DOCX files are allowed' });
    }

    // Read file buffer
    const chunks: Buffer[] = [];
    for await (const chunk of data.file) {
      chunks.push(chunk);
    }
    const fileBuffer = Buffer.concat(chunks);

    // Parse the resume file
    let parsedFile;
    try {
      parsedFile = await resumeFileParser.parseFile(fileBuffer, data.mimetype);
    } catch (err) {
      return reply.code(400).send({ success: false, error: `Failed to parse resume: ${err instanceof Error ? err.message : 'Unknown error'}` });
    }

    const fileHash = parsedFile.fileHash;

    // Check if already uploaded (dedup by hash)
    const [existingArtifact] = await db`
      SELECT id, storage_path FROM docs.artifacts WHERE content_hash = ${fileHash}
    `;

    let artifactId: string;
    let storagePath: string;

    if (existingArtifact) {
      artifactId = existingArtifact.id;
      storagePath = existingArtifact.storage_path;
    } else {
      // Upload to Supabase Storage
      const fileName = `resumes/${candidateId}/${fileHash}.pdf`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('artifacts')
        .upload(fileName, fileBuffer, {
          contentType: 'application/pdf',
          upsert: false,
        });

      if (uploadError) {
        return reply.code(500).send({ success: false, error: uploadError.message });
      }

      storagePath = uploadData.path;

      // Create artifact record
      const [artifact] = await db`
        INSERT INTO docs.artifacts (content_hash, mime_type, storage_path, size_bytes)
        VALUES (${fileHash}, 'application/pdf', ${storagePath}, ${fileBuffer.length})
        RETURNING id
      `;
      artifactId = artifact.id;
    }

    // Get candidate info for contact
    const [candidate] = await db`
      SELECT full_name, email FROM profile.candidate_profiles WHERE id = ${candidateId}
    `;

    const contact = {
      fullName: fullName || candidate?.full_name || 'Candidate',
      email: email || candidate?.email || 'email@example.com',
      location: location || 'India',
      github,
      linkedin,
    };

    // Convert parsed data to MasterResumeData format
    const masterData = resumeFileParser.toMasterResumeData(parsedFile.parsed, contact);

    // Create Master Resume using the template engine (stores JSON artifact + LaTeX plan)
    const master = await masterTemplateEngine.createMasterResume(candidateId, 'Master Resume', masterData);

    // Also save the raw parsed text as an artifact for reference
    const textArtifact = await masterTemplateEngine.saveArtifact(
      parsedFile.rawText,
      'text/plain',
      'artifacts/resumes/raw'
    );

    return reply.code(201).send({
      success: true,
      data: {
        artifactId,
        resumeId: master.resumeId,
        versionId: master.versionId,
        versionNo: 1,
        storagePath,
        fileHash,
        parsed: {
          contact: parsedFile.parsed.contact,
          summary: parsedFile.parsed.summary,
          experience: parsedFile.parsed.experience,
          projects: parsedFile.parsed.projects,
          education: parsedFile.parsed.education,
          skills: parsedFile.parsed.skills,
          experienceYears: parsedFile.parsed.experienceYears,
          suggestedTitle: parsedFile.parsed.suggestedTitle,
          atsScore: parsedFile.parsed.atsScore,
          extractedSections: parsedFile.parsed.extractedSections,
        },
        rawText: parsedFile.rawText,
        textArtifactId: textArtifact.id,
      },
    });
  });

  // POST /api/resumes/parse-file - Parse uploaded PDF/DOCX file directly into structured data
  app.post('/api/resumes/parse-file', async (req, reply) => {
    const data = await req.file();
    if (!data) {
      return reply.code(400).send({ success: false, error: 'No file uploaded' });
    }

    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];
    if (!allowedTypes.includes(data.mimetype)) {
      return reply.code(400).send({ success: false, error: 'Only PDF, DOCX, and TXT files are allowed' });
    }

    const chunks: Buffer[] = [];
    for await (const chunk of data.file) {
      chunks.push(chunk);
    }
    const fileBuffer = Buffer.concat(chunks);

    try {
      let parsedFile;
      if (data.mimetype === 'text/plain') {
        const rawText = fileBuffer.toString('utf-8');
        const { parseResume } = await import('../../docs/resume-parser.js');
        const parsed = parseResume(rawText);
        parsedFile = {
          rawText,
          parsed,
          fileHash: createHash('sha256').update(fileBuffer).digest('hex'),
          fileType: 'pdf' as const,
        };
      } else {
        parsedFile = await resumeFileParser.parseFile(fileBuffer, data.mimetype);
      }

      return reply.send({
        success: true,
        data: {
          rawText: parsedFile.rawText,
          parsed: parsedFile.parsed,
          fileHash: parsedFile.fileHash,
        },
      });
    } catch (err) {
      return reply.code(400).send({
        success: false,
        error: `Failed to parse file: ${err instanceof Error ? err.message : 'Unknown error'}`,
      });
    }
  });

  // GET /api/resumes/parsed/:candidateId - Get parsed resume data for a candidate
  app.get<{ Params: { candidateId: string } }>('/api/resumes/parsed/:candidateId', async (req, reply) => {
    const [resume] = await db`
      SELECT rv.*, r.candidate_id, a.storage_path
      FROM docs.resume_versions rv
      JOIN docs.resumes r ON rv.resume_id = r.id
      LEFT JOIN docs.artifacts a ON rv.artifact_id = a.id
      WHERE r.candidate_id = ${req.params.candidateId} AND r.is_master = true
      ORDER BY rv.version_no DESC
      LIMIT 1
    `;

    if (!resume) {
      return reply.code(404).send({ success: false, error: 'No master resume found for candidate' });
    }

    // If the artifact is JSON, fetch and parse it
    if (resume.storage_path && resume.storage_path.endsWith('.json')) {
      const { data: artifactData, error } = await supabase.storage
        .from('artifacts')
        .download(resume.storage_path);
      
      if (!error && artifactData) {
        const text = await artifactData.text();
        try {
          const masterData = JSON.parse(text);
          return reply.send({
            success: true,
            data: {
              ...masterData,
              resumeVersionId: resume.id,
              versionNo: resume.version_no,
              templateName: resume.template_name,
            },
          });
        } catch {
          // Fall through to basic response
        }
      }
    }

    return reply.send({
      success: true,
      data: {
        resumeVersionId: resume.id,
        versionNo: resume.version_no,
        templateName: resume.template_name,
        plan: resume.plan,
      },
    });
  });

  // GET /api/resumes - List resumes for a candidate
  app.get<{
    Querystring: {
      candidateId?: string;
      jobId?: string;
    };
  }>('/api/resumes', async (req, reply) => {
    const { candidateId, jobId } = req.query;

    const rows = await db`
      SELECT 
        rv.id,
        rv.resume_id,
        rv.version_no,
        rv.parent_version_id,
        rv.job_id,
        rv.template_name,
        rv.content_hash,
        rv.plan,
        rv.created_at,
        r.title,
        r.candidate_id,
        r.is_master,
        a.storage_path,
        a.size_bytes
      FROM docs.resume_versions rv
      JOIN docs.resumes r ON rv.resume_id = r.id
      LEFT JOIN docs.artifacts a ON rv.artifact_id = a.id
      WHERE 1=1
        ${candidateId ? db`AND r.candidate_id = ${candidateId}` : db``}
        ${jobId ? db`AND rv.job_id = ${jobId}` : db``}
      ORDER BY rv.created_at DESC
    `;

    return reply.send({
      success: true,
      data: rows.map(r => ({
        id: r.id,
        resumeId: r.resume_id,
        candidateId: r.candidate_id,
        title: r.title,
        isMaster: r.is_master,
        versionNo: r.version_no,
        jobId: r.job_id,
        templateName: r.template_name,
        contentHash: r.content_hash,
        plan: r.plan,
        storagePath: r.storage_path,
        sizeBytes: r.size_bytes,
        createdAt: r.created_at,
      })),
    });
  });

  // GET /api/resumes/:id - Single resume version with plan and citations
  app.get<{ Params: { id: string } }>('/api/resumes/:id', async (req, reply) => {
    const [row] = await db`
      SELECT 
        rv.*,
        r.title,
        r.candidate_id,
        r.is_master,
        a.storage_path,
        a.size_bytes,
        j.title as job_title,
        c.name as company_name
      FROM docs.resume_versions rv
      JOIN docs.resumes r ON rv.resume_id = r.id
      LEFT JOIN docs.artifacts a ON rv.artifact_id = a.id
      LEFT JOIN jobs.jobs j ON rv.job_id = j.id
      LEFT JOIN discovery.companies c ON j.company_id = c.id
      WHERE rv.id = ${req.params.id}
    `;

    if (!row) {
      return reply.code(404).send({ success: false, error: 'Resume version not found' });
    }

    return reply.send({
      success: true,
      data: {
        id: row.id,
        resumeId: row.resume_id,
        candidateId: row.candidate_id,
        title: row.title,
        isMaster: row.is_master,
        versionNo: row.version_no,
        jobId: row.job_id,
        jobTitle: row.job_title,
        companyName: row.company_name,
        templateName: row.template_name,
        contentHash: row.content_hash,
        plan: row.plan,
        storagePath: row.storage_path,
        sizeBytes: row.size_bytes,
        createdAt: row.created_at,
      },
    });
  });

  // GET /api/cover-letters - List cover letters
  app.get<{
    Querystring: {
      candidateId?: string;
      jobId?: string;
    };
  }>('/api/cover-letters', async (req, reply) => {
    const { candidateId, jobId } = req.query;

    const rows = await db`
      SELECT 
        clv.id,
        clv.cover_letter_id,
        clv.version_no,
        clv.job_id,
        clv.markdown_text,
        clv.company_discovery_citations,
        clv.fact_ids,
        clv.created_at,
        cl.title,
        cl.candidate_id,
        j.title as job_title,
        c.name as company_name
      FROM docs.cover_letter_versions clv
      JOIN docs.cover_letters cl ON clv.cover_letter_id = cl.id
      LEFT JOIN jobs.jobs j ON clv.job_id = j.id
      LEFT JOIN discovery.companies c ON j.company_id = c.id
      WHERE 1=1
        ${candidateId ? db`AND cl.candidate_id = ${candidateId}` : db``}
        ${jobId ? db`AND clv.job_id = ${jobId}` : db``}
      ORDER BY clv.created_at DESC
    `;

    return reply.send({
      success: true,
      data: rows.map(r => ({
        id: r.id,
        coverLetterId: r.cover_letter_id,
        candidateId: r.candidate_id,
        title: r.title,
        versionNo: r.version_no,
        jobId: r.job_id,
        jobTitle: r.job_title,
        companyName: r.company_name,
        markdownText: r.markdown_text,
        companyDiscoveryCitations: r.company_discovery_citations,
        factIds: r.fact_ids,
        createdAt: r.created_at,
      })),
    });
  });
}