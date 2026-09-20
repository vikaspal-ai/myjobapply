-- Migration: 003_apply_schema.sql
-- Description: Phase 4 Application Automation Schema (Applications, Candidate Answers, Application Runs)
-- Conventions: UUIDv7 PKs, strict state machine constraints, foreign key constraints ON DELETE RESTRICT

CREATE SCHEMA IF NOT EXISTS apply;

-- 1. Applications (Core container tracking candidate application per canonical job)
CREATE TABLE IF NOT EXISTS apply.applications (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id            uuid NOT NULL REFERENCES profile.candidate_profiles(id) ON DELETE RESTRICT,
  job_id                  uuid NOT NULL REFERENCES jobs.jobs(id) ON DELETE RESTRICT,
  resume_version_id       uuid REFERENCES docs.resume_versions(id) ON DELETE RESTRICT,
  cover_letter_version_id uuid REFERENCES docs.cover_letter_versions(id) ON DELETE RESTRICT,
  status                  text NOT NULL DEFAULT 'DRAFT'
                          CHECK (status IN (
                            'DRAFT',
                            'PREPARED',
                            'PENDING_APPROVAL',
                            'APPROVED',
                            'SUBMITTING',
                            'SUBMITTED',
                            'FAILED',
                            'PAUSED',
                            'CANCELLED',
                            'UNCONFIRMED'
                          )),
  notes                   text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_apply_candidate_job UNIQUE (candidate_id, job_id)
);
CREATE INDEX IF NOT EXISTS ix_apply_applications_candidate ON apply.applications (candidate_id);
CREATE INDEX IF NOT EXISTS ix_apply_applications_job ON apply.applications (job_id);
CREATE INDEX IF NOT EXISTS ix_apply_applications_status ON apply.applications (status);

-- 2. Candidate Answers (Verified answers to standard and sensitive questions)
CREATE TABLE IF NOT EXISTS apply.candidate_answers (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id     uuid NOT NULL REFERENCES profile.candidate_profiles(id) ON DELETE RESTRICT,
  question_pattern text NOT NULL, -- normalized search pattern (e.g. 'require sponsorship', 'work authorization')
  answer_text      text NOT NULL,
  category         text NOT NULL CHECK (category IN ('authorization', 'sponsorship', 'compensation', 'notice_period', 'demographics', 'custom')),
  verified         boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_apply_answers_lookup ON apply.candidate_answers (candidate_id, category);

-- 3. Application Runs (Execution records for browser automation / extension runs)
CREATE TABLE IF NOT EXISTS apply.application_runs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES apply.applications(id) ON DELETE RESTRICT,
  path           text NOT NULL CHECK (path IN ('PLAYWRIGHT', 'EXTENSION')),
  status         text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RUNNING', 'PAUSED', 'SUBMITTED', 'FAILED')),
  form_data      jsonb NOT NULL DEFAULT '{}',
  pause_reason   text, -- 'CAPTCHA_DETECTED' | 'LOGIN_WALL_DETECTED' | 'NEEDS_HUMAN_ANSWER' | 'LAYOUT_CHANGED'
  approved_at    timestamptz,
  submitted_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_apply_runs_app ON apply.application_runs (application_id);
