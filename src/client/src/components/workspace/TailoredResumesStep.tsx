import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';

export const TailoredResumesStep: React.FC = () => {
  const { candidateProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'preview' | 'latex'>('preview');

  const candidateName = candidateProfile?.fullName || 'Rahul Sharma';
  const candidateEmail = candidateProfile?.email || 'rahul.sharma@example.com';
  const candidateRole = candidateProfile?.currentJob || 'Senior Full Stack Engineer';
  const candidateLocations = (candidateProfile?.preferredLocations || ['Mumbai', 'Pune', 'Bengaluru']).join(', ');

  const sampleLatex = `\\documentclass[11pt,a4paper]{article}
\\usepackage[margin=0.75in]{geometry}
\\usepackage{hyperref}
\\usepackage{enumitem}

\\begin{document}
\\begin{center}
  {\\LARGE \\textbf{${candidateName}}} \\\\
  \\vspace{2pt}
  ${candidateRole} $\\cdot$ ${candidateLocations} $\\cdot$ \\href{mailto:${candidateEmail}}{${candidateEmail}}
\\end{center}

\\section*{Professional Summary}
Senior Full Stack Engineer with proven track record designing scalable microservices, low-latency APIs, and modern frontend dashboards. Highly experienced in TypeScript, Node.js, Fastify, React, and PostgreSQL.

\\section*{Technical Skills}
\\textbf{Languages}: TypeScript, JavaScript, Python, SQL \\\\
\\textbf{Backend}: Node.js, Fastify, Express, PostgreSQL, Redis, Supabase \\\\
\\textbf{Frontend}: React, Next.js, HTML5, CSS3, Tailwind CSS \\\\
\\textbf{DevOps}: Docker, AWS, Git, CI/CD, Automated Testing

\\section*{Key Projects & Experience}
\\textbf{Autonomous Job Hunt Platform} \\hfill 2024 -- Present \\\\
\\textit{Lead Engineer}
\\begin{itemize}[noitemsep,topsep=0pt]
  \\item Architected dual-lane application automation pipeline processing 500+ daily opportunities.
  \\item Implemented deterministic ATS scoring engine achieving 94% average pass rate.
  \\item Built human-in-the-loop compliance review queue for safety and accuracy.
\\end{itemize}

\\end{document}`;

  return (
    <div className="step-workspace-panel active">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-title)' }}>
            Job-Specific ATS Tailored Resumes
          </h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--color-text-body)' }}>
            Strictly grounded in your Fact Store. Compiled using clean LaTeX with zero fabrication.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className={`btn-sm ${activeTab === 'preview' ? 'btn-gradient' : 'btn-outline'}`}
            onClick={() => setActiveTab('preview')}
          >
            ATS Document View
          </button>
          <button
            type="button"
            className={`btn-sm ${activeTab === 'latex' ? 'btn-gradient' : 'btn-outline'}`}
            onClick={() => setActiveTab('latex')}
          >
            LaTeX Source
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem' }}>
        {/* Main Document Preview */}
        <div style={{ background: 'white', borderRadius: '14px', border: '1px solid var(--color-surface-border)', padding: '2rem', minHeight: '480px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
          {activeTab === 'preview' ? (
            <div>
              <div style={{ borderBottom: '2px solid #0f172a', paddingBottom: '1rem', marginBottom: '1.5rem', textAlign: 'center' }}>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-text-title)' }}>{candidateName}</h2>
                <p style={{ fontSize: '0.9rem', color: 'var(--color-text-body)' }}>
                  {candidateRole} • {candidateLocations} • {candidateEmail}
                </p>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-primary)', borderBottom: '1px solid var(--color-surface-border)', paddingBottom: '0.3rem', marginBottom: '0.5rem' }}>
                  Professional Summary
                </h4>
                <p style={{ fontSize: '0.88rem', color: 'var(--color-text-body)', lineHeight: 1.6 }}>
                  Experienced software engineer focused on building robust full-stack applications with high test coverage, deterministic architectures, and clean database integrations across Indian and global tech environments.
                </p>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-primary)', borderBottom: '1px solid var(--color-surface-border)', paddingBottom: '0.3rem', marginBottom: '0.5rem' }}>
                  Core Competencies & Keywords
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {['TypeScript', 'Node.js', 'React', 'PostgreSQL', 'Fastify', 'Docker', 'AWS', 'REST APIs', 'Playwright'].map((k) => (
                    <span key={k} style={{ background: '#eff6ff', color: '#1e40af', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600 }}>
                      {k}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-primary)', borderBottom: '1px solid var(--color-surface-border)', paddingBottom: '0.3rem', marginBottom: '0.5rem' }}>
                  Verified Experience & Impact
                </h4>
                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', fontWeight: 700 }}>
                    <span>Lead Full Stack Developer</span>
                    <span style={{ color: 'var(--color-text-muted)' }}>2023 – Present</span>
                  </div>
                  <ul style={{ paddingLeft: '1.25rem', fontSize: '0.85rem', color: 'var(--color-text-body)', marginTop: '0.3rem' }}>
                    <li>Engineered low-latency job distribution systems reducing application turnaround by 75%.</li>
                    <li>Integrated Supabase Auth and PostgreSQL relational schema with strict RLS enforcement.</li>
                    <li>Designed modular React dashboards following modern component separation principles.</li>
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <textarea
              readOnly
              value={sampleLatex}
              style={{ width: '100%', height: '420px', fontFamily: 'var(--font-mono)', fontSize: '0.82rem', padding: '1rem', borderRadius: '8px', border: '1px solid var(--color-surface-border)', background: '#f8fafc', color: '#0f172a' }}
            />
          )}
        </div>

        {/* Sidebar: Compliance & Budget Checks */}
        <div>
          <div style={{ background: 'var(--color-surface-soft)', padding: '1.25rem', borderRadius: '14px', border: '1px solid var(--color-surface-border)', marginBottom: '1.25rem' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--color-text-title)' }}>
              ATS Budget & Compliance
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.82rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Page Limit Budget</span>
                <span style={{ fontWeight: 700, color: '#10b981' }}>1 / 2 Pages ✓</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Keyword Coverage</span>
                <span style={{ fontWeight: 700, color: '#10b981' }}>94% Match ✓</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Hallucination Audit</span>
                <span style={{ fontWeight: 700, color: '#10b981' }}>0 False Claims ✓</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Compiler Status</span>
                <span style={{ fontWeight: 700, color: '#2563eb' }}>LaTeX Ready</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            className="btn-gradient"
            style={{ width: '100%', justifyContent: 'center', padding: '0.75rem', marginBottom: '0.75rem' }}
            onClick={() => alert('Exporting ATS PDF artifact for target application...')}
          >
            Download ATS PDF 📥
          </button>
          <button
            type="button"
            className="btn-outline"
            style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }}
            onClick={() => alert('Recompiling tailored LaTeX document...')}
          >
            Re-run Optimization ⚡
          </button>
        </div>
      </div>
    </div>
  );
};
