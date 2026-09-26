import React, { useState } from 'react';
import { ProfileStep } from './ProfileStep.js';
import { JobsFeedStep } from './JobsFeedStep.js';
import { TailoredResumesStep } from './TailoredResumesStep.js';
import { AutoApplyStep } from './AutoApplyStep.js';
import { ReferralsStep } from './ReferralsStep.js';

export const WorkspaceView: React.FC = () => {
  const [activeStep, setActiveStep] = useState<'profile' | 'jobs' | 'resume' | 'apply' | 'referrals'>('jobs');

  const steps = [
    { key: 'profile' as const, num: 1, label: 'Profile & ATS Analyzer' },
    { key: 'jobs' as const, num: 2, label: 'Live Job Matches' },
    { key: 'resume' as const, num: 3, label: 'Tailored Resumes' },
    { key: 'apply' as const, num: 4, label: 'Auto-Apply Tracker' },
    { key: 'referrals' as const, num: 5, label: 'Referrals & Outreach' },
  ];

  return (
    <section id="workspace" className="workspace-section" style={{ minHeight: '80vh', padding: '7rem 0 4rem' }}>
      <div className="container">
        <p className="section-tag">004 ● How it works</p>
        <h2 className="section-title">
          How our AI job agent operates: <span style={{ color: 'var(--color-primary)' }}>five automated steps.</span>
        </h2>
        <p className="section-subtitle">Experience each stage of your autonomous job search right here.</p>

        {/* 5-Step Navigation Pills */}
        <div className="step-nav-bar" style={{ marginTop: '2rem' }}>
          {steps.map((s) => (
            <button
              key={s.key}
              type="button"
              className={`step-nav-btn ${activeStep === s.key ? 'active' : ''}`}
              onClick={() => setActiveStep(s.key)}
            >
              <span className="step-nav-num">{s.num}</span> {s.label}
            </button>
          ))}
        </div>

        {/* Active Workspace Step Panel */}
        <div style={{ marginTop: '2rem' }}>
          {activeStep === 'profile' && <ProfileStep onSaved={() => setActiveStep('jobs')} />}
          {activeStep === 'jobs' && <JobsFeedStep onApplyTriggered={() => setActiveStep('apply')} />}
          {activeStep === 'resume' && <TailoredResumesStep />}
          {activeStep === 'apply' && <AutoApplyStep />}
          {activeStep === 'referrals' && <ReferralsStep />}
        </div>
      </div>
    </section>
  );
};
