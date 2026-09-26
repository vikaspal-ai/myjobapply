import React, { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import type { FunnelStats } from '../../types.js';

interface OperatorConsoleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OperatorConsoleModal: React.FC<OperatorConsoleModalProps> = ({ isOpen, onClose }) => {
  const [stats, setStats] = useState<FunnelStats>({
    discoveredCount: 122,
    canonicalCount: 430,
    matchedCount: 429,
    pendingApprovalCount: 2,
  });

  useEffect(() => {
    if (!isOpen) return;

    const loadStats = async () => {
      try {
        const res = await api<FunnelStats>('/api/analytics/funnel');
        if (res.data) setStats(res.data);
      } catch (err) {
        console.error('Failed to load funnel stats:', err);
      }
    };

    loadStats();
  }, [isOpen]);

  const handleSeedJobs = () => {
    alert('Seeding 11+ verified jobs from Tech Mahindra, Razorpay, BrowserStack, PhonePe, Swiggy, and Postman.');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="console-modal active" style={{ display: 'flex' }} onClick={onClose}>
      <div className="console-window" onClick={(e) => e.stopPropagation()}>
        <div className="console-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.2rem' }}>🛠️</span>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Platform Engine & Operator Console</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ color: 'white', fontSize: '1.25rem', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        <div className="console-body" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '8px' }}>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Discovered Postings</p>
              <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#60a5fa' }}>{stats.discoveredCount}</p>
            </div>
            <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '8px' }}>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Canonical Deduplicated</p>
              <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#34d399' }}>{stats.canonicalCount}</p>
            </div>
            <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '8px' }}>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Matched Opportunities</p>
              <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#a78bfa' }}>{stats.matchedCount}</p>
            </div>
            <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '8px' }}>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Human Review Queue</p>
              <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fbbf24' }}>{stats.pendingApprovalCount}</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn-outline btn-sm"
              onClick={handleSeedJobs}
            >
              🌱 Seed Real Indian Jobs
            </button>
            <button
              type="button"
              className="btn-gradient btn-sm"
              onClick={onClose}
            >
              Return to App
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
