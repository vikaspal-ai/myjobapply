import React, { useState } from 'react';
import type { ReferralLead } from '../../types.js';

export const ReferralsStep: React.FC = () => {
  const [leads, setLeads] = useState<ReferralLead[]>([
    {
      id: '1',
      companyName: 'Razorpay',
      personName: 'Sneha Jain',
      title: 'Staff Software Engineer',
      fitScore: 92,
      connection: 'Alumni Network & Mumbai Tech Community',
      snippet: 'Hi Sneha, saw your work on checkout infrastructure at Razorpay. As a fellow engineer based in Mumbai...',
      status: 'READY',
    },
    {
      id: '2',
      companyName: 'BrowserStack',
      personName: 'Rohan Mehta',
      title: 'Engineering Director',
      fitScore: 88,
      connection: 'Pune Tech Meetup Co-Attendee',
      snippet: 'Hi Rohan, noticed BrowserStack is expanding backend distributed systems in Mumbai/Pune...',
      status: 'READY',
    },
    {
      id: '3',
      companyName: 'PhonePe',
      personName: 'Aditya Verma',
      title: 'Principal Architect',
      fitScore: 85,
      connection: 'Open Source Contributor on GitHub',
      snippet: 'Hi Aditya, loved your talk on high-throughput ledger databases at PhonePe...',
      status: 'READY',
    },
  ]);

  const handleSendIntro = (id: string, name: string) => {
    setLeads(leads.map((l) => (l.id === id ? { ...l, status: 'SENT' } : l)));
    alert(`Outreach email sequence queued for ${name} with 3-step follow-up and stop-on-reply listener!`);
  };

  return (
    <div className="step-workspace-panel active">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-title)' }}>
            Warm Referral Discovery & Automated Cold Outreach
          </h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--color-text-body)' }}>
            Identifies alumni and teammates at target companies, drafting personalized intro notes.
          </p>
        </div>
        <button
          type="button"
          className="btn-gradient btn-sm"
          onClick={() => alert('New outreach template added to sequence queue.')}
        >
          Draft Custom Outreach
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
        {leads.map((lead) => (
          <div key={lead.id} className="job-card-modern">
            <div className="job-card-header">
              <div>
                <span className="job-company-title">{lead.companyName} · Referrer Lead</span>
                <h4 className="job-role-title">{lead.personName} ({lead.title})</h4>
              </div>
              <span className="fit-score-badge best">{lead.fitScore} Fit</span>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--color-text-body)', margin: '0.75rem 0' }}>
              <strong>Connection:</strong> {lead.connection}
            </p>

            <div style={{ background: 'var(--color-surface-soft)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.78rem', color: 'var(--color-text-body)', fontStyle: 'italic', marginBottom: '1rem' }}>
              "{lead.snippet}"
            </div>

            <div className="job-card-footer">
              <span style={{ fontSize: '0.75rem', color: lead.status === 'SENT' ? '#2563eb' : '#10b981', fontWeight: 700 }}>
                ● {lead.status === 'SENT' ? 'Intro Sent' : 'Sequence Ready'}
              </span>
              <button
                type="button"
                className="btn-outline btn-sm"
                disabled={lead.status === 'SENT'}
                onClick={() => handleSendIntro(lead.id, lead.personName)}
              >
                {lead.status === 'SENT' ? 'En Route' : 'Send Intro'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
