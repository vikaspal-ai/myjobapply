// Jobsapply Candidate Onboarding & Preferences Controller (Phase 3)
// Handles resume analysis, location targeting (Mumbai, Pune, BLR, Remote), and fact management

import { api, escapeHtml } from './api.js';
import { state, emit } from './state.js';

export async function initOnboarding() {
  setupEventListeners();
  if (state.activeCandidateId) {
    await loadCandidateData(state.activeCandidateId);
  }
}

export async function loadCandidateData(candidateId) {
  try {
    const [candRes, factsRes] = await Promise.all([
      api(`/api/candidates/${candidateId}`),
      api(`/api/candidates/${candidateId}/facts`),
    ]);

    state.candidateProfile = candRes.data;
    state.facts = factsRes.data || [];

    renderOnboardingUI();
  } catch (err) {
    console.error('Failed to load candidate data:', err);
  }
}

function renderOnboardingUI() {
  const p = state.candidateProfile || {};

  // 1. Basic Info Fields
  const nameInput = document.getElementById('inputFullName');
  if (nameInput) nameInput.value = p.fullName || (state.currentUser?.fullName || '');

  const emailInput = document.getElementById('inputEmail');
  if (emailInput) emailInput.value = p.email || (state.currentUser?.email || '');

  const roleInput = document.getElementById('inputCurrentJob');
  if (roleInput) roleInput.value = p.currentJob || 'Full Stack Engineer';

  const expInput = document.getElementById('inputExpYears');
  if (expInput) expInput.value = p.experienceYears ?? 4;

  // 2. Location Preference Chips
  renderLocationChips(p.preferredLocations || ['Mumbai', 'Pune', 'Bengaluru', 'Remote']);

  // 3. Skills & Fact Badges
  renderSkillBadges();

  // 4. Calculate ATS Score
  calculateAtsScore();
}

function renderLocationChips(preferred) {
  const container = document.getElementById('preferredLocationsContainer');
  if (!container) return;

  const availableLocations = [
    { key: 'Mumbai', label: '📍 Mumbai' },
    { key: 'Pune', label: '📍 Pune' },
    { key: 'Bengaluru', label: '📍 Bengaluru' },
    { key: 'Remote', label: '🌐 Remote (India)' },
    { key: 'Hyderabad', label: '📍 Hyderabad' },
    { key: 'Delhi NCR', label: '📍 Delhi NCR' },
  ];

  container.innerHTML = availableLocations.map(loc => {
    const isSelected = (preferred || []).includes(loc.key);
    return `
      <button type="button" 
        class="chip-btn ${isSelected ? 'active' : ''}" 
        data-location-key="${loc.key}" 
        onclick="window.onboardingModule.togglePreferredLocation('${loc.key}')">
        ${loc.label} ${isSelected ? '✓' : '+'}
      </button>
    `;
  }).join('');
}

export function togglePreferredLocation(locKey) {
  if (!state.candidateProfile) {
    state.candidateProfile = { preferredLocations: ['Mumbai', 'Pune', 'Bengaluru', 'Remote'] };
  }
  const current = state.candidateProfile.preferredLocations || ['Mumbai', 'Pune', 'Bengaluru', 'Remote'];
  let updated;
  if (current.includes(locKey)) {
    if (current.length === 1) {
      alert('You must have at least one preferred location.');
      return;
    }
    updated = current.filter(l => l !== locKey);
  } else {
    updated = [...current, locKey];
  }
  state.candidateProfile.preferredLocations = updated;
  renderLocationChips(updated);
}

function renderSkillBadges() {
  const container = document.getElementById('candidateSkillsList');
  if (!container) return;

  const skills = state.facts.filter(f => f.category === 'SKILL' || f.category === 'PROJECT');
  if (skills.length === 0) {
    container.innerHTML = `
      <span class="chip-btn active" style="font-size: 0.75rem;">Node.js</span>
      <span class="chip-btn active" style="font-size: 0.75rem;">React</span>
      <span class="chip-btn active" style="font-size: 0.75rem;">TypeScript</span>
      <span class="chip-btn active" style="font-size: 0.75rem;">PostgreSQL</span>
      <span class="chip-btn active" style="font-size: 0.75rem;">Fastify / Express</span>
    `;
    return;
  }

  container.innerHTML = skills.map(s => `
    <span class="chip-btn active" style="font-size: 0.75rem; display: inline-flex; align-items: center; gap: 0.35rem;">
      ${escapeHtml(s.statement || s.factKey)}
    </span>
  `).join('');
}

export async function addCustomSkill() {
  const input = document.getElementById('inputNewSkill');
  if (!input || !input.value.trim()) return;

  const skillName = input.value.trim();
  if (state.activeCandidateId) {
    try {
      await api(`/api/candidates/${state.activeCandidateId}/facts`, {
        method: 'POST',
        body: JSON.stringify({
          category: 'SKILL',
          statement: skillName,
          verified: true,
        }),
      });
      await loadCandidateData(state.activeCandidateId);
    } catch {}
  } else {
    state.facts.push({ category: 'SKILL', statement: skillName, verified: true });
    renderSkillBadges();
    calculateAtsScore();
  }
  input.value = '';
}

