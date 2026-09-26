import React from 'react';
import { useAuth } from '../../context/AuthContext.js';

interface NavbarProps {
  onOpenConsole: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenConsole }) => {
  const { user, isAuthenticated, openAuthModal, logout } = useAuth();

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
          <a href="#features" className="nav-link">Capabilities</a>
          <a href="#integrations" className="nav-link">Integrations</a>
          <a href="#how-it-works" className="nav-link">How It Works</a>
          <a href="#workspace" className="nav-link">Live Agent</a>
          <a href="#testimonials" className="nav-link">Reviews</a>
          <a href="#faq" className="nav-link">FAQ</a>
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
