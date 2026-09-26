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
      q: 'How does the auto-apply feature prevent account bans?',
      a: 'Jobsapply uses strict rate-limiting, respects robots.txt directives, and incorporates an optional Human Approval Gate so you maintain full control before any external application is submitted.',
    },
  ];

  return (
    <div>
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-grid-pattern"></div>
        <div className="container hero-container">
          {/* Hero Copy */}
          <div className="hero-content">
            <div className="hero-badge-live">
              <span className="pulse-dot"></span>
              We're live · Available with priority onboarding
            </div>

            <h1 className="hero-title">
              India's First<br />
              <span className="gradient-text">AI Job Agent</span>
            </h1>

            <p className="hero-desc">
              A self-running job agent that scans leading job platforms, creates role-specific ATS-friendly resumes, submits applications for you automatically, and sends outreach to uncover LinkedIn referral paths — even when you're offline.
            </p>

            <div className="hero-buttons">
              <button
                type="button"
                className="btn-gradient"
                onClick={() => openAuthModal('signup')}
              >
                Start Free (Upload Resume) 🚀
              </button>
              <a href="#how-it-works" className="btn-outline">
                See How Agent Works ↓
              </a>
            </div>

            <div className="hero-stats-row">
              <div className="hero-stat-item">
                <span className="hero-stat-num">50,000+</span>
                <span className="hero-stat-label">Daily Jobs Indexed</span>
              </div>
              <div className="hero-stat-item">
                <span className="hero-stat-num">92/100</span>
                <span className="hero-stat-label">Average ATS Match Score</span>
              </div>
              <div className="hero-stat-item">
                <span className="hero-stat-num">100% Anti-Fake</span>
                <span className="hero-stat-label">Deterministic Fact-Checked</span>
              </div>
            </div>
          </div>

          {/* Hero Visual Representation */}
          <div className="hero-visual">
            <div className="hero-visual-card">
              <div className="hero-visual-header">
                <span className="agent-live-badge">● Autonomous Agent Active</span>
                <span style={{ fontSize: '0.78rem', opacity: 0.7 }}>Targeting: Mumbai • Pune • BLR</span>
              </div>

              <div className="hero-visual-body">
                {/* Job 1 */}
                <div className="hero-mini-job">
                  <div className="hero-mini-job-info">
                    <h4>Senior Frontend Engineer (SDE-2)</h4>
                    <p>Razorpay · Bengaluru • Hybrid</p>
                  </div>
                  <span className="fit-score-badge best">★ BEST 0.91</span>
                </div>

                {/* Job 2 */}
                <div className="hero-mini-job">
                  <div className="hero-mini-job-info">
                    <h4>Software Engineer · L4 Fullstack</h4>
                    <p>Swiggy · Bengaluru • Tech</p>
                  </div>
                  <span className="fit-score-badge">0.74 Match</span>
                </div>

                {/* Job 3 */}
                <div className="hero-mini-job">
                  <div className="hero-mini-job-info">
                    <h4>Frontend Engineer III</h4>
                    <p>PhonePe · Pune • Payments</p>
                  </div>
                  <span className="fit-score-badge">0.61 Match</span>
                </div>

                {/* Status banner */}
                <div style={{ background: 'rgba(37, 99, 235, 0.15)', border: '1px solid rgba(96, 165, 250, 0.3)', borderRadius: '12px', padding: '0.75rem', textAlign: 'center', fontSize: '0.8rem', color: '#93c5fd' }}>
                  ✨ Auto-compiled tailored LaTeX resume ready for PhonePe & Razorpay
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 002 ● Capabilities Bento Grid */}
      <section id="features" className="bento-section">
        <div className="container">
          <p className="section-tag">002 ● Capabilities</p>
          <h2 className="section-title">One platform. Every stage covered.</h2>
          <p className="section-subtitle">Cut down on the 30–40 hours you spend each week — Jobsapply handles discovery, resume customization, applications, and follow-ups in a fraction of the time.</p>

          <div className="bento-grid">
            {/* Card 1: Job Discovery */}
            <div className="bento-card">
              <div className="bento-preview-box">
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <div className="hero-mini-job" style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <div>
                      <p style={{ fontSize: '0.82rem', fontWeight: 600 }}>Senior Frontend SDE-2</p>
                      <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)' }}>Razorpay · Bengaluru</p>
                    </div>
                    <span className="fit-score-badge best">★ BEST 0.91</span>
                  </div>
                  <div className="hero-mini-job" style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <div>
                      <p style={{ fontSize: '0.82rem', fontWeight: 600 }}>Software Engineer · L4</p>
                      <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)' }}>Swiggy · Bengaluru</p>
                    </div>
                    <span className="fit-score-badge">0.74</span>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="bento-card-title">Skip the endless job scrolling</h3>
                <p className="bento-card-desc">It monitors fresh listings across major platforms and surfaces only the roles that fit — with a clear explanation of why each one matched.</p>
              </div>
            </div>

            {/* Card 2: Applications */}
            <div className="bento-card">
              <div className="bento-preview-box">
                <div className="mini-apply-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748b', marginBottom: '0.35rem' }}>
                    <span>naukri.com/apply</span>
                    <span style={{ color: '#2563eb', fontWeight: 700 }}>FROM PROFILE</span>
                  </div>
                  <p style={{ fontWeight: 700, fontSize: '0.92rem' }}>Vikas Pal</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0.4rem 0' }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Resume Attached</span>
                    <span style={{ background: 'rgba(37,99,235,0.12)', color: '#2563eb', fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.4rem', borderRadius: '4px' }}>ATS 92</span>
                  </div>
                  <div style={{ background: '#f8fafc', borderRadius: '6px', padding: '0.4rem', fontSize: '0.72rem' }}>
                    <p style={{ color: '#2563eb', fontWeight: 700 }}>WHY THIS ROLE? · REASONED</p>
                    <p style={{ color: '#475569' }}>Led scalable microservices architecture with 99.9% uptime</p>
                  </div>
                  <p style={{ textAlign: 'center', color: '#10b981', fontWeight: 700, fontSize: '0.75rem', marginTop: '0.5rem' }}>✓ READY TO SUBMIT</p>
                </div>
              </div>
              <div>
                <h3 className="bento-card-title">Handles applications so you don't have to</h3>
                <p className="bento-card-desc">Genuine submissions on every supported job board, with screening answers written deterministically in your tone.</p>
              </div>
            </div>

            {/* Card 3: Email sequences */}
            <div className="bento-card">
              <div className="bento-preview-box">
                <div className="mini-seq-box">
                  <div className="mini-seq-step">
                    <div>
                      <p style={{ fontSize: '0.7rem', opacity: 0.5 }}>Day 1</p>
                      <p style={{ fontWeight: 600 }}>Reaching out · Razorpay Lead</p>
                    </div>
                    <span style={{ color: '#60a5fa', fontWeight: 700 }}>● Opened</span>
                  </div>
                  <div className="mini-seq-step">
                    <div>
                      <p style={{ fontSize: '0.7rem', opacity: 0.5 }}>+3d follow-up</p>
                      <p style={{ fontWeight: 600 }}>↩ Re: Happy to chat!</p>
                    </div>
                    <span style={{ color: '#34d399', fontWeight: 700 }}>STOPPED · Replied</span>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="bento-card-title">Smart email sequences that stop on reply</h3>
                <p className="bento-card-desc">A three-step outreach flow in your voice that halts automatically the moment someone responds.</p>
              </div>
            </div>

            {/* Card 4: Referrals Network (Span 2) */}
            <div className="bento-card span-2">
              <div className="bento-preview-box">
                <div className="referrals-network">
                  <div className="ref-center-avatar">YOU</div>
                  <div className="ref-signal-pill pos-1">★ Tech Mahindra Alumni</div>
                  <div className="ref-signal-pill pos-2">2nd-degree · Would Refer →</div>
                  <div className="ref-signal-pill pos-3">✦ Same Location · Pune</div>
                  <div className="ref-signal-pill pos-4">✦ Shared Skills · Node/React</div>
                </div>
              </div>
              <div>
                <h3 className="bento-card-title">Discover referrers inside target companies</h3>
                <p className="bento-card-desc">Identifies people who can refer you, ranks them by response likelihood, and drafts the personalized introduction message.</p>
              </div>
            </div>

            {/* Card 5: Tailored Resume */}
            <div className="bento-card">
              <div className="bento-preview-box">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', width: '100%' }}>
                  <div style={{ background: 'rgba(0,0,0,0.5)', padding: '0.6rem', borderRadius: '8px', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#93c5fd' }}>
                    \documentclass&#123;resume&#125;<br />
                    \name&#123;Vikas Pal&#125;<br />
                    \section&#123;Experience&#125;<br />
                    \item Senior SDE<br />
                    \item +40% query perf
                  </div>
                  <div style={{ background: 'white', padding: '0.6rem', borderRadius: '8px', fontSize: '0.7rem', color: '#0f172a' }}>
                    <p style={{ fontWeight: 700 }}>Vikas Pal</p>
                    <p style={{ fontSize: '0.65rem', color: '#64748b' }}>vikas@example.com</p>
                    <div style={{ marginTop: '0.4rem', background: 'rgba(37,99,235,0.15)', color: '#2563eb', fontWeight: 700, padding: '0.15rem 0.3rem', borderRadius: '4px', display: 'inline-block' }}>
                      ATS 92
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="bento-card-title">A tailored, ATS-ready resume per role</h3>
                <p className="bento-card-desc">Keyword-aligned, ATS-friendly, and quantified — strictly fact-checked against your profile with 0% hallucinations.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 003 ● Integrations Orbit */}
      <section id="integrations" className="orbit-section">
        <div className="container orbit-container">
          <div>
            <p className="section-tag">003 ● Integrations</p>
            <h2 className="section-title">Your entire hiring toolkit in <span style={{ color: 'var(--color-primary)' }}>one place.</span></h2>
            <p className="section-subtitle">
              Job searching spans platforms, portals, and your inbox. Jobsapply connects everything in a single autonomous agent. No setup headaches. No tab switching. We manage the full stack.
            </p>
          </div>

          <div className="orbit-viewport">
            {/* Center Hub */}
            <div className="orbit-center-hub">
              ⚡
            </div>

            {/* Outer Orbit: Job Portals */}
            <div className="orbit-ring-outer">
              <div className="orbit-node" style={{ top: 0, left: '50%', transform: 'translate(-50%, -50%)' }}>Naukri</div>
              <div className="orbit-node" style={{ top: '50%', right: 0, transform: 'translate(50%, -50%)' }}>LinkedIn</div>
              <div className="orbit-node" style={{ bottom: 0, left: '50%', transform: 'translate(-50%, 50%)' }}>Foundit</div>
              <div className="orbit-node" style={{ top: '50%', left: 0, transform: 'translate(-50%, -50%)' }}>Hirist</div>
            </div>

            {/* Inner Orbit: Tools & AI */}
            <div className="orbit-ring-inner">
              <div className="orbit-node" style={{ top: '15%', right: '15%' }}>Gmail</div>
              <div className="orbit-node" style={{ bottom: '15%', left: '15%' }}>LaTeX</div>
            </div>
          </div>
        </div>
      </section>

      {/* 004 ● How It Works (Guest Gateway) */}
      <section id="how-it-works" className="workspace-section">
        <div className="container">
          <p className="section-tag">004 ● How it works</p>
          <h2 className="section-title">How our AI job agent operates: <span style={{ color: 'var(--color-primary)' }}>five automated steps.</span></h2>
          <p className="section-subtitle">Experience each stage of your autonomous job search right here.</p>

          {/* Guest Gateway Card */}
          <div style={{ background: 'white', border: '1px solid var(--color-surface-border)', borderRadius: 'var(--radius-3xl)', marginTop: '2.5rem', boxShadow: 'var(--shadow-md)', overflow: 'hidden' }}>
            <div style={{ textAlign: 'center', maxWidth: '680px', margin: '0 auto', padding: '4rem 1.5rem' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '18px', background: 'rgba(37,99,235,0.1)', color: '#2563eb', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', marginBottom: '1.25rem' }}>⚡</div>
              <h3 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-text-title)', letterSpacing: '-0.03em', marginBottom: '0.75rem' }}>
                India's First AI Job Hunting Agent
              </h3>
              <p style={{ fontSize: '1.05rem', color: 'var(--color-text-body)', lineHeight: 1.6, marginBottom: '2rem' }}>
                Tired of endless manual applications? Sign in to upload your resume, select your target locations (Mumbai, Pune, Bengaluru), and let our agent tailor ATS resumes and apply for you around the clock.
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
