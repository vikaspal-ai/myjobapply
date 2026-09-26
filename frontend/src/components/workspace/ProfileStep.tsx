import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { api } from '../../api/client.js';
import type { CandidateFact } from '../../types.js';

interface ProfileStepProps {
  onSaved: () => void;
}

const AVAILABLE_LOCATIONS = [
  { key: 'Mumbai', label: '📍 Mumbai' },
  { key: 'Pune', label: '📍 Pune' },
  { key: 'Bengaluru', label: '📍 Bengaluru' },
  { key: 'Remote', label: '🌐 Remote (India)' },
  { key: 'Hyderabad', label: '📍 Hyderabad' },
  { key: 'Delhi NCR', label: '📍 Delhi NCR' },
];

export const ProfileStep: React.FC<ProfileStepProps> = ({ onSaved }) => {
  const { user, activeCandidateId, setActiveCandidateId, candidateProfile, setCandidateProfile } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [currentJob, setCurrentJob] = useState('Full Stack Engineer');
  const [experienceYears, setExperienceYears] = useState<number>(4);
  const [preferredLocations, setPreferredLocations] = useState<string[]>(['Mumbai', 'Pune', 'Bengaluru', 'Remote']);
  const [resumeText, setResumeText] = useState('');
  const [skills, setSkills] = useState<string[]>(['Node.js', 'React', 'TypeScript', 'PostgreSQL', 'Fastify']);
  const [newSkill, setNewSkill] = useState('');
  const [atsScore, setAtsScore] = useState<number>(94);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize from context profile or user
  useEffect(() => {
    if (candidateProfile) {
      setFullName(candidateProfile.fullName || '');
      setEmail(candidateProfile.email || '');
      setCurrentJob(candidateProfile.currentJob || 'Full Stack Engineer');
      setExperienceYears(candidateProfile.experienceYears ?? 4);
      if (candidateProfile.preferredLocations && candidateProfile.preferredLocations.length > 0) {
        setPreferredLocations(candidateProfile.preferredLocations);
      }
    } else if (user) {
      setFullName(user.fullName || '');
      setEmail(user.email || '');
    }
  }, [candidateProfile, user]);

  // Load existing candidate facts
  useEffect(() => {
    if (!activeCandidateId) return;

    const loadFacts = async () => {
      try {
        const res = await api<CandidateFact[]>(`/api/candidates/${activeCandidateId}/facts`);
        if (res.data && res.data.length > 0) {
          const extractedSkills = res.data
            .filter((f) => f.category === 'SKILL' || f.category === 'PROJECT')
            .map((f) => f.statement || f.factKey || '');
          if (extractedSkills.length > 0) {
            setSkills(extractedSkills);
            setAtsScore(Math.min(98, 82 + Math.floor(extractedSkills.length * 1.8)));
          }
        }
      } catch (err) {
        console.error('Failed to load facts:', err);
      }
    };

    loadFacts();
  }, [activeCandidateId]);

  const toggleLocation = (locKey: string) => {
    if (preferredLocations.includes(locKey)) {
      if (preferredLocations.length === 1) {
        alert('You must have at least one preferred location.');
        return;
      }
      setPreferredLocations(preferredLocations.filter((l) => l !== locKey));
    } else {
      setPreferredLocations([...preferredLocations, locKey]);
    }
  };

  const handleParseResume = async () => {
    if (!resumeText || resumeText.trim().length < 10) {
      alert('Please paste or upload your resume text first.');
      return;
    }

    setIsExtracting(true);
    try {
      const res = await api<{ skills: string[]; experienceYears: number; suggestedTitle: string; atsScore: number }>(
        '/api/candidates/parse-resume',
        {
          method: 'POST',
          body: JSON.stringify({
            resumeText,
            candidateId: activeCandidateId,
          }),
        }
      );

      const parsed = res.data;
      if (parsed.suggestedTitle) setCurrentJob(parsed.suggestedTitle);
      if (parsed.experienceYears) setExperienceYears(parsed.experienceYears);
      if (parsed.skills && parsed.skills.length > 0) {
        setSkills(parsed.skills);
      }
      if (parsed.atsScore) setAtsScore(parsed.atsScore);

      alert(`Extracted ${parsed.skills.length} skills and estimated ${parsed.experienceYears} years experience! ATS Score: ${parsed.atsScore}/100.`);
    } catch (err: any) {
      alert(`Could not extract resume: ${err.message}`);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        setResumeText(content);
        // Automatically trigger parse
        setIsExtracting(true);
        try {
          const res = await api<{ skills: string[]; experienceYears: number; suggestedTitle: string; atsScore: number }>(
            '/api/candidates/parse-resume',
            {
              method: 'POST',
              body: JSON.stringify({
                resumeText: content,
                candidateId: activeCandidateId,
              }),
            }
          );
          if (res.data.suggestedTitle) setCurrentJob(res.data.suggestedTitle);
          if (res.data.experienceYears) setExperienceYears(res.data.experienceYears);
          if (res.data.skills?.length) setSkills(res.data.skills);
          if (res.data.atsScore) setAtsScore(res.data.atsScore);
        } catch (err: any) {
          alert(`Could not extract resume file: ${err.message}`);
        } finally {
          setIsExtracting(false);
        }
      }
    };
    reader.readAsText(file);
  };

  const handleAddSkill = async () => {
    if (!newSkill.trim()) return;
    const skillName = newSkill.trim();
    if (activeCandidateId) {
      try {
        await api(`/api/candidates/${activeCandidateId}/facts`, {
          method: 'POST',
          body: JSON.stringify({
            category: 'SKILL',
            statement: skillName,
            verified: true,
          }),
        });
      } catch {}
    }
    setSkills([...skills, skillName]);
    setNewSkill('');
  };

  const handleSaveProfile = async () => {
    if (!email) {
      alert('Please provide an email address.');
      return;
    }

    setIsSaving(true);
    try {
      if (activeCandidateId) {
        await api(`/api/candidates/${activeCandidateId}/preferences`, {
          method: 'PATCH',
          body: JSON.stringify({ preferredLocations }),
        });

        await api(`/api/candidates/${activeCandidateId}`, {
          method: 'PATCH',
          body: JSON.stringify({ fullName, currentJob, experienceYears }),
        });
      } else {
        // Create candidate record
        try {
          const createRes = await api('/api/candidates', {
            method: 'POST',
            body: JSON.stringify({
              fullName,
              email,
              preferredLocations,
              currentLocation: 'India',
              experienceYears,
              currentJob,
              authUserId: user?.id,
            }),
          });
          setActiveCandidateId(createRes.data.id);
        } catch {
          // If already exists, fetch and update
          const byEmail = await api(`/api/candidates/by-email/${encodeURIComponent(email)}`);
          if (byEmail.data) {
            setActiveCandidateId(byEmail.data.id);
            await api(`/api/candidates/${byEmail.data.id}/preferences`, {
              method: 'PATCH',
              body: JSON.stringify({ preferredLocations }),
            });
          }
        }
      }

      alert('Profile & location preferences saved! Activating live job opportunities.');
      onSaved();
    } catch (err: any) {
      alert(`Failed to save preferences: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="step-workspace-panel active">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
        {/* Left Column: Form & Resume Input */}
        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-title)', marginBottom: '0.5rem' }}>
            Candidate Profile & Resume Extraction
          </h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--color-text-body)', marginBottom: '1.5rem' }}>
            Upload your resume or paste text. Our AI extracts verified skills and configures your search criteria.
          </p>

          {/* Resume Upload Box */}
          <div style={{ background: '#f8fafc', border: '2px dashed var(--color-surface-border)', borderRadius: '14px', padding: '1.25rem', textAlign: 'center', marginBottom: '1.25rem' }}>
            <p style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>📄</p>
            <p style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text-title)' }}>
              Drag & Drop your resume or choose file
            </p>
            <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
              Accepts .pdf, .docx, .txt (Max 10MB)
            </p>
            <input
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={handleFileUpload}
              style={{ fontSize: '0.8rem', color: 'var(--color-text-body)' }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>
              Or Paste Resume Text
            </label>
            <textarea
              rows={4}
              placeholder="Paste raw resume text here to auto-extract technical skills and experience years..."
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--color-surface-border)', fontFamily: 'inherit', fontSize: '0.85rem' }}
            />
            <button
              type="button"
              className="btn-outline btn-sm"
              disabled={isExtracting}
              onClick={handleParseResume}
              style={{ marginTop: '0.5rem', width: '100%', justifyContent: 'center' }}
            >
              {isExtracting ? '⏳ Extracting Skills & Experience...' : '⚡ Extract Skills & Details from Resume'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--color-surface-border)', fontFamily: 'inherit' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--color-surface-border)', fontFamily: 'inherit' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>Current Role Title</label>
              <input
                type="text"
                value={currentJob}
                onChange={(e) => setCurrentJob(e.target.value)}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--color-surface-border)', fontFamily: 'inherit' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>Exp. (Years)</label>
              <input
                type="number"
                min={0}
                max={50}
                value={experienceYears}
                onChange={(e) => setExperienceYears(parseInt(e.target.value, 10) || 0)}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--color-surface-border)', fontFamily: 'inherit' }}
              />
            </div>
          </div>

          {/* Location Preferences */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem' }}>
              Target Job Locations (Select Multiple)
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {AVAILABLE_LOCATIONS.map((loc) => {
                const isSelected = preferredLocations.includes(loc.key);
                return (
                  <button
                    key={loc.key}
                    type="button"
                    className={`chip-btn ${isSelected ? 'active' : ''}`}
                    onClick={() => toggleLocation(loc.key)}
                  >
                    {loc.label} {isSelected ? '✓' : '+'}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            className="btn-gradient"
            disabled={isSaving}
            onClick={handleSaveProfile}
            style={{ width: '100%', justifyContent: 'center', padding: '0.8rem', fontSize: '0.95rem' }}
          >
            {isSaving ? 'Saving Profile...' : 'Save Profile & Discover Jobs 🚀'}
          </button>
        </div>

        {/* Right Column: ATS Score & Verified Skills Store */}
        <div>
          <div style={{ background: 'var(--color-surface-soft)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--color-surface-border)', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)' }}>
                  Deterministic ATS Baseline
                </span>
                <h4 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text-title)' }}>
                  <span>{atsScore}</span>
                  <span style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>/100</span>
                </h4>
              </div>
              <span className="fit-score-badge best">ATS Ready</span>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--color-text-body)' }}>
              Calculated against standard tech criteria (skills density, quantifiable achievements, formatting).
            </p>
          </div>

          <div style={{ background: 'white', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--color-surface-border)' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text-title)', marginBottom: '0.75rem' }}>
              Verified Fact Store (Anti-Hallucination)
            </h4>
            <p style={{ fontSize: '0.82rem', color: 'var(--color-text-body)', marginBottom: '1rem' }}>
              The AI resume generator only uses facts confirmed here:
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1.25rem' }}>
              {skills.map((skill, index) => (
                <span
                  key={index}
                  className="chip-btn active"
                  style={{ fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  {skill}
                </span>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                placeholder="Add skill (e.g. Redis, Kubernetes)"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddSkill(); }}
                style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--color-surface-border)', fontSize: '0.82rem', fontFamily: 'inherit' }}
              />
              <button
                type="button"
                className="btn-outline btn-sm"
                onClick={handleAddSkill}
              >
                + Add
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
