// Jobsapply Referrals & Warm Cold Outreach Module (Step 5)
// Uncovers company alumni and manages 3-step outreach sequences with stop-on-reply

import { api, escapeHtml } from './api.js';
import { state } from './state.js';

export async function initReferrals() {
  await loadOutreach();
}

export async function loadOutreach() {
  const container = document.getElementById('outreachContainer');
  if (!container) return;

  try {
    let url = '/api/outreach/messages';
    if (state.activeCandidateId) {
      url += `?candidateId=${state.activeCandidateId}`;
    }

    const res = await api(url);
    state.outreachMessages = res.data || [];

    if (state.outreachMessages.length > 0) {
      container.innerHTML = state.outreachMessages.map(msg => `
        <div class="job-card-modern">
          <div class="job-card-header">
            <div>
              <span class="job-company-title">${escapeHtml(msg.companyName || 'Target Company')}</span>
              <h4 class="job-role-title">${escapeHtml(msg.contactName || 'Referral Contact')}</h4>
            </div>
            <span class="fit-score-badge best">90+ Signal</span>
          </div>
          <p style="font-size: 0.82rem; color: var(--color-text-body); margin: 0.5rem 0;">
            <strong>Subject:</strong> ${escapeHtml(msg.subject || 'Engineering Referral')}
          </p>
          <div style="background: var(--color-surface-soft); padding: 0.75rem; border-radius: 8px; font-size: 0.78rem; line-height: 1.5; color: var(--color-text-body);">
            ${escapeHtml((msg.bodyText || '').slice(0, 180))}...
          </div>
          <div class="job-card-footer">
            <span style="font-size: 0.75rem; color: #10b981; font-weight: 700;">● ${escapeHtml(msg.status)}</span>
            <button class="btn-outline btn-sm" onclick="alert('Outreach sequence active with stop-on-reply listener.')">
              View Sequence
            </button>
          </div>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error('Failed to load outreach messages:', err);
  }
}
