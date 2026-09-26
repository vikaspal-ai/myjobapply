-- Migration 007: Add profile fields for onboarding
ALTER TABLE profile.candidate_profiles
  ADD COLUMN IF NOT EXISTS experience_years int,
  ADD COLUMN IF NOT EXISTS current_job text,
  ADD COLUMN IF NOT EXISTS current_company text,
  ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE; -- Links to Supabase auth.users

CREATE INDEX IF NOT EXISTS ix_candidate_profiles_auth_user ON profile.candidate_profiles (auth_user_id);
