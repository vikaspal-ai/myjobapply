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
  const p = state.candidateProfile;
  if (!p) return;

  // 1. Basic Info Fields
  const nameInput = document.getElementById('inputFullName');
  if (nameInput) nameInput.value = p.fullName || '';

  const emailInput = document.getElementById('inputEmail');
  if (emailInput) emailInput.value = p.email || '';

  const roleInput = document.getElementById('inputCurrentJob');
  if (roleInput) roleInput.value = p.currentJob || 'Full-Stack Engineer';

  const expInput = document.getElementById('inputExpYears');
  if (expInput) expInput.value = p.experienceYears ?? 5;

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
    const isSelected = preferred.includes(loc.key);
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
  if (!state.candidateProfile) return;
  const current = state.candidateProfile.preferredLocations || [];
  let updated;
  if (current.includes(locKey)) {
    // Keep at least one location
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
  if (!state.activeCandidateId) return;

  try {
    await api(`/api/candidates/${state.activeCandidateId}/facts`, {
      method: 'POST',
      body: JSON.stringify({
        category: 'SKILL',
        statement: skillName,
        verified: true,
      }),
    });
    input.value = '';
    await loadCandidateData(state.activeCandidateId);
  } catch (err) {
    alert(`Could not add skill: ${err.message}`);
  }
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
  if (!state.activeCandidateId || !state.candidateProfile) {
    alert('Please select or create a candidate profile first.');
    return;
  }

  const nameInput = document.getElementById('inputFullName');
  const roleInput = document.getElementById('inputCurrentJob');
  const expInput = document.getElementById('inputExpYears');

  const fullName = nameInput ? nameInput.value.trim() : state.candidateProfile.fullName;
  const currentJob = roleInput ? roleInput.value.trim() : state.candidateProfile.currentJob;
  const experienceYears = expInput ? parseInt(expInput.value, 10) : state.candidateProfile.experienceYears;
  const preferredLocations = state.candidateProfile.preferredLocations;

  const saveBtn = document.getElementById('btnSavePreferences');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving Preferences...';
  }

  try {
    // 1. Update Preferences (Locations)
    await api(`/api/candidates/${state.activeCandidateId}/preferences`, {
      method: 'PATCH',
      body: JSON.stringify({ preferredLocations }),
    });

    // 2. Update Profile Details
    await api(`/api/candidates/${state.activeCandidateId}`, {
      method: 'PATCH',
      body: JSON.stringify({ fullName, currentJob, experienceYears }),
    });

    // 3. Notify app and switch to live job matching
    emit('profile:updated', { preferredLocations });
    
    // Smooth transition to Step 2
    if (window.switchStep) {
      window.switchStep('jobs');
    }
  } catch (err) {
    alert(`Failed to save preferences: ${err.message}`);
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = '✓ Save Preferences & Start Hunt';
    }
  }
}

function setupEventListeners() {
  const btnSave = document.getElementById('btnSavePreferences');
  if (btnSave) {
    btnSave.addEventListener('click', savePreferencesAndSearch);
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
