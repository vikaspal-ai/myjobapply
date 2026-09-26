import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="site-footer">
      <div className="container footer-content">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontWeight: 700, color: 'var(--color-text-title)' }}>
          <div className="brand-icon-box" style={{ width: '24px', height: '24px', fontSize: '0.8rem' }}>⚡</div>
          <span>jobsapply</span>
          <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontWeight: 400, marginLeft: '0.5rem' }}>
            • India's Autonomous Job Agent
          </span>
        </div>
        <div>
          <span>Built with Fastify, Supabase & Anti-Fabrication Architecture.</span>
        </div>
      </div>
    </footer>
  );
};
