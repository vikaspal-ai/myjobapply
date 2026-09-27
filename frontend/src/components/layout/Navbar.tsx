import React from 'react';
import { useAuth } from '../../context/AuthContext.js';

import type { StepKey } from '../../App.js';

interface NavbarProps {
  onOpenConsole: () => void;
  activeStep?: StepKey;
  setActiveStep?: (step: StepKey) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenConsole, activeStep, setActiveStep }) => {
  const { user, isAuthenticated, openAuthModal, logout } = useAuth();

  const steps: { key: StepKey; num: number; label: string; icon: string }[] = [
    { key: 'profile', num: 1, icon: '👤', label: 'Profile' },
    { key: 'jobs',    num: 2, icon: '🔍', label: 'Live Jobs' },
    { key: 'resume',  num: 3, icon: '📄', label: 'Resumes' },
    { key: 'apply',   num: 4, icon: '⚡', label: 'Auto-Apply' },
    { key: 'referrals', num: 5, icon: '🤝', label: 'Referrals' },
  ];

  return (
    <header className="header-wrapper">
      <nav className="floating-nav">
        {/* Brand */}
        <a href="/" className="nav-brand">
          <div className="brand-icon-box">⚡</div>
          <span>jobsapply</span>
        </a>

        {/* Center Links */}
        <div className="nav-links">
          {isAuthenticated ? (
            <div style={{ display: 'flex', gap: '0.2rem' }}>
              {steps.map((s, idx) => {
                const isActive = activeStep === s.key;
                const isDone = setActiveStep && steps.findIndex(x => x.key === activeStep) > idx;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setActiveStep && setActiveStep(s.key)}
                    style={{
                      background: 'none',
                      border: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.4rem 0.8rem',
                      borderRadius: '8px',
                      color: isActive ? 'var(--color-primary)' : isDone ? '#10b981' : 'var(--color-text-body)',
                      fontWeight: isActive ? 700 : 500,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      backgroundColor: isActive ? 'rgba(99,102,241,0.08)' : 'transparent',
                    }}
                  >
                    <span>{s.icon}</span>
                    {s.num}. {s.label}
                  </button>
                );
              })}
              <a href="#faq" className="nav-link" style={{ marginLeft: '1rem' }}>FAQ</a>
            </div>
          ) : (
            <>
              <a href="#features" className="nav-link">Capabilities</a>
              <a href="#integrations" className="nav-link">Integrations</a>
              <a href="#how-it-works" className="nav-link">How It Works</a>
              <a href="#workspace" className="nav-link">Live Agent</a>
              <a href="#testimonials" className="nav-link">Reviews</a>
              <a href="#faq" className="nav-link">FAQ</a>
            </>
          )}
        </div>

        {/* Right Actions */}
        <div className="nav-actions">
          {isAuthenticated ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div className="candidate-pill">
                <span className="pill-emoji">👤</span>
                <span style={{ fontWeight: 700, color: 'var(--color-text-title)' }}>
                  {user?.fullName || user?.email || 'User'}
                </span>
              </div>

              <button
                type="button"
                className="btn-outline btn-sm"
                onClick={logout}
                title="Sign out of your account"
              >
                Log Out
              </button>

              <button
                type="button"
                className="btn-outline btn-sm"
                title="View Pipeline Engine & Metrics"
                onClick={onOpenConsole}
              >
                <span style={{ fontSize: '0.85em', lineHeight: 1 }}>🛠️</span>{' '}
                <span className="btn-label">Console</span>
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <button
                type="button"
                className="btn-outline btn-sm"
                onClick={() => openAuthModal('signin')}
              >
                Sign In
              </button>
              <button
                type="button"
                className="btn-gradient btn-sm"
                onClick={() => openAuthModal('signup')}
              >
                Start free
              </button>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
};
