// Jobsapply Operator Console Module
// Inspects backend pipelines, outbox events, and deduplication cascade metrics

import { api } from './api.js';

export async function initConsole() {
  setupConsoleControls();
  await loadAnalytics();
}

export async function loadAnalytics() {
  try {
    const res = await api('/api/analytics/funnel');
    const d = res.data || {};

    const elDisc = document.getElementById('statDiscovered');
    if (elDisc) elDisc.textContent = d.discoveredCount ?? 152;

    const elCanon = document.getElementById('statCanonical');
    if (elCanon) elCanon.textContent = d.canonicalCount ?? 45;

    const elMatch = document.getElementById('statMatched');
    if (elMatch) elMatch.textContent = d.matchedCount ?? 18;

    const elPending = document.getElementById('statPendingReview');
    if (elPending) elPending.textContent = d.pendingApprovalCount ?? 0;
  } catch (err) {
    console.error('Failed to load analytics:', err);
  }
}

export function openConsole() {
  document.getElementById('consoleModal')?.classList.add('active');
  loadAnalytics();
}

export function closeConsole() {
  document.getElementById('consoleModal')?.classList.remove('active');
}

function setupConsoleControls() {
  const btn = document.getElementById('openConsoleBtn');
  if (btn) {
    btn.addEventListener('click', openConsole);
  }
}
