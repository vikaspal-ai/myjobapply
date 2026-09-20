-- Migration: 004_outreach_schema.sql
-- Description: Phase 7 Outreach Subsystem Schema (Contacts, Suppression List, Outreach Messages, Threads)
-- Conventions: UUIDv7 PKs, strict state machine constraints, foreign key constraints ON DELETE RESTRICT

CREATE SCHEMA IF NOT EXISTS outreach;

-- 1. Company Contacts (Publicly discovered recruitment/hiring contacts from career/contact pages)
CREATE TABLE IF NOT EXISTS outreach.company_contacts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES discovery.companies(id) ON DELETE RESTRICT,
  name         text,
  email        text NOT NULL,
  role_title   text,
  source_url   text NOT NULL,
  confidence   numeric NOT NULL DEFAULT 1.0,
  is_verified  boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_company_contact_email UNIQUE (company_id, email)
);
CREATE INDEX IF NOT EXISTS ix_outreach_contacts_company ON outreach.company_contacts (company_id);
CREATE INDEX IF NOT EXISTS ix_outreach_contacts_email ON outreach.company_contacts (email);

-- 2. Suppression List (Global opt-outs, hard bounces, and manual suppression targets)
CREATE TABLE IF NOT EXISTS outreach.suppression_list (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text,
  domain     text,
  reason     text NOT NULL CHECK (reason IN ('UNSUBSCRIBE', 'BOUNCE', 'MANUAL', 'COMPLAINT', 'COOLDOWN')),
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_suppression_target CHECK (email IS NOT NULL OR domain IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS ix_outreach_suppression_email ON outreach.suppression_list (email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_outreach_suppression_domain ON outreach.suppression_list (domain) WHERE domain IS NOT NULL;

-- 3. Outreach Messages (Grounded cold emails citing candidate facts and job requirements)
CREATE TABLE IF NOT EXISTS outreach.messages (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id      uuid NOT NULL REFERENCES profile.candidate_profiles(id) ON DELETE RESTRICT,
  company_id        uuid NOT NULL REFERENCES discovery.companies(id) ON DELETE RESTRICT,
  contact_id        uuid REFERENCES outreach.company_contacts(id) ON DELETE RESTRICT,
  job_id            uuid REFERENCES jobs.jobs(id) ON DELETE RESTRICT,
  resume_version_id uuid REFERENCES docs.resume_versions(id) ON DELETE RESTRICT,
  subject           text NOT NULL,
  body_text         text NOT NULL,
  status            text NOT NULL DEFAULT 'DRAFT'
                    CHECK (status IN (
                      'DRAFT',
                      'PENDING_APPROVAL',
                      'APPROVED',
                      'SENT',
                      'BOUNCED',
                      'REPLIED',
                      'FAILED',
                      'CANCELLED'
                    )),
  idempotency_key   text NOT NULL UNIQUE,
  correlation_token text NOT NULL,
  approved_at       timestamptz,
  sent_at           timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_outreach_messages_company ON outreach.messages (company_id, status);
CREATE INDEX IF NOT EXISTS ix_outreach_messages_candidate ON outreach.messages (candidate_id);
CREATE INDEX IF NOT EXISTS ix_outreach_messages_token ON outreach.messages (correlation_token);

-- 4. Outreach Threads (Correlated replies and conversation state)
CREATE TABLE IF NOT EXISTS outreach.threads (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id         uuid NOT NULL REFERENCES outreach.messages(id) ON DELETE RESTRICT,
  thread_external_id text,
  provider           text NOT NULL DEFAULT 'SANDBOX',
  last_message_at    timestamptz NOT NULL DEFAULT now(),
  status             text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CLOSED', 'NEEDS_ATTENTION')),
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_outreach_threads_message ON outreach.threads (message_id);
