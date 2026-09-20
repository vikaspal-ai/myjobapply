// Job Hunt Platform Frontend Client State & Controller
const state = {
  candidates: [],
  activeCandidateId: null,
  activeTab: 'overview',
  appStatusFilter: 'PENDING_APPROVAL',
  factCategoryFilter: 'ALL',
  selectedAppId: null,
};

// Utility API Helper
async function api(url, options = {}) {
  try {
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      ...options,
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    return data;
  } catch (err) {
    console.error(`API Error [${url}]:`, err);
    throw err;
  }
}

// 1. Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  setupNavigation();
  setupModals();
  setupPipelineControls();
  await loadCandidates();
  await refreshCurrentTab();
});

// Navigation Setup
function setupNavigation() {
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', async () => {
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      const tabName = tab.dataset.tab;
      state.activeTab = tabName;
      document.getElementById(`tab-${tabName}`)?.classList.add('active');

      await refreshCurrentTab();
    });
  });

  // Candidate Switcher
  const candidateSelect = document.getElementById('candidateSelect');
  candidateSelect.addEventListener('change', async (e) => {
    state.activeCandidateId = e.target.value;
    await refreshCurrentTab();
  });

  // Application Status Filter Buttons
  const filterBtns = document.querySelectorAll('[data-status-filter]');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.appStatusFilter = btn.dataset.statusFilter;
      await loadApplications();
    });
  });

  // Job Search Button
  document.getElementById('btnSearchJobs')?.addEventListener('click', async () => {
    await loadJobs();
  });

  // Fact Category Tabs
  const categoryTabs = document.querySelectorAll('.category-tab');
  categoryTabs.forEach(tab => {
    tab.addEventListener('click', async () => {
      categoryTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.factCategoryFilter = tab.dataset.category;
      await loadFacts();
    });
  });

  // Activity Refresh Button
  document.getElementById('btnRefreshActivity')?.addEventListener('click', async () => {
    await loadAnalytics();
  });
}

// Refresh whatever tab is currently active
async function refreshCurrentTab() {
  if (state.activeTab === 'overview') {
    await loadAnalytics();
  } else if (state.activeTab === 'approvals') {
    await loadApplications();
  } else if (state.activeTab === 'jobs') {
    await loadJobs();
  } else if (state.activeTab === 'facts') {
    await loadFacts();
  }
}

// 2. Candidates
async function loadCandidates() {
  try {
    const res = await api('/api/candidates');
    state.candidates = res.data || [];
    const select = document.getElementById('candidateSelect');
    select.innerHTML = '';

    if (state.candidates.length === 0) {
      select.innerHTML = '<option value="">No candidates found</option>';
      return;
    }

    state.candidates.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.fullName} (${c.email})`;
      select.appendChild(opt);
    });

    state.activeCandidateId = state.candidates[0].id;
  } catch (err) {
    console.error('Failed to load candidates:', err);
  }
}

// 3. Analytics & Overview
async function loadAnalytics() {
  try {
    const res = await api('/api/analytics/metrics');
    const m = res.data;

    document.getElementById('statDiscovered').textContent = m.totalDiscoveredPostings || 0;
    document.getElementById('statCanonical').textContent = m.totalCanonicalJobs || 0;
    document.getElementById('statMatched').textContent = m.totalMatchedOpportunities || 0;
    document.getElementById('statPendingReview').textContent = m.applications.pendingApproval || 0;
    document.getElementById('pendingBadge').textContent = m.applications.pendingApproval || 0;

    // Quota Meter
    const submitted = m.dailyBudget.applicationsSubmittedToday || 0;
    const maxDaily = m.dailyBudget.targetMaxDailyApplications || 15;
    const remaining = m.dailyBudget.remainingDailyAllowance || 0;
    const pct = Math.min(100, (submitted / maxDaily) * 100);

    const quotaBar = document.getElementById('quotaBar');
    quotaBar.style.width = `${pct}%`;
    document.getElementById('quotaSubmittedText').textContent = `${submitted} submitted today`;
    document.getElementById('quotaRemainingText').textContent = `${remaining} remaining allowance (Max ${maxDaily}/day)`;

    // ATS Breakdown
    const atsContainer = document.getElementById('atsList');
    atsContainer.innerHTML = '';
    const atsKeys = Object.keys(m.atsDistribution || {});
    if (atsKeys.length === 0) {
      atsContainer.innerHTML = '<div class="empty-state">No sources registered yet</div>';
    } else {
      atsKeys.forEach(key => {
        const item = document.createElement('div');
        item.className = 'ats-item';
        item.innerHTML = `
          <span class="ats-name">${key}</span>
          <span class="ats-count">${m.atsDistribution[key]}</span>
        `;
        atsContainer.appendChild(item);
      });
    }

    // Outbox Activity Table
    const pipeRes = await api('/api/pipeline/status');
    const tableBody = document.getElementById('outboxEventsTable');
    tableBody.innerHTML = '';
    const events = pipeRes.data?.recentEvents || [];

    if (events.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4">No events found in outbox</td></tr>';
    } else {
      events.forEach(e => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><code class="font-bold">${e.type}</code></td>
          <td>${e.producer}</td>
          <td><span class="badge-outline">${(e.correlationId || '').slice(0, 8)}...</span></td>
          <td><span class="badge ${e.published ? 'badge-approved' : 'badge-pending'}">${e.published ? 'PUBLISHED' : 'PENDING'}</span></td>
          <td>${new Date(e.createdAt).toLocaleTimeString()}</td>
        `;
        tableBody.appendChild(tr);
      });
    }
  } catch (err) {
    console.error('Failed to load analytics:', err);
  }
}

