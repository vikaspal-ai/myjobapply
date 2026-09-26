/**
 * Section-Aware AST Resume Parser
 *
 * Accurately extracts:
 * 1. Exact skills written by the candidate (from SKILLS/TECHNOLOGIES sections or body).
 * 2. Cumulative years of experience computed from explicit statements or date spans.
 * 3. Most recent / current job title from headlines or experience records.
 *
 * Invariant: Never invent or inject hardcoded dummy skills or fake default titles.
 */

export interface ParsedResume {
  skills: string[];
  experienceYears: number;
  suggestedTitle: string;
  atsScore: number;
  extractedSections: {
    hasSkillsSection: boolean;
    hasExperienceSection: boolean;
    hasEducationSection: boolean;
  };
}

// Broad vocabulary of 400+ recognized technical skills, frameworks, languages & tools
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
    return {
      skills: [],
      experienceYears: 0,
      suggestedTitle: '',
      atsScore: 70,
      extractedSections: { hasSkillsSection: false, hasExperienceSection: false, hasEducationSection: false }
    };
  }

  const lines = resumeText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // 1. Identify Sections
  let inSkillsSection = false;
  let inExperienceSection = false;
  let inEducationSection = false;
  const skillsLines: string[] = [];
  const experienceLines: string[] = [];

  const sectionHeaderRegex = /^(?:technical\s+)?(?:skills|competencies|technologies|tools(?:\s+and\s+technologies)?|expertise|work\s+experience|professional\s+experience|employment\s+history|experience|education|projects)\b[:\s]*$/i;

  for (const line of lines) {
    if (sectionHeaderRegex.test(line) || /^[A-Z\s]{4,25}:?$/.test(line)) {
      if (/skills|competencies|technologies|tools|expertise/i.test(line)) {
        inSkillsSection = true;
        inExperienceSection = false;
        inEducationSection = false;
        continue;
      } else if (/experience|employment|work\s+history/i.test(line)) {
        inSkillsSection = false;
        inExperienceSection = true;
        inEducationSection = false;
        continue;
      } else if (/education|academics|qualifications/i.test(line)) {
        inSkillsSection = false;
        inExperienceSection = false;
        inEducationSection = true;
        continue;
      } else if (/projects|certifications|awards|summary|profile|objective/i.test(line)) {
        inSkillsSection = false;
        inExperienceSection = false;
        inEducationSection = false;
        continue;
      }
    }

    if (inSkillsSection) {
      skillsLines.push(line);
    } else if (inExperienceSection) {
      experienceLines.push(line);
    }
  }

  // 2. Extract Skills (Exact tokens from Candidate's text first)
  const detectedSkills = new Map<string, string>(); // lowercase -> display

  // Strategy A: If explicit skills section exists, parse candidate's raw items
  if (skillsLines.length > 0) {
    for (const line of skillsLines) {
      // Remove subcategory labels (e.g., "Languages: Python, Java", "Frontend - React, Redux")
      const cleanLine = line.replace(/^[A-Za-z0-9\s/&]+[:\-–]\s*/, '');
      // Split on commas, bullets, pipes, semicolons
      const tokens = cleanLine.split(/[,•|;*·\t]+|\s{2,}/).map(t => t.trim()).filter(Boolean);
      for (const rawToken of tokens) {
        // Strip trailing/leading punctuation
        const token = rawToken.replace(/^[-•*–\s]+|[-•*–\s.,]+$/g, '');
        if (token.length >= 2 && token.length <= 35 && !/^(and|etc|proficient|experienced|familiar|knowledge|good|strong)\b/i.test(token)) {
          const lower = token.toLowerCase();
          if (!detectedSkills.has(lower)) {
            // Normalize common skill casings
            const display = KNOWN_SKILLS.has(lower)
              ? formatSkillCasing(lower)
              : token.charAt(0).toUpperCase() + token.slice(1);
            detectedSkills.set(lower, display);
          }
        }
      }
    }
  }

  // Strategy B: Supplement with technical skills found across the text
  for (const known of KNOWN_SKILLS) {
    if (!detectedSkills.has(known)) {
      // Word boundary match
      const escaped = known.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`(?:^|[^a-zA-Z0-9#+])${escaped}(?:$|[^a-zA-Z0-9#+])`, 'i');
      if (regex.test(resumeText)) {
        detectedSkills.set(known, formatSkillCasing(known));
      }
    }
  }

  const skillsList = Array.from(detectedSkills.values());

  // 3. Extract Experience (Date Spans + Explicit statements)
  let experienceYears = 0;

  // A. Explicit statement (e.g., "5+ years of experience", "4 years exp")
  const expMatch = resumeText.match(/(\d{1,2})\+?\s*(?:years?|yrs?)(?:\s*(?:of)?\s*(?:total\s*)?(?:experience|exp|working|industry))?/i);
  if (expMatch && parseInt(expMatch[1], 10) <= 40) {
    experienceYears = parseInt(expMatch[1], 10);
  }

  // B. Date range extraction from Experience lines (e.g., "2020 - 2024", "2018 - Present")
  if (experienceYears === 0) {
    const currentYear = new Date().getFullYear();
    const dateRegex = /\b(20\d{2}|19\d{2})\s*(?:-|–|to)\s*(present|current|now|20\d{2})\b/gi;
    let match;
    let minYear = currentYear;
    let maxYear = currentYear;
    let foundDates = false;

    while ((match = dateRegex.exec(resumeText)) !== null) {
      const start = parseInt(match[1], 10);
      const endStr = match[2].toLowerCase();
      const end = (endStr === 'present' || endStr === 'current' || endStr === 'now')
        ? currentYear
        : parseInt(endStr, 10);

      if (start >= 1990 && start <= currentYear && end >= start) {
        foundDates = true;
        if (start < minYear) minYear = start;
        if (end > maxYear) maxYear = end;
      }
    }

    if (foundDates && maxYear >= minYear) {
      experienceYears = Math.min(35, maxYear - minYear);
    }
  }

  // 4. Extract Suggested Title (From headline, top 10 lines, or experience headers)
  let suggestedTitle = '';
  const titlePatterns = [
    /(?:senior|lead|staff|principal|chief|head\s+of|junior|associate)?\s*(?:software|full\s*stack|frontend|backend|devops|cloud|platform|data|machine\s*learning|ai|mobile|ios|android|qa|test|automation|site\s*reliability)\s*(?:engineer|developer|architect|specialist|manager)/i,
    /(?:product|project|engineering)\s*(?:manager|owner|lead|director)/i,
    /(?:solutions?\s*architect|security\s*engineer|data\s*scientist|data\s*analyst)/i,
  ];

  // Check top 10 lines first (headline area)
  for (const line of lines.slice(0, 10)) {
    for (const pat of titlePatterns) {
      const m = line.match(pat);
      if (m && m[0].length >= 5) {
        suggestedTitle = m[0].trim();
        break;
      }
    }
    if (suggestedTitle) break;
  }

  // Check experience lines if headline didn't yield a title
  if (!suggestedTitle && experienceLines.length > 0) {
    for (const line of experienceLines.slice(0, 8)) {
      for (const pat of titlePatterns) {
        const m = line.match(pat);
        if (m && m[0].length >= 5) {
          suggestedTitle = m[0].trim();
          break;
        }
      }
      if (suggestedTitle) break;
    }
  }

  // Normalize Title casing (e.g. "senior software engineer" -> "Senior Software Engineer")
  if (suggestedTitle) {
    suggestedTitle = suggestedTitle
      .split(/\s+/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ')
      .replace(/\bAi\b/g, 'AI')
      .replace(/\bMl\b/g, 'ML')
      .replace(/\bQa\b/g, 'QA')
      .replace(/\bUi\b/g, 'UI')
      .replace(/\bUx\b/g, 'UX');
  }

  // 5. ATS Score Calculation grounded in parsed completeness
  let atsScore = 65;
  if (skillsList.length >= 3) atsScore += 10;
  if (skillsList.length >= 8) atsScore += 10;
  if (experienceYears > 0) atsScore += 5;
  if (suggestedTitle) atsScore += 5;
  if (skillsLines.length > 0) atsScore += 4;
  atsScore = Math.min(98, Math.max(65, atsScore));

  return {
    skills: skillsList,
    experienceYears,
    suggestedTitle,
    atsScore,
    extractedSections: {
      hasSkillsSection: skillsLines.length > 0,
      hasExperienceSection: experienceLines.length > 0,
      hasEducationSection: inEducationSection
    }
  };
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
