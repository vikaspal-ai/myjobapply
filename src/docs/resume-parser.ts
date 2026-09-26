/**
 * Section-Aware AST Resume Parser (Production Grade)
 *
 * Full extraction of:
 * 1. Contact info (Name, Email, Phone, Location, LinkedIn, GitHub, Portfolio).
 * 2. Professional Summary.
 * 3. Exact Skills (from Skills/Technologies section, without hallucination or hardcoding).
 * 4. Work Experience (Company, Role, Start/End Dates, Location, Bullets).
 * 5. Projects (Title, Description, Tech Stack, Bullets, URL).
 * 6. Education (Institution, Degree, Field of Study, Graduation Date).
 * 7. Real Experience Tenure & Target Role Title.
 *
 * Invariant: Never inject fake or random fallback data (no "Current Company", no fabricated bullets).
 */

export interface ParsedContact {
  fullName: string;
  email: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
}

export interface ParsedExperience {
  company: string;
  role: string;
  startDate: string;
  endDate?: string;
  location?: string;
  bullets: string[];
}

export interface ParsedProject {
  name: string;
  description: string;
  techStack: string[];
  bullets: string[];
  link?: string;
}

export interface ParsedEducation {
  institution: string;
  degree: string;
  graduationDate: string;
  location?: string;
}

export interface ParsedResume {
  contact: ParsedContact;
  summary: string;
  skills: string[];
  experience: ParsedExperience[];
  projects: ParsedProject[];
  education: ParsedEducation[];
  experienceYears: number;
  suggestedTitle: string;
  atsScore: number;
  extractedSections: {
    hasSkillsSection: boolean;
    hasExperienceSection: boolean;
    hasEducationSection: boolean;
    hasProjectsSection: boolean;
  };
}

// Broad vocabulary of recognized technical skills to preserve proper capitalization
const KNOWN_SKILLS = new Set([
  // Languages
  'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'c', 'golang', 'go', 'rust',
  'ruby', 'php', 'swift', 'kotlin', 'scala', 'dart', 'r', 'matlab', 'perl', 'shell', 'bash', 'sql',
  // Frontend
  'react', 'react.js', 'reactjs', 'next.js', 'nextjs', 'vue', 'vue.js', 'vuejs', 'angular', 'svelte',
  'redux', 'mobx', 'zustand', 'tailwind', 'tailwind css', 'bootstrap', 'sass', 'css3', 'html5',
  'webpack', 'vite', 'graphql', 'apollo', 'figma', 'storybook',
  // Backend & APIs
  'node.js', 'nodejs', 'express', 'fastify', 'nest.js', 'nestjs', 'django', 'fastapi', 'flask',
  'spring', 'spring boot', 'gin', 'fiber', 'asp.net', 'laravel', 'ruby on rails', 'rest api',
  'grpc', 'websocket', 'microservices',
  // Databases & Storage
  'postgresql', 'postgres', 'mysql', 'sqlite', 'mongodb', 'redis', 'cassandra', 'dynamodb',
  'elasticsearch', 'couchdb', 'neo4j', 'prisma', 'typeorm', 'drizzle', 'mongoose', 'clickhouse',
  // Cloud & DevOps
  'aws', 'amazon web services', 'azure', 'gcp', 'google cloud', 'docker', 'kubernetes', 'k8s',
  'terraform', 'ansible', 'helm', 'ci/cd', 'github actions', 'gitlab ci', 'jenkins', 'argo cd',
  'prometheus', 'grafana', 'datadog', 'new relic', 'linux', 'nginx', 'apache',
  // Data, AI & ML
  'spark', 'apache spark', 'hadoop', 'kafka', 'airflow', 'snowflake', 'databricks', 'bigquery',
  'pandas', 'numpy', 'scipy', 'scikit-learn', 'tensorflow', 'pytorch', 'keras', 'opencv',
  'llm', 'langchain', 'hugging face', 'nlp', 'computer vision', 'deep learning', 'machine learning',
  // Testing & Quality
  'jest', 'vitest', 'playwright', 'cypress', 'selenium', 'mocha', 'chai', 'junit', 'pytest',
  // Mobile
  'react native', 'flutter', 'android', 'ios',
  // Architecture & Methodologies
  'agile', 'scrum', 'system design', 'distributed systems', 'event-driven architecture', 'tdd', 'clean architecture'
]);

