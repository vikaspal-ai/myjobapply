import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="footer-section">
      <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div className="brand-icon-box" style={{ width: '24px', height: '24px', fontSize: '0.8rem' }}>⚡</div>
          <span style={{ fontWeight: 800, color: 'var(--color-text-title)' }}>Jobsapply</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>© {new Date().getFullYear()} Jobsapply India. All rights reserved.</span>
        </div>
        <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
          <span>Powered by React 19, Fastify, Supabase & Deterministic Anti-Hallucination Pipeline.</span>
        </div>
      </div>
    </footer>
  );
};
