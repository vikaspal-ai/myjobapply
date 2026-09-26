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
        <a href="/" className="brand-logo" style={{ textDecoration: 'none' }}>
          <div className="brand-icon-box">⚡</div>
          <span className="brand-name">
            Jobsapply<span className="brand-dot">.</span>
          </span>
          <span className="brand-badge-in">🇮🇳 INDIA</span>
        </a>

        {/* Center Links */}
        <div className="nav-center-links">
          <a href="#how-it-works" className="nav-link">How it Works</a>
          <a href="#testimonials" className="nav-link">Testimonials</a>
          <a href="#faq" className="nav-link">FAQ</a>
        </div>

        {/* Right Actions */}
        <div className="nav-actions">
          {isAuthenticated ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <button
                type="button"
                className="btn-outline btn-sm"
                title="Open Engineering Operator Console"
                onClick={onOpenConsole}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <span>🛠️</span>
                <span>Console</span>
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--color-surface-soft)', padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-full)', border: '1px solid var(--color-surface-border)' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-title)' }}>
                  👤 {user?.fullName || user?.email}
                </span>
              </div>
              <button
                type="button"
                className="btn-outline btn-sm"
                onClick={logout}
              >
                Log Out
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => openAuthModal('signin')}
              >
                Sign In
              </button>
              <button
                type="button"
                className="btn-gradient"
                onClick={() => openAuthModal('signup')}
              >
                Start Free 🚀
              </button>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
};
