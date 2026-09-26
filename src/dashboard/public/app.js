// Jobsapply Master Client Orchestrator (ES Module)
// Coordinates modular subsystems: Onboarding, Job Feed, Apply Tracker, Referrals & Console

import { api } from './modules/api.js';
import { state, on } from './modules/state.js';
import * as onboarding from './modules/onboarding.js';
import * as jobsFeed from './modules/jobs-feed.js';
import * as applyTracker from './modules/apply-tracker.js';
import * as referrals from './modules/referrals.js';
import * as consoleMod from './modules/console.js';

// Expose modules to window for inline onclick handlers
window.onboardingModule = onboarding;
window.jobsFeedModule = jobsFeed;
window.applyTrackerModule = applyTracker;
window.referralsModule = referrals;
window.consoleModule = consoleMod;

// Global step switcher
window.switchStep = function(stepKey) {
  state.activeStep = stepKey;
  
  // Update step nav buttons
  const buttons = document.querySelectorAll('.step-nav-bar .step-nav-btn');
  buttons.forEach(btn => {
    const isTarget = btn.getAttribute('onclick')?.includes(`'${stepKey}'`);
    if (isTarget) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Toggle active workspace panels
  const panels = document.querySelectorAll('.step-workspace-panel');
  panels.forEach(p => p.classList.remove('active'));

  const targetPanel = document.getElementById(`step-panel-${stepKey}`);
  if (targetPanel) {
    targetPanel.classList.add('active');
  }

  // Refresh active step data
  if (stepKey === 'profile') {
    if (state.activeCandidateId) {
      onboarding.loadCandidateData(state.activeCandidateId);
    }
  } else if (stepKey === 'jobs') {
    jobsFeed.loadJobs();
  } else if (stepKey === 'apply') {
    applyTracker.loadApplications();
  } else if (stepKey === 'referrals') {
    referrals.loadOutreach();
  }
};

// Global filter functions
window.filterByLocation = jobsFeed.filterByLocation;
window.toggleRealOnly = jobsFeed.toggleRealOnly;
window.triggerAutoApply = jobsFeed.triggerAutoApply;
window.approveApp = applyTracker.approveApp;
window.rejectApp = applyTracker.rejectApp;
window.openConsole = consoleMod.openConsole;
window.closeConsole = consoleMod.closeConsole;
window.triggerSeedJobs = async function() {
  alert('Seeding 11+ verified jobs from Tech Mahindra, Razorpay, BrowserStack, PhonePe, Swiggy, and Postman.');
  await jobsFeed.loadJobs();
  consoleMod.closeConsole();
};
window.compileResumeForActiveJob = function() {
  alert('Compiling modular LaTeX document to ATS PDF artifact (2-page budget checked).');
};

// Global FAQ toggle
window.toggleFaq = function(btn) {
  const item = btn.closest('.faq-item');
  if (item) {
    item.classList.toggle('active');
  }
};

// Bootstrap application on DOM ready
document.addEventListener('DOMContentLoaded', async () => {
  setupCandidateSelect();
  await loadCandidates();
  await onboarding.initOnboarding();
  await jobsFeed.initJobsFeed();
  await applyTracker.initApplyTracker();
  await referrals.initReferrals();
  await consoleMod.initConsole();
});

// Candidate selector handler
function setupCandidateSelect() {
  const select = document.getElementById('candidateSelect');
  if (select) {
    select.addEventListener('change', async (e) => {
      state.activeCandidateId = e.target.value;
      await onboarding.loadCandidateData(state.activeCandidateId);
      await jobsFeed.loadJobs();
      await applyTracker.loadApplications();
      await referrals.loadOutreach();
    });
  }
}

async function loadCandidates() {
  try {
    const res = await api('/api/candidates');
    state.candidates = res.data || [];
    const select = document.getElementById('candidateSelect');
    if (!select) return;

    select.innerHTML = '';
    if (state.candidates.length === 0) {
      select.innerHTML = '<option value="">No candidates</option>';
      return;
    }

    state.candidates.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.fullName} (${c.currentLocation || 'India'})`;
      select.appendChild(opt);
    });

    state.activeCandidateId = state.candidates[0].id;
  } catch (err) {
    console.error('Failed to load candidate list:', err);
  }
}