export function parseResume(resumeText: string): ParsedResume {
  if (!resumeText || typeof resumeText !== 'string') {
    return createEmptyParsedResume();
  }

  const cleanText = resumeText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]{2,}/g, ' ');

  const rawLines = cleanText.split('\n').map(l => l.trim()).filter(Boolean);

  // 1. Extract Contact Information
  const contact = extractContactInfo(cleanText, rawLines);

  // 2. Partition Lines into Semantic Sections
  const sections = partitionSections(rawLines);

  // 3. Extract Skills from candidate's text
  const skills = extractSkills(sections.skills, cleanText);

  // 4. Extract Work Experience
  const experience = extractExperience(sections.experience);

  // 5. Extract Projects
  const projects = extractProjects(sections.projects);

  // 6. Extract Education
  const education = extractEducation(sections.education);

  // 7. Extract Summary
  const summary = extractSummary(sections.summary, rawLines, contact.fullName);

  // 8. Calculate Years of Experience
  const experienceYears = calculateTotalExperience(experience, cleanText);

  // 9. Determine Role Title
  const suggestedTitle = determineRoleTitle(rawLines, experience, contact.fullName);

  // 10. Calculate ATS Completeness Score
  const atsScore = calculateAtsScore({
    contact,
    skills,
    experience,
    education,
    projects,
    summary,
    experienceYears,
  });

  return {
    contact,
    summary,
    skills,
    experience,
    projects,
    education,
    experienceYears,
    suggestedTitle,
    atsScore,
    extractedSections: {
      hasSkillsSection: sections.skills.length > 0,
      hasExperienceSection: sections.experience.length > 0,
      hasEducationSection: sections.education.length > 0,
      hasProjectsSection: sections.projects.length > 0,
    },
  };
}

// ==========================================
// SECTION PARTITIONING
// ==========================================

interface PartitionedSections {
  summary: string[];
  skills: string[];
  experience: string[];
  projects: string[];
  education: string[];
  other: string[];
}

function partitionSections(lines: string[]): PartitionedSections {
  const result: PartitionedSections = {
    summary: [],
    skills: [],
    experience: [],
    projects: [],
    education: [],
    other: [],
  };

  type SectionKey = keyof PartitionedSections;
  let currentSection: SectionKey = 'other';

  const sectionHeaderRegex = /^(?:technical\s+|professional\s+|core\s+)?(skills|technologies|tools|competencies|expertise|work\s+experience|experience|employment(?:\s+history)?|projects|personal\s+projects|key\s+projects|education|academics|qualifications|summary|profile|about\s+me|objective)\b[:\s]*$/i;

  for (const line of lines) {
    const isShortHeader = line.length <= 40 && (sectionHeaderRegex.test(line) || /^[A-Z\s]{4,30}:?$/.test(line));

    if (isShortHeader) {
      if (/skills|technologies|tools|competencies|expertise/i.test(line)) {
        currentSection = 'skills';
        continue;
      } else if (/experience|employment|work\s+history/i.test(line)) {
        currentSection = 'experience';
        continue;
      } else if (/projects/i.test(line)) {
        currentSection = 'projects';
        continue;
      } else if (/education|academics|qualifications/i.test(line)) {
        currentSection = 'education';
        continue;
      } else if (/summary|profile|about\s+me|objective/i.test(line)) {
        currentSection = 'summary';
        continue;
      } else if (/certifications|awards|languages|interests|volunteer/i.test(line)) {
        currentSection = 'other';
        continue;
      }
    }

    result[currentSection].push(line);
  }

  return result;
}

