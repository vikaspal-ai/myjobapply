-- Migration: 002_docs_schema.sql
-- Description: Phase 3 Document Engine Schema (Resumes, Artifacts, Resume Versions, Cover Letters, Cover Letter Versions)
-- Conventions: UUIDv7 PKs, immutable versions, sha256 content hashes, foreign key constraints ON DELETE RESTRICT

CREATE SCHEMA IF NOT EXISTS docs;

-- 1. Artifacts (Immutable storage pointers for rendered PDFs, Markdown, and binaries)
CREATE TABLE IF NOT EXISTS docs.artifacts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_hash text NOT NULL, -- SHA-256 of the artifact bytes
  mime_type    text NOT NULL, -- e.g. 'application/pdf', 'text/markdown'
  storage_path text NOT NULL, -- e.g. 'artifacts/resumes/abcdef123.pdf'
  size_bytes   int  NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_docs_artifact_hash UNIQUE (content_hash)
);
CREATE INDEX IF NOT EXISTS ix_docs_artifacts_created ON docs.artifacts (created_at);

-- 2. Resumes (Logical container for candidate resumes)
CREATE TABLE IF NOT EXISTS docs.resumes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES profile.candidate_profiles(id) ON DELETE RESTRICT,
  title        text NOT NULL,
  is_master    boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_docs_resumes_candidate ON docs.resumes (candidate_id);

-- 3. Resume Versions (Immutable version chain, linked to exact job and JSON plan)
CREATE TABLE IF NOT EXISTS docs.resume_versions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_id         uuid NOT NULL REFERENCES docs.resumes(id) ON DELETE RESTRICT,
  parent_version_id uuid REFERENCES docs.resume_versions(id) ON DELETE RESTRICT,
  job_id            uuid REFERENCES jobs.jobs(id) ON DELETE RESTRICT, -- Null for master resume versions
  version_no        int  NOT NULL,
  content_hash      text NOT NULL, -- SHA-256 of the generated LaTeX / plan source
  plan              jsonb NOT NULL DEFAULT '{}', -- Tailored selection of fact_ids and section order
  template_name     text NOT NULL DEFAULT 'modern-deedy',
  artifact_id       uuid REFERENCES docs.artifacts(id) ON DELETE RESTRICT, -- Rendered PDF artifact
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_docs_resume_version UNIQUE (resume_id, version_no)
);
CREATE INDEX IF NOT EXISTS ix_docs_resume_versions_job ON docs.resume_versions (job_id);

-- 4. Cover Letters (Logical container for candidate cover letters)
CREATE TABLE IF NOT EXISTS docs.cover_letters (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES profile.candidate_profiles(id) ON DELETE RESTRICT,
  title        text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_docs_cover_letters_candidate ON docs.cover_letters (candidate_id);

-- 5. Cover Letter Versions (Immutable tailored drafts citing verified company sources)
CREATE TABLE IF NOT EXISTS docs.cover_letter_versions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cover_letter_id      uuid NOT NULL REFERENCES docs.cover_letters(id) ON DELETE RESTRICT,
  parent_version_id    uuid REFERENCES docs.cover_letter_versions(id) ON DELETE RESTRICT,
  job_id               uuid NOT NULL REFERENCES jobs.jobs(id) ON DELETE RESTRICT,
  version_no           int  NOT NULL,
  content_hash         text NOT NULL,
  markdown_content     text NOT NULL,
  company_fact_sources jsonb NOT NULL DEFAULT '[]', -- Grounded URLs cited from discovery
  artifact_id          uuid REFERENCES docs.artifacts(id) ON DELETE RESTRICT,
  created_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_docs_cover_letter_version UNIQUE (cover_letter_id, version_no)
);
CREATE INDEX IF NOT EXISTS ix_docs_cl_versions_job ON docs.cover_letter_versions (job_id);