// 4. Applications (Human Review Queue)
async function loadApplications() {
  const container = document.getElementById('applicationsList');
  container.innerHTML = '<div class="loading-spinner">Loading applications...</div>';

  try {
    const candidateQuery = state.activeCandidateId ? `&candidateId=${state.activeCandidateId}` : '';
    const statusQuery = state.appStatusFilter !== 'ALL' ? `&status=${state.appStatusFilter}` : '';
    const res = await api(`/api/applications?limit=50${candidateQuery}${statusQuery}`);
    const apps = res.data || [];

    if (apps.length === 0) {
      container.innerHTML = `
        <div class="card text-center py-4">
          <p class="text-muted">No applications found with status: <strong>${state.appStatusFilter}</strong></p>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    apps.forEach(app => {
      const card = document.createElement('div');
      card.className = 'app-card';

      let statusBadgeClass = 'badge-pending';
      if (app.status === 'APPROVED') statusBadgeClass = 'badge-approved';
      if (app.status === 'SUBMITTED') statusBadgeClass = 'badge-submitted';
      if (app.status === 'PAUSED') statusBadgeClass = 'badge-paused';

      card.innerHTML = `
        <div class="app-main">
          <h4>${app.jobTitle || 'Role'}</h4>
          <div class="app-meta">
            <span>🏢 <strong>${app.companyName || 'Company'}</strong></span>
            <span>📄 Resume v${app.resumeVersionNo || 1}</span>
            <span class="badge ${statusBadgeClass}">${app.status}</span>
            ${app.notes ? `<span class="text-dim">"${app.notes.slice(0, 40)}..."</span>` : ''}
          </div>
        </div>
        <div class="app-actions">
          <button class="btn btn-secondary btn-sm btn-review" data-app-id="${app.id}">
            🛡️ Review & Approve
          </button>
        </div>
      `;

      card.querySelector('.btn-review')?.addEventListener('click', () => {
        openApprovalModal(app.id);
      });

      container.appendChild(card);
    });
  } catch (err) {
    container.innerHTML = `<div class="card text-amber">Failed to load applications: ${err.message}</div>`;
  }
}

// 5. Human-in-the-Loop Review & Approval Modal
async function openApprovalModal(appId) {
  state.selectedAppId = appId;
  const modal = document.getElementById('approvalModal');
  modal.classList.remove('hidden');

  try {
    const res = await api(`/api/applications/${appId}`);
    const app = res.data;

    document.getElementById('modalJobTitle').textContent = app.jobTitle || 'Application Review';
    document.getElementById('modalCompanySubtitle').textContent = `${app.companyName} • Status: ${app.status}`;

    // Update Gate Status Indicator
    const gateEl = document.getElementById('approvalGateStatus');
    if (app.status === 'APPROVED') {
      gateEl.innerHTML = '<span class="badge badge-approved">✓ APPROVED — Ready for Automated Submission</span>';
    } else if (app.status === 'PENDING_APPROVAL' || app.status === 'PREPARED') {
      gateEl.innerHTML = '<span class="badge badge-pending">⚠️ PENDING HUMAN APPROVAL — Submission is strictly blocked</span>';
    } else if (app.status === 'PAUSED') {
      gateEl.innerHTML = '<span class="badge badge-paused">🛑 PAUSED — Requires Human Resolution</span>';
    } else if (app.status === 'SUBMITTED') {
      gateEl.innerHTML = '<span class="badge badge-submitted">🚀 SUBMITTED — Completed</span>';
    }

    // Modal Evidence List
    const evidenceList = document.getElementById('modalEvidenceList');
    evidenceList.innerHTML = '';
    const criteria = app.match?.criteria || [];
    if (criteria.length === 0) {
      evidenceList.innerHTML = '<p class="text-muted">No criteria breakdown found for this job match.</p>';
    } else {
      criteria.forEach(c => {
        const item = document.createElement('div');
        item.className = 'evidence-item';
        item.innerHTML = `
          <div class="evidence-header">
            <span>${c.criterion}</span>
            <span class="text-green font-bold">${Math.round(c.score * 100)}%</span>
          </div>
          <div class="evidence-text">Evidence: ${c.evidence || 'Verified candidate profile fact match.'}</div>
          <div class="evidence-citations">Fact IDs: ${(c.factIds || []).join(', ') || 'Direct candidate fact'}</div>
        `;
        evidenceList.appendChild(item);
      });
    }

    // Modal Resume Tab
    document.getElementById('modalResumeTitle').textContent = app.resume?.title || 'Tailored Resume';
    document.getElementById('modalResumeTemplate').textContent = app.resume?.templateName || 'modern-deedy';
    document.getElementById('modalResumeMarkdown').textContent = app.resume?.markdownText || 'No resume markdown content available';

    // Modal Cover Letter Tab
    document.getElementById('modalCoverLetterText').textContent = app.coverLetter?.markdownText || 'No cover letter content generated';

    // Modal Answers Tab
    const answersList = document.getElementById('modalAnswersList');
    answersList.innerHTML = '';
    const answers = app.candidateAnswers || [];
    if (answers.length === 0) {
      answersList.innerHTML = '<p class="text-muted">No auto-fill answers recorded.</p>';
    } else {
      answers.forEach(a => {
        const isSens = a.category === 'authorization' || a.category === 'sponsorship';
        const item = document.createElement('div');
        item.className = `answer-item ${isSens ? 'sensitive' : ''}`;
        item.innerHTML = `
          <div>
            <div class="font-bold">${a.questionPattern}</div>
            <div class="text-muted text-sm">${a.category.toUpperCase()} • Verified: ${a.verified ? 'YES' : 'NO'}</div>
          </div>
          <div class="font-bold">${a.answerText}</div>
        `;
        answersList.appendChild(item);
      });
    }

  } catch (err) {
    alert(`Failed to load application details: ${err.message}`);
  }
}

function setupModals() {
  // Close Approval Modal
  document.getElementById('btnCloseApprovalModal')?.addEventListener('click', () => {
    document.getElementById('approvalModal').classList.add('hidden');
    state.selectedAppId = null;
  });

  // Modal Tabs
  const modalTabs = document.querySelectorAll('.modal-tab');
  modalTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      modalTabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.modal-tab-content').forEach(c => c.classList.remove('active'));

      tab.classList.add('active');
      const target = tab.dataset.modalTab;
      document.getElementById(`modalTab-${target}`)?.classList.add('active');
    });
  });

  // Modal Actions: Approve
  document.getElementById('btnModalApprove')?.addEventListener('click', async () => {
    if (!state.selectedAppId) return;
    try {
      await api(`/api/applications/${state.selectedAppId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ approvedBy: 'Dashboard User' }),
      });
      alert('✓ Application APPROVED! Gate unlocked for automated submission.');
      await openApprovalModal(state.selectedAppId);
      await loadApplications();
      await loadAnalytics();
    } catch (err) {
      alert(`Approval error: ${err.message}`);
    }
  });

  // Modal Actions: Pause
  document.getElementById('btnModalPause')?.addEventListener('click', async () => {
    if (!state.selectedAppId) return;
    const reason = prompt('Enter reason for pausing:', 'Manual review requested adjustments');
    if (!reason) return;
    try {
      await api(`/api/applications/${state.selectedAppId}/pause`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      alert('Application paused.');
      await openApprovalModal(state.selectedAppId);
      await loadApplications();
    } catch (err) {
      alert(`Error pausing application: ${err.message}`);
    }
  });

  // Modal Actions: Sandbox Run
  document.getElementById('btnModalRunSandbox')?.addEventListener('click', async () => {
    if (!state.selectedAppId) return;
    try {
      const res = await api(`/api/applications/${state.selectedAppId}/run`, {
        method: 'POST',
        body: JSON.stringify({ path: 'PLAYWRIGHT', autoSubmit: true }),
      });
      alert(`🚀 Sandbox Run Completed!\nStatus: ${res.data.status}\nMessage: ${res.data.result?.confirmationSignal || 'Submitted'}`);
      await openApprovalModal(state.selectedAppId);
      await loadApplications();
      await loadAnalytics();
    } catch (err) {
      alert(`Execution Error: ${err.message}`);
    }
  });

  // Add Fact Modal
  const addFactModal = document.getElementById('addFactModal');
  document.getElementById('btnOpenAddFactModal')?.addEventListener('click', () => {
    addFactModal.classList.remove('hidden');
  });
  document.getElementById('btnCloseAddFactModal')?.addEventListener('click', () => {
    addFactModal.classList.add('hidden');
  });
  document.getElementById('btnCancelAddFact')?.addEventListener('click', () => {
    addFactModal.classList.add('hidden');
  });

  document.getElementById('addFactForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!state.activeCandidateId) {
      alert('Please select a candidate first');
      return;
    }
    const category = document.getElementById('factCategory').value;
    const statement = document.getElementById('factStatement').value;
    const verified = document.getElementById('factVerified').checked;

    try {
      await api(`/api/candidates/${state.activeCandidateId}/facts`, {
        method: 'POST',
        body: JSON.stringify({ category, statement, verified }),
      });
      addFactModal.classList.add('hidden');
      document.getElementById('factStatement').value = '';
      await loadFacts();
    } catch (err) {
      alert(`Failed to add fact: ${err.message}`);
    }
  });
}