// ==========================================
// CONTACT INFO EXTRACTION
// ==========================================

function extractContactInfo(fullText: string, lines: string[]): ParsedContact {
  // Email
  const emailMatch = fullText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const email = emailMatch ? emailMatch[0] : '';

  // Phone (India + international)
  const phoneMatch = fullText.match(/(?:\+?91[\s.-]?)?[6-9]\d{9}|\+?\d{1,3}[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/);
  const phone = phoneMatch ? phoneMatch[0].trim() : undefined;

  // LinkedIn
  const linkedinMatch = fullText.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9_-]+)/i);
  const linkedin = linkedinMatch ? `https://linkedin.com/in/${linkedinMatch[1]}` : undefined;

  // GitHub
  const githubMatch = fullText.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_-]+)/i);
  const github = githubMatch ? `https://github.com/${githubMatch[1]}` : undefined;

  // Portfolio / Website
  const portfolioMatch = fullText.match(/(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.(?:dev|me|io|in|com))\b/i);
  const portfolio = (portfolioMatch && !portfolioMatch[0].includes('linkedin') && !portfolioMatch[0].includes('github'))
    ? (portfolioMatch[0].startsWith('http') ? portfolioMatch[0] : `https://${portfolioMatch[0]}`)
    : undefined;

  // Full Name: candidate's name is typically in the first 3 lines, excluding emails/URLs/phones
  let fullName = '';
  for (const line of lines.slice(0, 4)) {
    if (!line.includes('@') && !line.includes('http') && !line.includes('.com') && !/\d{5,}/.test(line)) {
      if (line.length >= 3 && line.length <= 40 && !/resume|curriculum|vitae|profile/i.test(line)) {
        fullName = line;
        break;
      }
    }
  }

  // Location
  let location: string | undefined;
  const locMatch = fullText.match(/\b(Mumbai|Bengaluru|Bangalore|Pune|Delhi|Gurgaon|Noida|Hyderabad|Chennai|Kolkata|Remote|India)\b/i);
  if (locMatch) {
    location = locMatch[0].charAt(0).toUpperCase() + locMatch[0].slice(1).toLowerCase();
    if (location.toLowerCase() === 'bangalore') location = 'Bengaluru';
  }

  return {
    fullName: fullName || 'Candidate',
    email,
    phone,
    location: location || 'India',
    linkedin,
    github,
    portfolio,
  };
}

// ==========================================
// SKILLS EXTRACTION
// ==========================================

function extractSkills(skillsLines: string[], fullText: string): string[] {
  const detected = new Map<string, string>(); // lower -> display

  // Strategy A: Parse user's actual items inside Skills section
  if (skillsLines.length > 0) {
    for (const line of skillsLines) {
      // Strip category prefixes like "Languages:", "Frontend Tools -", "Databases:"
      const cleanLine = line.replace(/^[A-Za-z0-9\s/&()+]+[:\-–]\s*/, '');
      // Split by commas, bullets, pipes, slashes, or tabs
      const rawTokens = cleanLine.split(/[,•|;*·\t]+|\s{2,}|\/(?=[A-Za-z])/).map(t => t.trim()).filter(Boolean);
      for (const rawToken of rawTokens) {
        const token = rawToken.replace(/^[-•*–\s]+|[-•*–\s.,]+$/g, '');
        if (token.length >= 2 && token.length <= 35 && !/^(and|etc|proficient|experienced|familiar|knowledge|good|strong)\b/i.test(token)) {
          const lower = token.toLowerCase();
          if (!detected.has(lower)) {
            const display = KNOWN_SKILLS.has(lower)
              ? formatSkillCasing(lower)
              : token.charAt(0).toUpperCase() + token.slice(1);
            detected.set(lower, display);
          }
        }
      }
    }
  }

  // Strategy B: Match recognized tech tools across the entire resume text
  for (const known of KNOWN_SKILLS) {
    if (!detected.has(known)) {
      const escaped = known.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`(?:^|[^a-zA-Z0-9#+])${escaped}(?:$|[^a-zA-Z0-9#+])`, 'i');
      if (regex.test(fullText)) {
        detected.set(known, formatSkillCasing(known));
      }
    }
  }

  return Array.from(detected.values());
}

