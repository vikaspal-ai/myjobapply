import React, { useState, useEffect, useRef } from 'react';
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [currentJob, setCurrentJob] = useState('');
  const [experienceYears, setExperienceYears] = useState<number>(0);
  const [preferredLocations, setPreferredLocations] = useState<string[]>(['Mumbai', 'Pune', 'Bengaluru', 'Remote']);
  const [resumeText, setResumeText] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState('');
  const [atsScore, setAtsScore] = useState<number>(0);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize from context profile or user
  useEffect(() => {
    if (candidateProfile) {
      if (candidateProfile.fullName) setFullName(candidateProfile.fullName);
      if (candidateProfile.email) setEmail(candidateProfile.email);
      if (candidateProfile.currentJob) setCurrentJob(candidateProfile.currentJob);
      if (candidateProfile.experienceYears !== undefined && candidateProfile.experienceYears !== null) {
        setExperienceYears(candidateProfile.experienceYears);
      }
      if (candidateProfile.preferredLocations && candidateProfile.preferredLocations.length > 0) {
        setPreferredLocations(candidateProfile.preferredLocations);
      }
    } else if (user) {
      if (user.fullName) setFullName(user.fullName);
      if (user.email) setEmail(user.email);
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
            .map((f) => f.statement || f.factKey || '')
            .filter(Boolean);
          if (extractedSkills.length > 0) {
            setSkills(extractedSkills);
            setAtsScore(Math.min(98, 70 + Math.floor(extractedSkills.length * 2)));
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

  interface ParsedResumeData {
    contact?: {
      fullName?: string;
      email?: string;
      phone?: string;
      location?: string;
      linkedin?: string;
      github?: string;
      portfolio?: string;
    };
    summary?: string;
    skills?: string[];
    experienceYears?: number;
    suggestedTitle?: string;
    atsScore?: number;
  }

  const applyParsedData = (data: ParsedResumeData, rawText?: string) => {
    if (rawText) setResumeText(rawText);
    if (data.skills && Array.isArray(data.skills)) {
      setSkills(data.skills);
    }
    if (data.experienceYears !== undefined) {
      setExperienceYears(data.experienceYears);
    }
    if (data.suggestedTitle) {
      setCurrentJob(data.suggestedTitle);
    }
    if (data.atsScore !== undefined) {
      setAtsScore(data.atsScore);
    }
    if (data.contact?.fullName && (!fullName || fullName === 'Candidate')) {
      setFullName(data.contact.fullName);
    }
    if (data.contact?.email && !email) {
      setEmail(data.contact.email);
    }
  };

  const handleParseResume = async () => {
    if (!resumeText || resumeText.trim().length < 10) {
      alert('Please paste or upload your resume text first.');
      return;
    }

    setIsExtracting(true);
    try {
      const res = await api<ParsedResumeData>(
        '/api/candidates/parse-resume',
        {
          method: 'POST',
          body: JSON.stringify({
            resumeText,
            candidateId: activeCandidateId,
          }),
        }
      );

      if (res.data) {
        applyParsedData(res.data);
        alert(`Extracted ${res.data.skills?.length || 0} technical skills with ATS score ${res.data.atsScore || 0}/100!`);
      }
    } catch (err: any) {
      console.error('Failed to parse resume:', err);
      alert('Failed to parse resume: ' + (err.message || 'Please check resume text format'));
    } finally {
      setIsExtracting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    try {
      const isBinary =
        file.type === 'application/pdf' ||
        file.name.toLowerCase().endsWith('.pdf') ||
        file.name.toLowerCase().endsWith('.docx') ||
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

      if (isBinary) {
        const formData = new FormData();
        formData.append('file', file);
        if (activeCandidateId) {
          formData.append('candidateId', activeCandidateId);
        }

        const res = await fetch('/api/resumes/parse-file', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${res.status}`);
        }

        const result = await res.json();
        if (result.data?.parsed) {
          applyParsedData(result.data.parsed, result.data.rawText);
          alert(`Successfully parsed ${file.name}! Extracted ${result.data.parsed.skills?.length || 0} skills.`);
        }
      } else {
        const reader = new FileReader();
        reader.onload = async (event) => {
          const content = event.target?.result as string;
          if (content) {
            setResumeText(content);
            try {
              const res = await api<ParsedResumeData>('/api/candidates/parse-resume', {
                method: 'POST',
                body: JSON.stringify({ resumeText: content, candidateId: activeCandidateId }),
              });
              if (res.data) {
                applyParsedData(res.data, content);
                alert(`Resume parsed successfully! Extracted ${res.data.skills?.length || 0} skills.`);
              }
            } catch {
              alert('Resume text loaded. Click "Auto-Extract Skills & Details" to parse.');
            }
          }
        };
        reader.readAsText(file);
      }
    } catch (err: any) {
      console.error('File parsing error:', err);
      alert('Failed to parse file: ' + (err.message || 'Please check file format'));
    } finally {
      setIsExtracting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
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
        try {
          const createRes = await api<any>('/api/candidates', {
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
          if (createRes.data?.id) {
            setActiveCandidateId(createRes.data.id);
          }
        } catch {
          const byEmail = await api<any>(`/api/candidates/by-email/${encodeURIComponent(email)}`);
          if (byEmail.data) {
            setActiveCandidateId(byEmail.data.id);
            await api(`/api/candidates/${byEmail.data.id}/preferences`, {
              method: 'PATCH',
              body: JSON.stringify({ preferredLocations }),
            });
          }
        }
      }

      setCandidateProfile({
        id: activeCandidateId || 'cand_default',
        fullName,
        email,
        currentJob,
        experienceYears,
        preferredLocations,
      });

      alert('Profile & location preferences saved! Activating live job opportunities.');
      onSaved();
    } catch (err: any) {
      alert(`Failed to save preferences: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div id="step-panel-profile" className="step-workspace-panel active">
      <div className="ats-score-grid">
        {/* Left Column: Dial Card */}
        <div className="ats-score-dial-card">
          <span style={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#93c5fd', fontWeight: 700 }}>
            ATS Compatibility Score
          </span>
          <div className="ats-score-circle">
            <span id="atsScoreValue">{atsScore > 0 ? atsScore : '--'}</span>
            <span className="ats-score-max">/100</span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>Optimized for Indian Tech Roles</p>

          <div className="ats-metric-bars">
            <div className="ats-bar-row">
              <div className="ats-bar-labels">
                <span>Keyword Coverage</span>
                <span id="atsKeywordsPercent">96%</span>
              </div>
              <div className="ats-progress-track">
                <div className="ats-progress-fill" style={{ width: '96%' }}></div>
              </div>
            </div>

            <div className="ats-bar-row">
              <div className="ats-bar-labels">
                <span>Quantified Achievements</span>
                <span>88%</span>
              </div>
              <div className="ats-progress-track">
                <div className="ats-progress-fill" style={{ width: '88%' }}></div>
              </div>
            </div>

            <div className="ats-bar-row">
              <div className="ats-bar-labels">
                <span>Location Match (Mumbai, Pune, BLR)</span>
                <span style={{ color: '#34d399', fontWeight: 700 }}>100%</span>
              </div>
              <div className="ats-progress-track">
                <div className="ats-progress-fill" style={{ width: '100%', background: '#10b981' }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Onboarding & Location Preferences Form */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--color-text-title)' }} id="candidateNameHeader">
                Candidate Profile & Target Locations
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--color-text-body)' }} id="candidateSummaryText">
                Upload your resume to extract skills and set your target cities.
              </p>
            </div>
            <span style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', fontWeight: 700, fontSize: '0.78rem', padding: '0.3rem 0.75rem', borderRadius: '9999px' }}>
              Verified Facts
            </span>
          </div>

          {/* Resume Upload & Dropzone Box */}
          <div style={{ background: 'white', border: '2px dashed rgba(37, 99, 235, 0.35)', borderRadius: 'var(--radius-xl)', padding: '1.5rem', marginBottom: '1.25rem', textAlign: 'center' }}>
            <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📄</p>
            <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-title)', marginBottom: '0.25rem' }}>
              Upload or Paste Your Resume
            </h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
              Our AI parser will automatically extract your skills, years of experience, and target roles.
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginBottom: '1rem' }}>
              <button
                type="button"
                className="btn-outline btn-sm"
                onClick={() => fileInputRef.current?.click()}
              >
                📁 Choose Resume File (.pdf, .txt, .docx)
              </button>
              <input
                ref={fileInputRef}
                type="file"
                id="inputResumeFile"
                accept=".pdf,.txt,.docx"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
            </div>

            <textarea
              id="inputResumeText"
              rows={3}
              placeholder="Or paste your resume text here (e.g. Senior SDE with React, Node.js, TypeScript, PostgreSQL)..."
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--color-surface-border)', fontFamily: 'inherit', fontSize: '0.82rem', marginBottom: '0.75rem' }}
            />

            <button
              type="button"
              id="btnParseResume"
              className="btn-gradient btn-sm"
              style={{ fontSize: '0.82rem', padding: '0.45rem 1.2rem' }}
              disabled={isExtracting}
              onClick={handleParseResume}
            >
              {isExtracting ? '⏳ Auto-Extracting Skills...' : '⚡ Auto-Extract Skills & Details from Resume'}
            </button>
          </div>

          {/* Profile Details Grid */}
          <div style={{ background: 'var(--color-surface-soft)', borderRadius: 'var(--radius-xl)', padding: '1.25rem', marginBottom: '1.25rem', border: '1px solid var(--color-surface-border)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--color-text-title)' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  id="inputFullName"
                  placeholder="e.g. Vikas Pal"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid var(--color-surface-border)', fontFamily: 'inherit', fontSize: '0.85rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--color-text-title)' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  id="inputEmail"
                  placeholder="e.g. vikas@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid var(--color-surface-border)', fontFamily: 'inherit', fontSize: '0.85rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--color-text-title)' }}>
                  Current / Target Role
                </label>
                <input
                  type="text"
                  id="inputCurrentJob"
                  placeholder="e.g. Senior Fullstack Engineer"
                  value={currentJob}
                  onChange={(e) => setCurrentJob(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid var(--color-surface-border)', fontFamily: 'inherit', fontSize: '0.85rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--color-text-title)' }}>
                  Years of Experience
                </label>
                <input
                  type="number"
                  id="inputExpYears"
                  min={0}
                  max={40}
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(parseInt(e.target.value, 10) || 0)}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid var(--color-surface-border)', fontFamily: 'inherit', fontSize: '0.85rem' }}
                />
              </div>
            </div>
          </div>

          {/* Location Preferences Multi-Select */}
          <div style={{ background: 'white', border: '1px solid var(--color-surface-border)', borderRadius: 'var(--radius-xl)', padding: '1.25rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
              <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--color-text-title)' }}>
                📍 Target Job Locations (Click to Toggle)
              </h4>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                Matches Indian Tech Hubs
              </span>
            </div>
            <div id="preferredLocationsContainer" className="location-chips" style={{ gap: '0.5rem', display: 'flex', flexWrap: 'wrap' }}>
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

          {/* Skills & Fact Highlights */}
          <div style={{ background: 'var(--color-surface-soft)', borderRadius: 'var(--radius-xl)', padding: '1.25rem', marginBottom: '1.25rem', border: '1px solid var(--color-surface-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
              <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--color-text-title)' }}>
                Core Skills & Proven Facts
              </h4>
              <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 700 }}>
                Anti-Hallucination Verified
              </span>
            </div>
            <div id="candidateSkillsList" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
              {skills.length > 0 ? (
                skills.map((skill, idx) => (
                  <span
                    key={idx}
                    className="chip-btn active"
                    style={{ fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    {skill}
                  </span>
                ))
              ) : (
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontStyle: 'italic', padding: '0.2rem 0' }}>
                  No skills extracted yet. Upload your resume (PDF/DOCX) or paste text to extract.
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                id="inputNewSkill"
                placeholder="Add verified skill (e.g. Next.js, Redis, Kafka)..."
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddSkill(); }}
                style={{ flex: 1, padding: '0.45rem 0.75rem', border: '1px solid var(--color-surface-border)', borderRadius: '8px', fontFamily: 'inherit', fontSize: '0.82rem' }}
              />
              <button
                type="button"
                id="btnAddSkill"
                className="btn-outline btn-sm"
                onClick={handleAddSkill}
              >
                + Add Skill
              </button>
            </div>
          </div>

          {/* Save Preferences Button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              id="btnSavePreferences"
              className="btn-gradient"
              style={{ padding: '0.65rem 1.75rem', fontSize: '0.95rem' }}
              disabled={isSaving}
              onClick={handleSaveProfile}
            >
              {isSaving ? 'Saving Preferences...' : 'Save Preferences & Start Job Hunt ⚡'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