// 6. Jobs & Matches Feed
async function loadJobs() {
  const container = document.getElementById('jobsList');
  container.innerHTML = '<div class="loading-spinner">Searching canonical jobs...</div>';

  const search = document.getElementById('jobSearchInput')?.value || '';
  const minScore = document.getElementById('minScoreFilter')?.value || '';

  try {
    const candidateQuery = state.activeCandidateId ? `&candidateId=${state.activeCandidateId}` : '';
    const searchQuery = search ? `&search=${encodeURIComponent(search)}` : '';
    const minScoreQuery = minScore ? `&minScore=${minScore}` : '';

    const res = await api(`/api/jobs?limit=50${candidateQuery}${searchQuery}${minScoreQuery}`);
    const jobs = res.data || [];

    if (jobs.length === 0) {
      container.innerHTML = '<div class="card text-center py-4 text-muted">No jobs matching criteria</div>';
      return;
    }

    container.innerHTML = '';
    jobs.forEach(j => {
      const card = document.createElement('div');
      card.className = 'job-card';

      const matchScore = j.match?.score !== undefined ? Math.round(j.match.score * 100) : null;
      const scoreBadge = matchScore !== null
        ? `<span class="match-score-badge">🎯 ${matchScore}% Fit</span>`
        : '<span class="badge-outline">Unscored</span>';

      card.innerHTML = `
        <div>
          <div class="job-header">
            <h4 class="job-title">${j.title}</h4>
            ${scoreBadge}
          </div>
          <div class="job-company">🏢 <strong>${j.companyName}</strong> • ${j.atsType}</div>
          <div class="text-sm text-dim mb-2">📍 ${j.location?.type || 'Remote / Hybrid'}</div>
        </div>
        <div>
          <div class="app-actions mt-4">
            <button class="btn btn-primary btn-sm btn-draft" data-job-id="${j.id}">
              + Draft Application
            </button>
            <a href="${j.applyUrl}" target="_blank" class="btn btn-ghost btn-sm">External Link ↗</a>
          </div>
        </div>
      `;

      card.querySelector('.btn-draft')?.addEventListener('click', async () => {
        if (!state.activeCandidateId) return;
        try {
          await api('/api/applications/draft', {
            method: 'POST',
            body: JSON.stringify({
              candidateId: state.activeCandidateId,
              jobId: j.id,
              notes: 'Drafted from Web Dashboard',
            }),
          });
          alert('Draft application created! Switched to Human Review Queue.');
          // Switch to reviews tab
          document.querySelector('[data-tab="approvals"]')?.click();
        } catch (err) {
          alert(`Draft error: ${err.message}`);
        }
      });

      container.appendChild(card);
    });
  } catch (err) {
    container.innerHTML = `<div class="card text-amber">Failed to search jobs: ${err.message}</div>`;
  }
}