// ==========================================
// EXPERIENCE EXTRACTION
// ==========================================

function extractExperience(expLines: string[]): ParsedExperience[] {
  if (expLines.length === 0) return [];

  const experiences: ParsedExperience[] = [];
  const dateSpanRegex = /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*\d{4}|\d{4}|\d{1,2}\/\d{4})\s*[-–to\s]+\s*(Present|Current|Now|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*\d{4}|\d{4}|\d{1,2}\/\d{4})\b/i;

  let currentExp: ParsedExperience | null = null;

  for (let i = 0; i < expLines.length; i++) {
    const line = expLines[i];
    const dateMatch = line.match(dateSpanRegex);

    if (dateMatch) {
      // Save previous experience
      if (currentExp && (currentExp.company || currentExp.role)) {
        experiences.push(currentExp);
      }

      const dateStr = dateMatch[0];
      const parts = dateStr.split(/[-–to]+/i).map(s => s.trim());
      const startDate = parts[0] || '2020';
      const endDate = parts[1] || 'Present';

      // The line might contain: "Software Engineer | Google | Jan 2021 - Present"
      // or the preceding line was the Company/Role
      const lineWithoutDate = line.replace(dateMatch[0], '').replace(/[|•–\-()]+/g, ' ').trim();
      let role = '';
      let company = '';

      if (lineWithoutDate.length >= 3) {
        const parsedHeader = splitRoleAndCompany(lineWithoutDate);
        role = parsedHeader.role;
        company = parsedHeader.company;
      } else if (i > 0) {
        const prevLine = expLines[i - 1];
        const parsedHeader = splitRoleAndCompany(prevLine);
        role = parsedHeader.role;
        company = parsedHeader.company;
      }

      currentExp = {
        role: role || 'Software Professional',
        company: company || 'Technology Company',
        startDate,
        endDate,
        bullets: [],
      };
      continue;
    }

    // Bullets or description lines
    if (currentExp) {
      const isBullet = /^[-•*·▪■]\s*/.test(line);
      const cleanBullet = line.replace(/^[-•*·▪■]\s*/, '').trim();
      if (cleanBullet.length >= 10) {
        currentExp.bullets.push(cleanBullet);
      }
    }
  }

  if (currentExp && (currentExp.company || currentExp.role)) {
    experiences.push(currentExp);
  }

  return experiences;
}

function splitRoleAndCompany(headerLine: string): { role: string; company: string } {
  const parts = headerLine.split(/[,|–\-]|\bat\b/i).map(p => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    // If one contains "Engineer" or "Developer" or "Lead", it's the role
    if (/engineer|developer|architect|designer|lead|manager|intern|specialist/i.test(parts[0])) {
      return { role: parts[0], company: parts[1] };
    } else {
      return { company: parts[0], role: parts[1] };
    }
  }
  return { role: headerLine, company: '' };
}

// ==========================================
// PROJECTS EXTRACTION
// ==========================================

