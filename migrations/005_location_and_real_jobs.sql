-- ============================================================================
-- Migration 005: Location Targeting & Real Job Ingestion
-- ============================================================================

-- 1. Add location preferences to candidate profiles
ALTER TABLE profile.candidate_profiles
  ADD COLUMN IF NOT EXISTS preferred_locations text[] NOT NULL DEFAULT '{"Mumbai", "Pune", "Bengaluru", "Remote"}',
  ADD COLUMN IF NOT EXISTS current_location text NOT NULL DEFAULT 'India';

-- 2. Add is_synthetic flag to jobs.jobs to isolate test fixtures from real jobs
ALTER TABLE jobs.jobs
  ADD COLUMN IF NOT EXISTS is_synthetic boolean NOT NULL DEFAULT false;

-- 3. Flag existing synthetic test domains as synthetic
UPDATE jobs.jobs
SET is_synthetic = true
WHERE apply_url ILIKE '%fintechglobal%'
   OR apply_url ILIKE '%acme.com%'
   OR apply_url ILIKE '%applytest.com%'
   OR apply_url ILIKE '%matchtest.com%'
   OR apply_url ILIKE '%tailortest.com%'
   OR apply_url ILIKE '%reqtest.com%'
   OR apply_url ILIKE '%companywf.com%'
   OR apply_url ILIKE '%sig_chaos%'
   OR apply_url ILIKE '%example.com%'
   OR title ILIKE '%chaos%';

-- 4. Create index for location-based search
CREATE INDEX IF NOT EXISTS ix_jobs_location_city ON jobs.jobs ((location->>'city'));
CREATE INDEX IF NOT EXISTS ix_jobs_is_synthetic ON jobs.jobs (is_synthetic) WHERE status = 'ACTIVE';