// 7. Grounded Candidate Fact Store
async function loadFacts() {
  const container = document.getElementById('factsList');
  container.innerHTML = '<div class="loading-spinner">Loading facts...</div>';

  if (!state.activeCandidateId) {
    container.innerHTML = '<div class="card text-center py-4">Please select a candidate.</div>';
    return;
  }

  try {
    const categoryQuery = state.factCategoryFilter !== 'ALL' ? `?category=${state.factCategoryFilter}` : '';
    const res = await api(`/api/candidates/${state.activeCandidateId}/facts${categoryQuery}`);
    const facts = res.data || [];

    if (facts.length === 0) {
      container.innerHTML = '<div class="card text-center py-4 text-muted">No candidate facts recorded in this category.</div>';
      return;
    }

    container.innerHTML = '';
    facts.forEach(f => {
      const card = document.createElement('div');
      card.className = 'fact-card';
      card.innerHTML = `
        <div>
          <div class="fact-header">
            <span class="fact-category-badge">${f.category}</span>
            <span class="badge ${f.verified ? 'badge-approved' : 'badge-paused'}">
              ${f.verified ? 'VERIFIED' : 'UNVERIFIED'}
            </span>
          </div>
          <div class="fact-statement">${f.statement}</div>
        </div>
        <div class="fact-footer">
          <button class="btn btn-ghost btn-sm btn-toggle-verify" data-fact-id="${f.id}" data-verified="${f.verified}">
            ${f.verified ? 'Mark Unverified' : '✓ Verify Fact'}
          </button>
          <span>Fact ID: ${f.id.slice(0, 8)}</span>
        </div>
      `;

      card.querySelector('.btn-toggle-verify')?.addEventListener('click', async (e) => {
        const factId = e.target.dataset.factId;
        const currentVerified = e.target.dataset.verified === 'true';
        try {
          await api(`/api/candidates/${state.activeCandidateId}/facts/${factId}`, {
            method: 'PATCH',
            body: JSON.stringify({ verified: !currentVerified }),
          });
          await loadFacts();
        } catch (err) {
          alert(`Error updating fact: ${err.message}`);
        }
      });

      container.appendChild(card);
    });
  } catch (err) {
    container.innerHTML = `<div class="card text-amber">Failed to load facts: ${err.message}</div>`;
  }
}

