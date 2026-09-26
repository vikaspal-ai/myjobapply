import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';

export const AuthModal: React.FC = () => {
  const {
    isAuthModalOpen,
    authModalTab,
    setAuthModalTab,
    closeAuthModal,
    login,
    signup,
    signInWithGoogle,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isAuthModalOpen) return null;

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);
    try {
      await signup(fullName, email, password);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleClick = async () => {
    setErrorMessage('');
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to start Google sign in');
    }
  };

  return (
    <div className="console-modal active" style={{ display: 'flex' }} onClick={closeAuthModal}>
      <div
        className="console-window"
        style={{
          maxWidth: '440px',
          background: 'white',
          color: 'var(--color-text-title)',
          borderRadius: '20px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
          border: '1px solid var(--color-surface-border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--color-surface-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, fontSize: '1.15rem' }}>
            <div className="brand-icon-box" style={{ width: '26px', height: '26px', fontSize: '0.85rem' }}>⚡</div>
            <span>{authModalTab === 'signin' ? 'Sign in to your Job Agent' : 'Create your Free Account'}</span>
          </div>
          <button
            type="button"
            onClick={closeAuthModal}
            style={{ fontSize: '1.25rem', color: 'var(--color-text-muted)', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* Tab Buttons */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--color-surface-border)', background: 'var(--color-surface-soft)' }}>
          <button
            type="button"
            className={`step-nav-btn ${authModalTab === 'signin' ? 'active' : ''}`}
            style={{ borderRadius: 0, border: 'none', padding: '0.75rem', flex: 1 }}
            onClick={() => { setErrorMessage(''); setAuthModalTab('signin'); }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`step-nav-btn ${authModalTab === 'signup' ? 'active' : ''}`}
            style={{ borderRadius: 0, border: 'none', padding: '0.75rem', flex: 1 }}
            onClick={() => { setErrorMessage(''); setAuthModalTab('signup'); }}
          >
            Create Account
          </button>
        </div>

        <div style={{ padding: '1.5rem' }}>
          {errorMessage && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '0.6rem', borderRadius: '8px', fontSize: '0.82rem', marginBottom: '1rem' }}>
              {errorMessage}
            </div>
          )}

          {/* Google OAuth Button */}
          <button
            type="button"
            className="btn-outline"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              padding: '0.75rem',
              fontWeight: 600,
              fontSize: '0.95rem',
              marginBottom: '1.25rem',
              background: 'white',
              border: '1.5px solid var(--color-surface-border)',
              borderRadius: '10px',
              cursor: 'pointer',
            }}
            onClick={handleGoogleClick}
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span>Continue with Google</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--color-surface-border)' }}></div>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>or with email</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--color-surface-border)' }}></div>
          </div>

          {authModalTab === 'signin' ? (
            <form onSubmit={handleSignInSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>Email</label>
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid var(--color-surface-border)', fontFamily: 'inherit' }}
                />
              </div>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid var(--color-surface-border)', fontFamily: 'inherit' }}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="btn-gradient"
                style={{ width: '100%', justifyContent: 'center', padding: '0.7rem' }}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignUpSubmit}>
              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid var(--color-surface-border)', fontFamily: 'inherit' }}
                />
              </div>
              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>Email</label>
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid var(--color-surface-border)', fontFamily: 'inherit' }}
                />
              </div>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid var(--color-surface-border)', fontFamily: 'inherit' }}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="btn-gradient"
                style={{ width: '100%', justifyContent: 'center', padding: '0.7rem' }}
              >
                {loading ? 'Creating account...' : 'Create Free Account & Start 🚀'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
