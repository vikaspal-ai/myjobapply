import React, { useState } from 'react';

export const FaqSection: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const faqs = [
    {
      q: 'What does the Jobsapply AI agent do?',
      a: 'Jobsapply acts as your personal job hunting copilot: it indexes fresh job openings across top portals, compiles ATS-optimized LaTeX resumes tailored to each specific job description, discovers employees who can refer you, and tracks applications through to completion.',
    },
    {
      q: 'Can I target specific Indian cities like Mumbai, Pune, and Bengaluru?',
      a: 'Yes! Our matching engine features dedicated location filtering with priority scoring for Indian tech hubs including Mumbai, Pune, Bengaluru, Hyderabad, and Remote (India).',
    },
    {
      q: 'Does it prevent hallucinations or fake resume info?',
      a: 'Yes. Our architecture includes a deterministic Fact Store. The AI resume generator is strictly prohibited from inventing claims or fabricating skills. Every bullet point is grounded in your verified candidate profile.',
    },
    {
      q: 'How does the auto-apply feature prevent account bans?',
      a: 'Jobsapply uses strict rate-limiting, respects robots.txt directives, and incorporates an optional Human Approval Gate so you maintain full control before any external application is submitted.',
    },
  ];

  return (
    <section id="faq" className="faq-section" style={{ background: 'var(--color-bg)' }}>
      <div className="container">
        <div style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
          <p className="section-tag">006 ● FAQ</p>
          <h2 className="section-title">Answers to common questions</h2>
          <p className="section-subtitle">Everything you need to know about our autonomous job agent.</p>
        </div>

        <div className="faq-list">
          {faqs.map((faq, idx) => (
            <div key={idx} className={`faq-item ${openFaq === idx ? 'active' : ''}`}>
              <button
                type="button"
                className="faq-question"
                onClick={() => toggleFaq(idx)}
              >
                <span>{faq.q}</span>
                <span className="faq-toggle-icon">{openFaq === idx ? '−' : '+'}</span>
              </button>
              {openFaq === idx && (
                <div className="faq-answer">
                  <p>{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
