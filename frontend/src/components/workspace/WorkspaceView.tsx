import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { ProfileStep } from './ProfileStep.js';
import { JobsFeedStep } from './JobsFeedStep.js';
import { TailoredResumesStep } from './TailoredResumesStep.js';
import { AutoApplyStep } from './AutoApplyStep.js';
import { ReferralsStep } from './ReferralsStep.js';

type StepKey = 'profile' | 'jobs' | 'resume' | 'apply' | 'referrals';

export const WorkspaceView: React.FC = () => {
  const { user } = useAuth();
  const [activeStep, setActiveStep] = useState<StepKey>('profile');

  const steps: { key: StepKey; num: number; label: string; icon: string }[] = [
    { key: 'profile', num: 1, icon: '👤', label: 'Profile & Resume' },
    { key: 'jobs',    num: 2, icon: '🔍', label: 'Live Jobs' },
    { key: 'resume',  num: 3, icon: '📄', label: 'Tailored Resumes' },
    { key: 'apply',   num: 4, icon: '⚡', label: 'Auto-Apply' },
    { key: 'referrals', num: 5, icon: '🤝', label: 'Referrals' },
  ];

  const firstName = user?.fullName?.split(' ')[0] || user?.email?.split('@')[0] || 'there';

  return (
    <section style={{ minHeight: '100vh', background: 'var(--color-bg)', paddingTop: '5rem' }}>
      {/* Dashboard Header */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(16,185,129,0.06) 100%)',
        borderBottom: '1px solid var(--color-surface-border)',
        padding: '1.5rem 0',
      }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text-title)', margin: 0 }}>
              👋 Welcome back, <span style={{ color: 'var(--color-primary)' }}>{firstName}</span>
            </h1>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.88rem', color: 'var(--color-text-body)' }}>
              Your AI job agent is ready. Complete your profile → fetch live jobs → auto-apply.
            </p>
          </div>

          {/* Step progress pills */}
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {steps.map((s, idx) => {
              const isActive = activeStep === s.key;
              const isDone = steps.findIndex(x => x.key === activeStep) > idx;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setActiveStep(s.key)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.4rem 0.9rem',
                    borderRadius: '999px',
                    border: isActive
                      ? '2px solid var(--color-primary)'
                      : isDone
                      ? '2px solid #10b981'
                      : '2px solid var(--color-surface-border)',
                    background: isActive
                      ? 'var(--color-primary)'
                      : isDone
                      ? 'rgba(16,185,129,0.12)'
                      : 'var(--color-surface-soft)',
                    color: isActive ? '#fff' : isDone ? '#10b981' : 'var(--color-text-body)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  <span>{isDone && !isActive ? '✓' : s.icon}</span>
                  {s.num}. {s.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="container" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
        {activeStep === 'profile'   && <ProfileStep   onSaved={() => setActiveStep('jobs')} />}
        {activeStep === 'jobs'      && <JobsFeedStep  onApplyTriggered={() => setActiveStep('apply')} />}
        {activeStep === 'resume'    && <TailoredResumesStep />}
        {activeStep === 'apply'     && <AutoApplyStep />}
        {activeStep === 'referrals' && <ReferralsStep />}
      </div>
    </section>
  );
};
