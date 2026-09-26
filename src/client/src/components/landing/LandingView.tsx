import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';

export const LandingView: React.FC = () => {
  const { openAuthModal } = useAuth();
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
      q: 'How does the human-in-the-loop review queue work?',
      a: 'Before any application is submitted via API or Playwright browser, it goes to your Approval Queue. You inspect the generated cover letter, answers to screening questions, and tailored resume. Nothing is submitted without your explicit consent.',
    },
  ];

  return (
    <div>
      {/* 001 ● Hero Section */}
      <section className="hero-section">
        <div className="container">
          <div className="hero-badge-pill">
            <span className="badge-pulse-dot"></span>
            <span>Autonomous AI Job Hunting Engine • India Edition</span>
          </div>

          <h1 className="hero-headline">
            Job hunting on autopilot.<br />
            Tailored resumes, warm referrals,<br />
            <span className="gradient-text">automated applications.</span>
          </h1>

          <p className="hero-subheadline">
            Stop filling out the same 50 fields on Naukri, LinkedIn, and Greenhouse. Jobsapply discovers fresh roles across Mumbai, Pune, and Bengaluru, optimizes your ATS resume, and applies with human-supervised precision.
          </p>

          <div className="hero-cta-group">
            <button
              type="button"
              className="btn-gradient hero-btn-lg"
              onClick={() => openAuthModal('signup')}
            >
              Start Free Today 🚀
            </button>
            <a href="#how-it-works" className="btn-outline hero-btn-lg">
              Explore Live Tour ↓
            </a>
          </div>

          {/* Social Proof Stats */}
          <div className="social-proof-strip">
            <div className="proof-stat">
              <span className="stat-value">120+</span>
              <span className="stat-label">Indian Tech Openings</span>
            </div>
            <div className="proof-divider"></div>
            <div className="proof-stat">
              <span className="stat-value">94.2%</span>
              <span className="stat-label">Average ATS Pass Rate</span>
            </div>
            <div className="proof-divider"></div>
            <div className="proof-stat">
              <span className="stat-value">100%</span>
              <span className="stat-label">Anti-Hallucination Verified</span>
            </div>
            <div className="proof-divider"></div>
            <div className="proof-stat">
              <span className="stat-value">$0</span>
              <span className="stat-label">Candidate Cost</span>
            </div>
          </div>
        </div>
      </section>

      {/* 002 ● Value Prop Cards */}
      <section className="value-cards-section">
        <div className="container">
          <div className="value-cards-grid">
            <div className="value-card">
              <div className="value-card-icon">⚡</div>
              <h3 className="value-card-title">Autonomous Multi-Portal Discovery</h3>
              <p className="value-card-desc">
                Continuous crawling of Indian tech portals with deduplication, location normalizers, and ATS detection for Mumbai, Pune, and Bengaluru.
              </p>
            </div>
            <div className="value-card">
              <div className="value-card-icon">🎯</div>
              <h3 className="value-card-title">ATS Resume Customization</h3>
              <p className="value-card-desc">
                Generates job-specific 2-page LaTeX PDF resumes grounded exclusively in your verified candidate facts. No hallucinations allowed.
              </p>
            </div>
            <div className="value-card">
              <div className="value-card-icon">🛡️</div>
              <h3 className="value-card-title">Human-in-the-Loop Safe Apply</h3>
              <p className="value-card-desc">
                Strict compliance approval gate. Inspect screening questions and tailored documents before automated headless submission.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 003 ● Visual Orbit Infographic */}
      <section className="orbit-section">
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto 3rem' }}>
            <p className="section-tag">003 ● Integration Ecosystem</p>
            <h2 className="section-title">Your autonomous job hunt hub.</h2>
            <p className="section-subtitle">Orchestrating Indian job boards, ATS filters, and outreach sequences in real time.</p>
          </div>

          <div className="orbit-viewport">
            <div className="orbit-center-hub">⚡</div>
            <div className="orbit-ring-outer">
              <div className="orbit-node" style={{ top: 0, left: '50%', transform: 'translate(-50%, -50%)' }}>Naukri</div>
              <div className="orbit-node" style={{ top: '50%', right: 0, transform: 'translate(50%, -50%)' }}>LinkedIn</div>
              <div className="orbit-node" style={{ bottom: 0, left: '50%', transform: 'translate(-50%, 50%)' }}>Foundit</div>
              <div className="orbit-node" style={{ top: '50%', left: 0, transform: 'translate(-50%, -50%)' }}>Hirist</div>
            </div>
            <div className="orbit-ring-inner">
              <div className="orbit-node" style={{ top: '15%', right: '15%' }}>Gmail</div>
              <div className="orbit-node" style={{ bottom: '15%', left: '15%' }}>LaTeX</div>
            </div>
          </div>
        </div>
      </section>

      {/* 004 ● Guest Gateway Callout */}
      <section id="how-it-works" className="workspace-section">
        <div className="container">
          <p className="section-tag">004 ● How it works</p>
          <h2 className="section-title">Experience the 5 automated steps.</h2>
          <p className="section-subtitle">Sign in or create an account to start your autonomous job search.</p>

          <div style={{ background: 'white', border: '1px solid var(--color-surface-border)', borderRadius: 'var(--radius-3xl)', marginTop: '2.5rem', boxShadow: 'var(--shadow-md)', overflow: 'hidden' }}>
            <div style={{ textAlign: 'center', maxWidth: '680px', margin: '0 auto', padding: '4rem 1.5rem' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '18px', background: 'rgba(37,99,235,0.1)', color: '#2563eb', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', marginBottom: '1.25rem' }}>⚡</div>
              <h3 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-text-title)', letterSpacing: '-0.03em', marginBottom: '0.75rem' }}>
                Ready to automate your tech job hunt?
              </h3>
              <p style={{ fontSize: '1.05rem', color: 'var(--color-text-body)', lineHeight: 1.6, marginBottom: '2rem' }}>
                Upload your resume, select your target locations (Mumbai, Pune, Bengaluru), and let our agent tailor ATS resumes and apply for you around the clock.
              </p>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn-gradient"
                  style={{ padding: '0.8rem 2.2rem', fontSize: '1rem' }}
                  onClick={() => openAuthModal('signup')}
                >
                  Create Your Free Account 🚀
                </button>
                <button
                  type="button"
                  className="btn-outline"
                  style={{ padding: '0.8rem 1.8rem', fontSize: '1rem' }}
                  onClick={() => openAuthModal('signin')}
                >
                  Sign In to Your Agent
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 005 ● Testimonials */}
      <section id="testimonials" className="testimonials-section">
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
            <p className="section-tag">005 ● Testimonials</p>
            <h2 className="section-title">What engineers are saying</h2>
            <p className="section-subtitle">Tech candidates across Mumbai, Pune, and Bengaluru who automated their job hunt.</p>
          </div>

          <div className="testimonials-grid">
            <div className="testimonial-card">
              <p className="testimonial-text">
                "Jobsapply has genuinely made my job search much more efficient. What stands out is that it goes beyond just finding job opportunities — it tailors my resume to specific job descriptions and automates applications on platforms like Naukri. I landed 3 interviews in Pune within 10 days."
              </p>
              <span className="testimonial-author">Rahul S. · SDE-2 at Fintech Hub (Pune)</span>
            </div>

            <div className="testimonial-card">
              <p className="testimonial-text">
                "One feature I found particularly helpful is the ability to identify missing skills or gaps in my resume and tailor the resume according to specific job requirements. The referral suggestions helped me connect with an alumni at Razorpay."
              </p>
              <span className="testimonial-author">Priya M. · Frontend Lead (Bengaluru)</span>
            </div>

            <div className="testimonial-card">
              <p className="testimonial-text">
                "I've tried a lot of job platforms, but what I really liked about Jobsapply is that it brings jobs from multiple websites into one place with valid direct links. The match breakdown shows exactly why you're a good fit and prevents wasted applications."
              </p>
              <span className="testimonial-author">Arjun D. · Backend Engineer (Mumbai)</span>
            </div>
          </div>
        </div>
      </section>

      {/* 006 ● FAQ Accordion */}
      <section id="faq" className="faq-section">
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
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
