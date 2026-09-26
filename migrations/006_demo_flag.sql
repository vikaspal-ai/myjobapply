-- Migration 006: Demo user flag for persistent demo data
ALTER TABLE profile.candidate_profiles
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS ix_candidate_profiles_demo ON profile.candidate_profiles (is_demo);