// 8. Pipeline Controls Setup
function setupPipelineControls() {
  const crawlForm = document.getElementById('crawlForm');
  crawlForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = document.getElementById('crawlUrl').value;
    const companyName = document.getElementById('crawlCompanyName').value;
    const feedback = document.getElementById('crawlFeedback');
    const btn = document.getElementById('btnCrawl');

    feedback.classList.remove('hidden');
    feedback.textContent = `Ingestion crawl initiated for ${url}...\nFingerprinting career architecture...`;
    btn.disabled = true;

    try {
      const res = await api('/api/pipeline/crawl', {
        method: 'POST',
        body: JSON.stringify({ url, companyName }),
      });
      feedback.textContent = `✓ Crawl & Ingestion Complete!\n` + JSON.stringify(res.data, null, 2);
      await loadAnalytics();
    } catch (err) {
      feedback.textContent = `✗ Ingestion Error: ${err.message}`;
    } finally {
      btn.disabled = false;
    }
  });

  const btnConsume = document.getElementById('btnTriggerConsumer');
  btnConsume?.addEventListener('click', async () => {
    const feedback = document.getElementById('consumerFeedback');
    feedback.classList.remove('hidden');
    feedback.textContent = 'Processing outbox events with SKIP LOCKED...';

    try {
      const res = await api('/api/pipeline/consume', {
        method: 'POST',
        body: JSON.stringify({ batchSize: 20 }),
      });
      feedback.textContent = `✓ Processed ${res.data.processedCount} event(s).\nErrors: ${res.data.errors.length}`;
      await loadAnalytics();
    } catch (err) {
      feedback.textContent = `✗ Consumer Error: ${err.message}`;
    }
  });
}
