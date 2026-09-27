import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { api } from '../../api/client.js';
import type { JobMatch } from '../../types.js';

interface JobsFeedStepProps {
  onApplyTriggered: () => void;
}

/** Normalise the salary JSONB column into a human-readable string, or null. */
function formatSalary(raw: unknown): string | null {
  if (!raw) return null;
  if (typeof raw === 'string') return raw.trim() || null;
  if (typeof raw === 'object') {
    const s = raw as Record<string, any>;
    if (typeof s.display === 'string' && s.display.trim()) return s.display.trim();
    const min = s.min ?? s.minimum ?? s.minAmount;
    const max = s.max ?? s.maximum ?? s.maxAmount;
    if (min || max) {
      const cur = s.currency || s.currencyCode || '';
      return cur ? `${cur} ${min ?? '?'} – ${max ?? '?'}` : `${min ?? '?'} – ${max ?? '?'}`;
    }
  }
  return null;
}

const LOCATION_FILTERS = [
  { key: 'ALL',       label: 'All Locations' },
  { key: 'REMOTE',    label: '🌐 Remote' },
  { key: 'BENGALURU', label: '📍 Bengaluru' },
  { key: 'MUMBAI',    label: '📍 Mumbai' },
  { key: 'PUNE',      label: '📍 Pune' },
  { key: 'HYDERABAD', label: '📍 Hyderabad' },
  { key: 'DELHI',     label: '📍 Delhi' },
];

const SOURCE_PLUGINS = [
  { key: 'serpapi',  icon: '🔍', label: 'Google Jobs',  desc: 'Via SerpApi — aggregates LinkedIn, Naukri, Indeed, corporate boards',         default: true },
  { key: 'rapidapi', icon: '⚡', label: 'JSearch',      desc: 'Via RapidAPI — LinkedIn, Indeed, Glassdoor, ZipRecruiter unified',            default: true },
];

