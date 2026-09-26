// Jobsapply Live Job Feed & Match Discovery Module (Step 2)
// Connects candidate profile to live Indian tech opportunities

import { api, escapeHtml } from './api.js';
import { state, on } from './state.js';

export async function initJobsFeed() {
  setupJobControls();
  
  // Listen for profile changes to reload matching
  on('profile:updated', async () => {
    await loadJobs();
  });
}

export async function loadJobs() {
  const container = document.getElementById('jobsGridContainer');
  if (!container) return;

  container.innerHTML = `
    <div style="text-align: center; grid-column: 1/-1; padding: 2.5rem; color: var(--color-text-muted);">
      Searching verified opportunities in your preferred locations...
    </div>
  `;

  try {
    let url = `/api/jobs?realOnly=${state.realOnly}`;
    if (state.selectedLocation && state.selectedLocation !== 'all') {
      url += `&location=${encodeURIComponent(state.selectedLocation)}`;
    }
    if (state.activeCandidateId) {
      url += `&candidateId=${state.activeCandidateId}`;
    }

    const res = await api(url);
    state.jobs = res.data || [];

    const badge = document.getElementById('jobsCountBadge');
    if (badge) {
      badge.textContent = `${state.jobs.length} verified jobs`;
    }

    if (state.jobs.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; grid-column: 1/-1; padding: 3rem; color: var(--color-text-muted);">
          No matching jobs found for this location filter.
        </div>
      `;
      return;
    }

    container.innerHTML = state.jobs.map(job => {
      const isBest = job.matchScore && job.matchScore >= 0.8;
      const scorePill = job.matchScore 
        ? `<span class="fit-score-badge ${isBest ? 'best' : ''}">${isBest ? '★ BEST ' : ''}${Math.round(job.matchScore * 100)}%</span>`
        : `<span class="fit-score-badge">Verified</span>`;

      const locationBadge = job.locationDisplay 
        ? `<span class="job-loc-badge">📍 ${escapeHtml(job.locationDisplay)}</span>`
        : `<span class="job-loc-badge">📍 India</span>`;

      return `
        <div class="job-card-modern">
          <div>
            <div class="job-card-header">
              <div>
                <span class="job-company-title">${escapeHtml(job.companyName || 'Top Tech Firm')}</span>
                <h4 class="job-role-title">${escapeHtml(job.title)}</h4>
              </div>
              ${scorePill}
            </div>
            ${locationBadge}
            <p style="font-size: 0.82rem; color: var(--color-text-body); margin-top: 0.75rem; line-height: 1.5;">
              ${escapeHtml((job.description || '').slice(0, 120))}...
            </p>
          </div>

          <div class="job-card-footer">
            <a href="${escapeHtml(job.applyUrl)}" target="_blank" rel="noopener noreferrer" class="btn-outline btn-sm">
              Apply on Portal ↗
            </a>
            <button class="btn-gradient btn-sm" onclick="window.jobsFeedModule.triggerAutoApply('${job.id}')">
              Auto-Apply ⚡
            </button>
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('Failed to load jobs:', err);
    container.innerHTML = `
      <div style="text-align: center; grid-column: 1/-1; padding: 2rem; color: #ef4444;">
        Failed to load jobs from server.
      </div>
    `;
  }
}

export function filterByLocation(loc) {
  state.selectedLocation = loc;
  const chips = document.querySelectorAll('.location-chips .chip-btn');
  chips.forEach(chip => {
    if (chip.dataset.loc === loc) {
      chip.classList.add('active');
    } else {
      chip.classList.remove('active');
    }
  });
  loadJobs();
}

export function toggleRealOnly(checked) {
  state.realOnly = checked;
  loadJobs();
}

export async function triggerAutoApply(jobId) {
  if (!state.activeCandidateId) {
    alert('Please select a candidate profile first.');
    return;
  }
  try {
    await api('/api/applications', {
      method: 'POST',
      body: JSON.stringify({
        candidateId: state.activeCandidateId,
        jobId: jobId,
      }),
    });
    alert('Application prepared with tailored ATS resume and screening answers! Switching to Step 4.');
    if (window.switchStep) {
      window.switchStep('apply');
    }
  } catch (err) {
    alert(`Could not create application: ${err.message}`);
  }
}

function setupJobControls() {
  const realToggle = document.getElementById('realJobsToggle');
  if (realToggle) {
    realToggle.addEventListener('change', (e) => toggleRealOnly(e.target.checked));
  }
}
