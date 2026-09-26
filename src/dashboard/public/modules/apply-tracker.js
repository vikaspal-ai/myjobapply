// Jobsapply Applications & Human Review Tracker Module (Step 4)
// Manages application lifecycle, screening QA answers, and approval gates

import { api, escapeHtml } from './api.js';
import { state } from './state.js';

export async function initApplyTracker() {
  await loadApplications();
}

export async function loadApplications() {
  const container = document.getElementById('applicationsContainer');
  if (!container) return;

  try {
    let url = '/api/applications';
    if (state.activeCandidateId) {
      url += `?candidateId=${state.activeCandidateId}`;
    }

    const res = await api(url);
    state.applications = res.data || [];

    const countBadge = document.getElementById('applyCountBadge');
    if (countBadge) {
      countBadge.textContent = `${state.applications.length} Submissions`;
    }

    if (state.applications.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 3rem; color: var(--color-text-muted); background: var(--color-surface-soft); border-radius: 16px;">
          <p style="font-size: 1.5rem; margin-bottom: 0.5rem;">📬</p>
          <p>No active applications submitted yet.</p>
          <p style="font-size: 0.8rem; margin-top: 0.25rem;">Click "Auto-Apply ⚡" on any job card in Step 2 to generate submissions.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = state.applications.map(app => `
      <div class="job-card-modern" style="flex-direction: row; align-items: center; justify-content: space-between; gap: 1rem;">
        <div>
          <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.25rem;">
            <span class="job-company-title">${escapeHtml(app.companyName || 'Company')}</span>
            <span style="font-size: 0.72rem; font-weight: 700; padding: 0.2rem 0.5rem; border-radius: 4px; background: rgba(37,99,235,0.15); color: #2563eb;">
              ${escapeHtml(app.status)}
            </span>
          </div>
          <h4 style="font-size: 1.05rem; font-weight: 700;">${escapeHtml(app.jobTitle || 'Software Engineer')}</h4>
          <p style="font-size: 0.78rem; color: var(--color-text-muted);">
            Screening Form Filled · ATS Score: 92 · Submitted: ${new Date(app.createdAt).toLocaleDateString()}
          </p>
        </div>

        <div style="display: flex; gap: 0.5rem;">
          ${app.status === 'PENDING_APPROVAL' ? `
            <button class="btn-gradient btn-sm" onclick="window.applyTrackerModule.approveApp('${app.id}')">Approve & Send</button>
            <button class="btn-outline btn-sm" onclick="window.applyTrackerModule.rejectApp('${app.id}')">Reject</button>
          ` : `
            <span style="color: #10b981; font-weight: 700; font-size: 0.82rem;">✓ Completed</span>
          `}
        </div>
      </div>
    `).join('');

  } catch (err) {
    console.error('Failed to load applications:', err);
  }
}

export async function approveApp(appId) {
  try {
    await api(`/api/applications/${appId}/approve`, { method: 'POST' });
    await loadApplications();
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

export async function rejectApp(appId) {
  try {
    await api(`/api/applications/${appId}/reject`, { method: 'POST' });
    await loadApplications();
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}