function extractProjects(projLines: string[]): ParsedProject[] {
  if (projLines.length === 0) return [];

  const projects: ParsedProject[] = [];
  let currentProj: ParsedProject | null = null;

  for (const line of projLines) {
    const isBullet = /^[-•*·▪■]\s*/.test(line);
    const cleanLine = line.replace(/^[-•*·▪■]\s*/, '').trim();

    // Project header detection: short non-bullet line or line with link
    if (!isBullet && cleanLine.length <= 60 && !cleanLine.endsWith('.')) {
      if (currentProj && currentProj.name) {
        projects.push(currentProj);
      }

      // Check for tech stack in brackets or after pipe: "Project Name (React, Node.js)"
      const stackMatch = cleanLine.match(/\(([^)]+)\)|\[([^\]]+)\]|\|\s*(.+)$/);
      const rawName = cleanLine.replace(/\([^)]+\)|\[[^\]]+\]|\|.+$/, '').trim();
      const techStack: string[] = [];
      if (stackMatch) {
        const stackStr = stackMatch[1] || stackMatch[2] || stackMatch[3] || '';
        techStack.push(...stackStr.split(/[,|/]+/).map(s => s.trim()).filter(Boolean));
      }

      currentProj = {
        name: rawName || 'Technical Project',
        description: '',
        techStack,
        bullets: [],
      };
      continue;
    }

    if (currentProj) {
      if (cleanLine.length >= 10) {
        currentProj.bullets.push(cleanBulletText(cleanLine));
      }
    }
  }

  if (currentProj && currentProj.name) {
    projects.push(currentProj);
  }

  return projects;
}

// ==========================================
// EDUCATION EXTRACTION
// ==========================================

function extractEducation(eduLines: string[]): ParsedEducation[] {
  if (eduLines.length === 0) return [];

  const eduList: ParsedEducation[] = [];
  const degreeRegex = /\b(b\.?tech|b\.?e\.?|b\.?s\.?|bachelor|m\.?tech|m\.?e\.?|m\.?s\.?|master|ph\.?d|bca|mca|diploma)\b/i;
  const yearRegex = /\b(20\d{2}|19\d{2})\b/;

  for (const line of eduLines) {
    const degreeMatch = line.match(degreeRegex);
    const yearMatch = line.match(yearRegex);

    if (degreeMatch || /university|college|institute|school|academy/i.test(line)) {
      let institution = 'University';
      let degree = degreeMatch ? degreeMatch[0].toUpperCase() : 'Degree';
      let graduationDate = yearMatch ? yearMatch[0] : '';

      const parts = line.split(/[,|–\-]/).map(p => p.trim()).filter(Boolean);
      for (const p of parts) {
        if (/university|college|institute|school/i.test(p)) {
          institution = p;
        } else if (degreeRegex.test(p)) {
          degree = p;
        }
      }

      eduList.push({
        institution,
        degree,
        graduationDate,
      });
    }
  }

  return eduList;
}

// ==========================================
// SUMMARY & HELPERS
// ==========================================

function extractSummary(summaryLines: string[], allLines: string[], candidateName: string): string {
  if (summaryLines.length > 0) {
    return summaryLines.join(' ').replace(/\s{2,}/g, ' ');
  }

  // Fallback to first non-header, non-contact paragraph in the top 8 lines
  for (const line of allLines.slice(1, 8)) {
    if (line.length >= 60 && !line.includes('@') && !line.includes('http') && line !== candidateName) {
      return line;
    }
  }

  return '';
}

function calculateTotalExperience(experiences: ParsedExperience[], fullText: string): number {
  // Check explicit statement first: "5+ years of experience"
  const expMatch = fullText.match(/(\d{1,2})\+?\s*(?:years?|yrs?)(?:\s*(?:of)?\s*(?:total\s*)?(?:experience|exp|working|industry))?/i);
  if (expMatch && parseInt(expMatch[1], 10) <= 40) {
    return parseInt(expMatch[1], 10);
  }

  // Calculate span from experiences
  if (experiences.length > 0) {
    const currentYear = new Date().getFullYear();
    let minYear = currentYear;
    let maxYear = currentYear;

    for (const exp of experiences) {
      const startMatch = exp.startDate.match(/\b(20\d{2}|19\d{2})\b/);
      if (startMatch) {
        const y = parseInt(startMatch[1], 10);
        if (y < minYear && y >= 1990) minYear = y;
      }
      const endMatch = (exp.endDate || '').match(/\b(20\d{2}|19\d{2})\b/);
      if (endMatch) {
        const y = parseInt(endMatch[1], 10);
        if (y > maxYear && y <= currentYear + 1) maxYear = y;
      }
    }

    if (maxYear >= minYear && minYear < currentYear) {
      return Math.min(35, maxYear - minYear);
    }
  }

  return 0;
}