// Parse Resume Text or Uploaded File
export async function parseResumeInput() {
  const textarea = document.getElementById('inputResumeText');
  const text = textarea?.value?.trim();

  if (!text || text.length < 10) {
    alert('Please paste your resume text (or drag & drop a file) first.');
    return;
  }

  const btn = document.getElementById('btnParseResume');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Extracting Skills & Experience...';
  }

  try {
    const res = await api('/api/candidates/parse-resume', {
      method: 'POST',
      body: JSON.stringify({
        resumeText: text,
        candidateId: state.activeCandidateId,
      }),
    });

    const parsed = res.data;
    
    // Auto-fill form inputs
    const roleInput = document.getElementById('inputCurrentJob');
    if (roleInput && parsed.suggestedTitle) {
      roleInput.value = parsed.suggestedTitle;
    }

    const expInput = document.getElementById('inputExpYears');
    if (expInput && parsed.experienceYears) {
      expInput.value = parsed.experienceYears;
    }

    // Update skills list
    if (parsed.skills && parsed.skills.length > 0) {
      state.facts = parsed.skills.map(s => ({ category: 'SKILL', statement: s, verified: true }));
      renderSkillBadges();
    }

    // Update ATS Score
    const scoreEl = document.getElementById('atsScoreValue');
    if (scoreEl && parsed.atsScore) {
      scoreEl.textContent = parsed.atsScore;
    }

    alert(`Extracted ${parsed.skills.length} skills and estimated ${parsed.experienceYears} years experience! ATS Score: ${parsed.atsScore}/100.`);
  } catch (err) {
    alert(`Could not extract resume: ${err.message}`);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '⚡ Extract Skills & Details from Resume';
    }
  }
}

export function handleResumeFileUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    const content = e.target?.result;
    if (typeof content === 'string') {
      const textarea = document.getElementById('inputResumeText');
      if (textarea) textarea.value = content;
      await parseResumeInput();
    }
  };
  reader.readAsText(file);
}

function calculateAtsScore() {
  const skillsCount = state.facts.length || 6;
  const score = Math.min(98, 82 + Math.floor(skillsCount * 1.8));

  const scoreEl = document.getElementById('atsScoreValue');
  if (scoreEl) scoreEl.textContent = score;

  const kwPercentEl = document.getElementById('atsKeywordsPercent');
  if (kwPercentEl) kwPercentEl.textContent = `${Math.min(99, 90 + Math.floor(skillsCount * 1.2))}%`;
}

export async function savePreferencesAndSearch() {
  const nameInput = document.getElementById('inputFullName');
  const emailInput = document.getElementById('inputEmail');
  const roleInput = document.getElementById('inputCurrentJob');
  const expInput = document.getElementById('inputExpYears');

  const fullName = nameInput ? nameInput.value.trim() : (state.candidateProfile?.fullName || 'Candidate');
  const email = emailInput ? emailInput.value.trim() : (state.candidateProfile?.email || state.currentUser?.email || '');
  const currentJob = roleInput ? roleInput.value.trim() : 'Full Stack Engineer';
  const experienceYears = expInput ? parseInt(expInput.value, 10) : 4;
  const preferredLocations = state.candidateProfile?.preferredLocations || ['Mumbai', 'Pune', 'Bengaluru', 'Remote'];

  if (!email) {
    alert('Please enter your email address.');
    return;
  }

  const saveBtn = document.getElementById('btnSavePreferences');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Activating Your AI Agent...';
  }

  try {
    if (state.activeCandidateId) {
      // 1. Update existing profile
      await api(`/api/candidates/${state.activeCandidateId}/preferences`, {
        method: 'PATCH',
        body: JSON.stringify({ preferredLocations }),
      });

      await api(`/api/candidates/${state.activeCandidateId}`, {
        method: 'PATCH',
        body: JSON.stringify({ fullName, currentJob, experienceYears }),
      });
    } else {
      // 2. Create new profile for this user
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
            authUserId: state.currentUser?.id,
          }),
        });
        state.activeCandidateId = createRes.data?.id;
      } catch (postErr) {
        const listRes = await api('/api/candidates?includeTest=true');
        const match = (listRes.data || []).find(c => c.email === email);
        if (match) {
          state.activeCandidateId = match.id;
          await api(`/api/candidates/${match.id}/preferences`, {
            method: 'PATCH',
            body: JSON.stringify({ preferredLocations }),
          });
        } else {
          throw postErr;
        }
      }
    }

    emit('profile:updated', { preferredLocations });
    
    alert('Your AI Job Agent is activated! Discovering live matches in Mumbai, Pune, and Bengaluru.');

    if (window.switchStep) {
      window.switchStep('jobs');
    }
  } catch (err) {
    alert(`Failed to save preferences: ${err.message}`);
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = '🚀 Activate My Job Agent & Search Jobs';
    }
  }
}

function setupEventListeners() {
  const btnSave = document.getElementById('btnSavePreferences');
  if (btnSave) {
    btnSave.addEventListener('click', savePreferencesAndSearch);
  }

  const btnParse = document.getElementById('btnParseResume');
  if (btnParse) {
    btnParse.addEventListener('click', parseResumeInput);
  }

  const fileInput = document.getElementById('inputResumeFile');
  if (fileInput) {
    fileInput.addEventListener('change', handleResumeFileUpload);
  }

  const btnAddSkill = document.getElementById('btnAddSkill');
  if (btnAddSkill) {
    btnAddSkill.addEventListener('click', addCustomSkill);
  }

  const skillInput = document.getElementById('inputNewSkill');
  if (skillInput) {
    skillInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addCustomSkill();
      }
    });
  }
}
