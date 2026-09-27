import React from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { ProfileStep } from './ProfileStep.js';
import { JobsFeedStep } from './JobsFeedStep.js';
import { TailoredResumesStep } from './TailoredResumesStep.js';
import { AutoApplyStep } from './AutoApplyStep.js';
import { ReferralsStep } from './ReferralsStep.js';
import type { StepKey } from '../../App.js';

interface WorkspaceViewProps {
  activeStep: StepKey;
  setActiveStep: (step: StepKey) => void;
}

export const WorkspaceView: React.FC<WorkspaceViewProps> = ({ activeStep, setActiveStep }) => {
  const { user } = useAuth();
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