export const JobsFeedStep: React.FC<JobsFeedStepProps> = ({ onApplyTriggered }) => {
  const { activeCandidateId, candidateProfile } = useAuth();
  const [jobs, setJobs]                   = useState<JobMatch[]>([]);
  const [loading, setLoading]             = useState(false);
  const [syncing, setSyncing]             = useState(false);
  const [syncStatus, setSyncStatus]       = useState<string | null>(null);
  const [locationFilter, setLocationFilter] = useState('ALL');
  const [realOnly, setRealOnly]           = useState(true);
  const [showPlugins, setShowPlugins]     = useState(false);
  const [activePlugins, setActivePlugins] = useState<Set<string>>(new Set(SOURCE_PLUGINS.filter(p => p.default).map(p => p.key)));
  const [syncQuery, setSyncQuery]         = useState('');

  /* ---------- Fetch from our DB ---------- */
  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const candQuery = activeCandidateId ? `&candidateId=${activeCandidateId}` : '';
      const locParam  = locationFilter !== 'ALL' ? `&location=${locationFilter.toLowerCase()}` : '';
      const res = await api<any[]>(`/api/jobs?limit=100&realOnly=${realOnly}${candQuery}${locParam}`);
      const rawJobs = res.data || [];

      const formatted: JobMatch[] = rawJobs
        .filter((j: any) => !(realOnly && j.is_synthetic))
        .map((j: any) => {
          let loc = j.locationDisplay;
          if (!loc || loc === 'Location Not Specified') {
            if (typeof j.location === 'object' && j.location) {
              loc = [j.location.city, j.location.state].filter(Boolean).join(', ') || j.location.workplaceType || 'India';
            } else {
              loc = 'India';
            }
          }
          const rawScore = j.match?.score ?? j.fitScore ?? j.fit_score ?? null;
          const fitScore = typeof rawScore === 'number' && Number.isFinite(rawScore) ? Math.round(rawScore) : null;
          return {
            id: j.id,
            jobId: j.id,
            title: j.title,
            companyName: j.companyName || j.company_name || 'Unknown company',
            companyDomain: j.companyDomain || j.company_domain || '',
            locationDisplay: loc,
            fitScore,
            atsScore: null,
            salary: formatSalary(j.salary),
            applyUrl: j.applyUrl || j.apply_url || '#',
            atsType: j.atsType || j.ats_type || '',
            isSynthetic: j.isSynthetic ?? j.is_synthetic ?? false,
          };
        });

      setJobs(formatted);
    } catch (err) {
      console.error('Failed to load jobs:', err);
    } finally {
      setLoading(false);
    }
  }, [activeCandidateId, realOnly, locationFilter]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  /* ---------- Live sync from external APIs ---------- */
  const handleLiveSync = async () => {
    if (activePlugins.size === 0) {
      alert('Please enable at least one job source plugin.');
      return;
    }

    const query = syncQuery.trim() ||
      candidateProfile?.currentJob ||
      'Software Engineer';

    setSyncing(true);
    setSyncStatus(`🔄 Syncing live jobs for "${query}"…`);

    let totalSynced = 0;
    const errors: string[] = [];

    for (const plugin of Array.from(activePlugins)) {
      try {
        const res = await api<{ syncedCount: number; failedCount: number; failures: any[] }>('/api/jobs/sync-external', {
          method: 'POST',
          body: JSON.stringify({
            provider: plugin,
            query,
            location: locationFilter === 'ALL' ? 'India' : locationFilter,
            limit: 20,
            candidateId: activeCandidateId,
          }),
        });
        if (res.data?.syncedCount) {
          totalSynced += res.data.syncedCount;
        }
        if (res.data?.failures?.length) {
          errors.push(...res.data.failures.map((f: any) => f.title));
        }
      } catch (err: any) {
        errors.push(`${plugin}: ${err.message}`);
      }
    }

    setSyncStatus(
      totalSynced > 0
        ? `✅ Synced ${totalSynced} live jobs! Refreshing feed…`
        : errors.length > 0
        ? `⚠️ Sync completed with issues: ${errors.slice(0, 2).join(', ')}`
        : '⚠️ No new jobs found. Check API keys or try a different search.',
    );

    await fetchJobs();
    setSyncing(false);
    setTimeout(() => setSyncStatus(null), 6000);
  };

  /* ---------- Location client-side filter ---------- */
  const filteredJobs = jobs.filter(j => {
    if (locationFilter === 'ALL') return true;
    const loc = (j.locationDisplay || '').toLowerCase();
    if (locationFilter === 'REMOTE')    return loc.includes('remote');
    if (locationFilter === 'BENGALURU') return loc.includes('bengaluru') || loc.includes('bangalore');
    if (locationFilter === 'MUMBAI')    return loc.includes('mumbai');
    if (locationFilter === 'PUNE')      return loc.includes('pune');
    if (locationFilter === 'HYDERABAD') return loc.includes('hyderabad');
    if (locationFilter === 'DELHI')     return loc.includes('delhi') || loc.includes('ncr');
    return true;
  });

  /* ---------- Auto-Apply ---------- */
  const handleAutoApply = async (job: JobMatch) => {
    if (!activeCandidateId) {
      alert('Please complete Step 1 (Profile) first.');
      return;
    }
    try {
      await api('/api/applications', {
        method: 'POST',
        body: JSON.stringify({ candidateId: activeCandidateId, jobId: job.jobId }),
      });
      alert(`✅ Application queued for ${job.title} at ${job.companyName}!`);
      onApplyTriggered();
    } catch (err: any) {
      alert(`Could not start application: ${err.message}`);
    }
  };

  /* ---------- Render ---------- */
  return (
    <div className="step-workspace-panel active">

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--color-text-title)', margin: 0 }}>
            🔍 Live Job Feed
          </h3>
          <p style={{ margin: '0.3rem 0 0', fontSize: '0.85rem', color: 'var(--color-text-body)' }}>
            {filteredJobs.length} verified real postings from Google Jobs, JSearch, LinkedIn & more.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-outline btn-sm"
            onClick={() => setShowPlugins(v => !v)}
          >
            🔌 Sources {showPlugins ? '▲' : '▼'}
          </button>
          <button
            type="button"
            className="btn-gradient btn-sm"
            disabled={syncing}
            onClick={handleLiveSync}
          >
            {syncing ? '⏳ Syncing…' : '⚡ Fetch Live Jobs'}
          </button>
        </div>
      </div>

      {/* ── Source Plugins Panel ── */}
      {showPlugins && (
        <div style={{
          background: 'var(--color-surface-soft)',
          border: '1px solid var(--color-surface-border)',
          borderRadius: '12px',
          padding: '1rem 1.25rem',
          marginBottom: '1.25rem',
        }}>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-title)' }}>
            Job Source Plugins — toggle which APIs to query
          </p>

          {/* Search query input */}
          <div style={{ marginBottom: '0.75rem' }}>
            <input
              type="text"
              placeholder={`Search query (default: "${candidateProfile?.currentJob || 'Software Engineer'}")`}
              value={syncQuery}
              onChange={e => setSyncQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                border: '1px solid var(--color-surface-border)',
                borderRadius: '8px',
                fontFamily: 'inherit',
                fontSize: '0.85rem',
                background: 'var(--color-surface)',
                color: 'var(--color-text-title)',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            {SOURCE_PLUGINS.map(plugin => {
              const active = activePlugins.has(plugin.key);
              return (
                <label
                  key={plugin.key}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.5rem',
                    padding: '0.6rem 0.9rem',
                    borderRadius: '10px',
                    border: `2px solid ${active ? 'var(--color-primary)' : 'var(--color-surface-border)'}`,
                    background: active ? 'rgba(99,102,241,0.08)' : 'transparent',
                    cursor: 'pointer',
                    minWidth: '200px',
                    maxWidth: '260px',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => {
                      setActivePlugins(prev => {
                        const next = new Set(prev);
                        if (next.has(plugin.key)) next.delete(plugin.key);
                        else next.add(plugin.key);
                        return next;
                      });
                    }}
                    style={{ marginTop: '2px' }}
                  />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-text-title)' }}>
                      {plugin.icon} {plugin.label}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>
                      {plugin.desc}
                    </div>
                  </div>
                </label>
              );
            })}

            {/* LinkedIn coming soon */}
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.5rem',
              padding: '0.6rem 0.9rem',
              borderRadius: '10px',
              border: '2px dashed var(--color-surface-border)',
              opacity: 0.6,
              minWidth: '200px',
              maxWidth: '260px',
            }}>
              <input type="checkbox" disabled />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-text-title)' }}>
                  🔗 LinkedIn Direct <span style={{ background: '#f59e0b', color: '#000', borderRadius: '4px', padding: '0 4px', fontSize: '0.65rem' }}>Soon</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>
                  Native LinkedIn job scraper (OAuth required)
                </div>
              </div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.5rem',
              padding: '0.6rem 0.9rem',
              borderRadius: '10px',
              border: '2px dashed var(--color-surface-border)',
              opacity: 0.6,
              minWidth: '200px',
              maxWidth: '260px',
            }}>
              <input type="checkbox" disabled />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-text-title)' }}>
                  📋 Naukri.com <span style={{ background: '#f59e0b', color: '#000', borderRadius: '4px', padding: '0 4px', fontSize: '0.65rem' }}>Soon</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>
                  Naukri API connector (India-specific postings)
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Sync Status Bar ── */}
      {syncStatus && (
        <div style={{
          padding: '0.65rem 1rem',
          borderRadius: '8px',
          background: syncStatus.startsWith('✅') ? 'rgba(16,185,129,0.1)' : syncStatus.startsWith('⚠️') ? 'rgba(245,158,11,0.1)' : 'rgba(99,102,241,0.1)',
          border: `1px solid ${syncStatus.startsWith('✅') ? '#10b981' : syncStatus.startsWith('⚠️') ? '#f59e0b' : 'var(--color-primary)'}`,
          color: 'var(--color-text-title)',
          fontSize: '0.85rem',
          marginBottom: '1rem',
        }}>
          {syncStatus}
        </div>
      )}

      {/* ── Controls Row ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        {/* Location chips */}
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          {LOCATION_FILTERS.map(btn => (
            <button
              key={btn.key}
              type="button"
              className={`chip-btn ${locationFilter === btn.key ? 'active' : ''}`}
              onClick={() => setLocationFilter(btn.key)}
              style={{ fontSize: '0.78rem' }}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Real-only toggle */}
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--color-text-body)' }}>
          <input
            type="checkbox"
            checked={realOnly}
            onChange={e => setRealOnly(e.target.checked)}
          />
          Real postings only (hide test data)
        </label>
      </div>

      {/* ── Job Grid ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-muted)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>⏳</div>
          Loading verified opportunities…
        </div>
      ) : filteredJobs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-muted)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔍</div>
          <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>No jobs found for these filters.</p>
          <p style={{ fontSize: '0.85rem' }}>
            Click <strong>⚡ Fetch Live Jobs</strong> above to pull fresh listings from Google Jobs &amp; JSearch.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '1.1rem' }}>
          {filteredJobs.map(job => (
            <div key={job.id} className="job-card-modern">
              <div className="job-card-header">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span className="job-company-title" style={{ display: 'block', fontSize: '0.78rem', marginBottom: '0.2rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {job.companyName}
                    {job.companyDomain && (
                      <span style={{ color: 'var(--color-text-muted)', marginLeft: '0.3rem' }}>({job.companyDomain})</span>
                    )}
                  </span>
                  <h4 className="job-role-title" style={{ margin: 0, fontSize: '0.95rem', lineHeight: '1.3' }}>
                    {job.title}
                  </h4>
                </div>
                {job.fitScore !== null ? (
                  <span className={`fit-score-badge ${job.fitScore >= 90 ? 'best' : job.fitScore >= 80 ? 'high' : 'good'}`}>
                    {job.fitScore}% fit
                  </span>
                ) : (
                  <span className="fit-score-badge good" style={{ opacity: 0.6, fontSize: '0.7rem' }}>
                    Unscored
                  </span>
                )}
              </div>

              <div className="job-card-meta">
                <span>📍 {job.locationDisplay}</span>
                {job.salary && <span>💰 {job.salary}</span>}
              </div>

              <div className="job-card-footer">
                <a
                  href={job.applyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-outline btn-sm"
                  style={{ textDecoration: 'none' }}
                >
                  View Posting ↗
                </a>
                <button
                  type="button"
                  className="btn-gradient btn-sm"
                  onClick={() => handleAutoApply(job)}
                >
                  ⚡ Auto-Apply
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