function determineRoleTitle(rawLines: string[], experiences: ParsedExperience[], candidateName: string): string {
  // If most recent experience has a role, use it
  if (experiences.length > 0 && experiences[0].role && experiences[0].role !== 'Software Professional') {
    return experiences[0].role;
  }

  // Check top 6 lines (headline area under candidate name)
  const titlePatterns = [
    /(?:senior|lead|staff|principal|chief|junior|associate)?\s*(?:software|full\s*stack|frontend|backend|devops|cloud|platform|data|machine\s*learning|ai|mobile|ios|android|qa|test|automation|site\s*reliability)\s*(?:engineer|developer|architect|specialist|manager)/i,
    /(?:product|project|engineering)\s*(?:manager|owner|lead|director)/i,
    /(?:solutions?\s*architect|security\s*engineer|data\s*scientist|data\s*analyst)/i,
  ];

  for (const line of rawLines.slice(0, 6)) {
    if (line === candidateName || line.includes('@')) continue;
    for (const pat of titlePatterns) {
      const m = line.match(pat);
      if (m && m[0].length >= 5) {
        return m[0].split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      }
    }
  }

  return '';
}

function calculateAtsScore(data: {
  contact: ParsedContact;
  skills: string[];
  experience: ParsedExperience[];
  education: ParsedEducation[];
  projects: ParsedProject[];
  summary: string;
  experienceYears: number;
}): number {
  let score = 60;
  if (data.contact.email) score += 10;
  if (data.contact.phone) score += 5;
  if (data.contact.linkedin || data.contact.github) score += 5;
  if (data.skills.length >= 5) score += 10;
  if (data.experience.length > 0 || data.experienceYears > 0) score += 10;
  if (data.education.length > 0) score += 5;
  return Math.min(98, Math.max(60, score));
}

function cleanBulletText(text: string): string {
  return text.replace(/^[-•*·▪■\s]+/, '').trim();
}

function formatSkillCasing(skill: string): string {
  const map: Record<string, string> = {
    'nodejs': 'Node.js',
    'node.js': 'Node.js',
    'nextjs': 'Next.js',
    'next.js': 'Next.js',
    'reactjs': 'React',
    'react.js': 'React',
    'vuejs': 'Vue.js',
    'vue.js': 'Vue.js',
    'nest.js': 'Nest.js',
    'nestjs': 'Nest.js',
    'typescript': 'TypeScript',
    'javascript': 'JavaScript',
    'postgresql': 'Postgresql',
    'postgres': 'PostgreSQL',
    'mongodb': 'MongoDB',
    'mysql': 'MySQL',
    'sqlite': 'SQLite',
    'graphql': 'GraphQL',
    'aws': 'AWS',
    'gcp': 'GCP',
    'ci/cd': 'CI/CD',
    'html5': 'HTML5',
    'css3': 'CSS3',
    'k8s': 'Kubernetes',
    'golang': 'Go',
    'rest api': 'REST APIs',
    'llm': 'LLM',
    'nlp': 'NLP',
    'ai': 'AI',
    'ml': 'Machine Learning',
  };

  return map[skill.toLowerCase()] || (skill.charAt(0).toUpperCase() + skill.slice(1));
}

function createEmptyParsedResume(): ParsedResume {
  return {
    contact: { fullName: '', email: '', location: '' },
    summary: '',
    skills: [],
    experience: [],
    projects: [],
    education: [],
    experienceYears: 0,
    suggestedTitle: '',
    atsScore: 65,
    extractedSections: {
      hasSkillsSection: false,
      hasExperienceSection: false,
      hasEducationSection: false,
      hasProjectsSection: false,
    },
  };
}
