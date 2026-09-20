import { MasterResumeData, ResumePlan } from './types.js';

/**
 * Escapes reserved LaTeX characters to avoid syntax errors and formatting issues.
 */
export function escapeLatex(text: string): string {
  if (!text) return '';

  return text
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/\$/g, '\\$')
    .replace(/#/g, '\\#')
    .replace(/_/g, '\\_')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}');
}

/**
 * Security sanitizer: Inspects LaTeX source for forbidden directives that could allow
 * arbitrary code execution, file system access, or command injection.
 */
export function sanitizeLatexSource(source: string): { safe: boolean; reason?: string } {
  const forbiddenPatterns = [
    { regex: /(?:\\immediate\s*)?\\write18/i, name: 'Shell Escape (\\write18)' },
    { regex: /\\input\s*\{/i, name: 'File Inclusion (\\input)' },
    { regex: /\\include\s*\{/i, name: 'File Inclusion (\\include)' },
    { regex: /\\openin/i, name: 'File Reading (\\openin)' },
    { regex: /\\openout/i, name: 'File Writing (\\openout)' },
    { regex: /\\catcode/i, name: 'Macro Category Code Manipulation (\\catcode)' },
    { regex: /\\csname/i, name: 'Dynamic Command Name (\\csname)' },
    { regex: /file:\/\//i, name: 'Local File URI Protocol' },
  ];

  for (const { regex, name } of forbiddenPatterns) {
    if (regex.test(source)) {
      return {
        safe: false,
        reason: `Forbidden LaTeX directive detected: ${name}`,
      };
    }
  }

  return { safe: true };
}

/**
 * Renders a full, compilable LaTeX document from tailored resume data and plan.
 */
export function renderLatexResume(data: MasterResumeData, plan: ResumePlan): string {
  const templateName = plan.templateName || 'modern-deedy';
  const isDeedy = templateName === 'modern-deedy';

  const docClass = isDeedy
    ? `\\documentclass[10pt,letterpaper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[margin=0.5in]{geometry}
\\usepackage{hyperref}
\\usepackage{xcolor}
\\usepackage{enumitem}
\\setlist[itemize]{leftmargin=1.5em, itemsep=2pt, topsep=2pt}
\\definecolor{primary}{HTML}{2B6CB0}
\\pagestyle{empty}
`
    : `\\documentclass[11pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[margin=0.75in]{geometry}
\\usepackage{hyperref}
\\usepackage{enumitem}
\\setlist[itemize]{leftmargin=1.5em, itemsep=3pt}
\\pagestyle{empty}
`;

  let body = '';

  // 1. Header / Contact Information
  const name = escapeLatex(data.contact.fullName);
  const email = escapeLatex(data.contact.email);
  const location = data.contact.location ? escapeLatex(data.contact.location) : '';
  const github = data.contact.github ? escapeLatex(data.contact.github) : '';
  const linkedin = data.contact.linkedin ? escapeLatex(data.contact.linkedin) : '';

  const contactItems = [email, location, github, linkedin].filter(Boolean).join(' $|$ ');

  body += `\\begin{center}
  {\\LARGE \\textbf{${name}}} \\\\[4pt]
  {\\small ${contactItems}}
\\end{center}
\\vspace{6pt}
`;

  // 2. Render Sections based on plan.sectionOrder
  for (const section of plan.sectionOrder) {
    if (section === 'summary' && data.summary) {
      body += `\\noindent{\\large \\textbf{\\uppercase{Professional Summary}}} \\\\[-6pt]
\\rule{\\linewidth}{0.5pt} \\\\[4pt]
${escapeLatex(data.summary)} \\\\[10pt]
`;
    }

    if (section === 'skills' && data.skills && data.skills.length > 0) {
      body += `\\noindent{\\large \\textbf{\\uppercase{Technical Skills}}} \\\\[-6pt]
\\rule{\\linewidth}{0.5pt} \\\\[4pt]
\\begin{itemize}
`;
      for (const cat of data.skills) {
        const catName = escapeLatex(cat.category);
        const skillList = cat.skills.map(s => escapeLatex(s)).join(', ');
        body += `  \\item \\textbf{${catName}:} ${skillList}\n`;
      }
      body += `\\end{itemize}
\\vspace{8pt}
`;
    }

    if (section === 'experience' && data.experience && data.experience.length > 0) {
      body += `\\noindent{\\large \\textbf{\\uppercase{Work Experience}}} \\\\[-6pt]
\\rule{\\linewidth}{0.5pt} \\\\[4pt]
`;
      for (const exp of data.experience) {
        const company = escapeLatex(exp.company);
        const role = escapeLatex(exp.role);
        const dates = `${escapeLatex(exp.startDate)} -- ${escapeLatex(exp.endDate || 'Present')}`;
        const loc = exp.location ? escapeLatex(exp.location) : '';

        body += `\\noindent\\textbf{${role}} \\hfill \\textit{${dates}} \\\\
\\noindent\\textbf{\\color{primary}${company}} ${loc ? `\\hfill \\textit{${loc}}` : ''}
\\begin{itemize}
`;
        for (const bullet of exp.bullets) {
          body += `  % factId: ${bullet.factId}\n`;
          body += `  \\item ${escapeLatex(bullet.text)}\n`;
        }
        body += `\\end{itemize}
\\vspace{4pt}
`;
      }
      body += `\\vspace{6pt}\n`;
    }

    if (section === 'projects' && data.projects && data.projects.length > 0) {
      body += `\\noindent{\\large \\textbf{\\uppercase{Key Projects}}} \\\\[-6pt]
\\rule{\\linewidth}{0.5pt} \\\\[4pt]
`;
      for (const proj of data.projects) {
        const pName = escapeLatex(proj.name);
        const stack = proj.techStack.length > 0 ? ` (${escapeLatex(proj.techStack.join(', '))})` : '';

        body += `\\noindent\\textbf{${pName}}${stack}
\\begin{itemize}
`;
        for (const bullet of proj.bullets) {
          body += `  % factId: ${bullet.factId}\n`;
          body += `  \\item ${escapeLatex(bullet.text)}\n`;
        }
        body += `\\end{itemize}
\\vspace{4pt}
`;
      }
      body += `\\vspace{6pt}\n`;
    }

    if (section === 'education' && data.education && data.education.length > 0) {
      body += `\\noindent{\\large \\textbf{\\uppercase{Education}}} \\\\[-6pt]
\\rule{\\linewidth}{0.5pt} \\\\[4pt]
`;
      for (const edu of data.education) {
        const inst = escapeLatex(edu.institution);
        const deg = escapeLatex(edu.degree);
        const grad = escapeLatex(edu.graduationDate);

        body += `\\noindent\\textbf{${inst}} \\hfill \\textit{${grad}} \\\\
\\noindent${deg} \\\\[6pt]
`;
      }
      body += `\\vspace{6pt}\n`;
    }
  }

  return `${docClass}
\\begin{document}
${body}
\\end{document}
`;
}
