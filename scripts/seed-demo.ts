import { sql } from '../src/db/index.js';
import { masterTemplateEngine } from '../src/docs/master.js';

interface DemoUser {
  fullName: string;
  email: string;
  preferredLocations: string[];
  currentLocation: string;
  facts: Array<{ category: string; statement: string; verified: boolean }>;
  masterResume: {
    title: string;
    contact: Record<string, string>;
    summary: string;
    skills: Array<{ category: string; skills: string[] }>;
    experience: Array<{ company: string; role: string; startDate: string; endDate: string; bullets: Array<{ text: string }> }>;
    projects: Array<any>;
    education: Array<{ institution: string; degree: string; graduationDate: string }>;
  };
}

const DEMO_USERS: DemoUser[] = [
  {
    fullName: 'Vikas Pal',
    email: 'vikas.pal@demo.jobsapply',
    preferredLocations: ['Mumbai', 'Pune', 'Bengaluru', 'Remote'],
    currentLocation: 'India',
    facts: [
      { category: 'skill', statement: 'Architected high-throughput backend services using TypeScript, Node.js, and PostgreSQL.', verified: true },
      { category: 'skill', statement: 'Built automated CI/CD pipelines and microservices with Docker and Kubernetes.', verified: true },
      { category: 'skill', statement: 'Designed scalable event-driven systems with Kafka and Redis.', verified: true },
      { category: 'experience', statement: '5+ years as Senior Backend Engineer at fintech scaleups in Mumbai and Bengaluru.', verified: true },
      { category: 'education', statement: 'B.Tech Computer Science, National Institute of Technology.', verified: true },
    ],
    masterResume: {
      title: 'Vikas Pal - Master Resume',
      contact: { fullName: 'Vikas Pal', email: 'vikas.pal@demo.jobsapply', location: 'Bengaluru, India', github: 'https://github.com/vikaspal' },
      summary: 'Senior Backend Engineer specialized in distributed systems, fintech payments, and high-concurrency architectures.',
      skills: [
        { category: 'Backend & Databases', skills: ['TypeScript', 'Node.js', 'PostgreSQL'] },
        { category: 'Cloud & Infrastructure', skills: ['Docker', 'Kubernetes', 'AWS'] },
        { category: 'Messaging & Streaming', skills: ['Kafka', 'Redis', 'RabbitMQ'] },
      ],
      experience: [
        {
          company: 'Tech Scale Enterprise',
          role: 'Senior Backend Engineer',
          startDate: '2021-03',
          endDate: 'Present',
          bullets: [
            { text: 'Architected high-throughput backend services using TypeScript, Node.js, and PostgreSQL.' },
            { text: 'Built automated CI/CD pipelines and microservices with Docker and Kubernetes.' },
            { text: 'Reduced API latency by 40% through query optimization and caching strategies.' },
          ],
        },
      ],
      projects: [],
      education: [{ institution: 'National Institute of Technology', degree: 'B.Tech Computer Science', graduationDate: '2019-05' }],
    },
  },
  {
    fullName: 'Priya Sharma',
    email: 'priya.sharma@demo.jobsapply',
    preferredLocations: ['Bengaluru', 'Remote'],
    currentLocation: 'India',
    facts: [
      { category: 'skill', statement: 'Expert in React, TypeScript, and modern frontend architecture with 6+ years experience.', verified: true },
      { category: 'skill', statement: 'Led design system adoption across 15+ product teams, improving consistency and velocity.', verified: true },
      { category: 'skill', statement: 'Performance optimization: reduced bundle size by 35% and improved Core Web Vitals.', verified: true },
      { category: 'experience', statement: 'Frontend Lead at major Indian tech companies, managing 8-person teams.', verified: true },
      { category: 'education', statement: 'M.Tech Computer Science, IIT Bombay.', verified: true },
    ],
    masterResume: {
      title: 'Priya Sharma - Master Resume',
      contact: { fullName: 'Priya Sharma', email: 'priya.sharma@demo.jobsapply', location: 'Bengaluru, India', github: 'https://github.com/priyasharma' },
      summary: 'Frontend Engineering Lead with expertise in React ecosystem, design systems, and web performance.',
      skills: [
        { category: 'Frontend Frameworks', skills: ['React', 'TypeScript', 'Next.js'] },
        { category: 'Architecture & Systems', skills: ['Design Systems', 'Micro-frontends', 'Monorepos'] },
        { category: 'Performance', skills: ['Web Vitals', 'Bundle Optimization', 'SSR/SSG'] },
      ],
      experience: [
        {
          company: 'FinTech Unicorn',
          role: 'Frontend Engineering Lead',
          startDate: '2020-06',
          endDate: 'Present',
          bullets: [
            { text: 'Led design system adoption across 15+ product teams, improving consistency and velocity.' },
            { text: 'Reduced bundle size by 35% and improved Core Web Vitals across all properties.' },
            { text: 'Mentored 8 engineers; established code review standards and frontend guild practices.' },
          ],
        },
      ],
      projects: [],
      education: [{ institution: 'IIT Bombay', degree: 'M.Tech Computer Science', graduationDate: '2018-06' }],
    },
  },
  {
    fullName: 'Arjun Desai',
    email: 'arjun.desai@demo.jobsapply',
    preferredLocations: ['Mumbai', 'Pune', 'Remote'],
    currentLocation: 'India',
    facts: [
      { category: 'skill', statement: 'Full-stack engineer with deep expertise in Node.js, React, and PostgreSQL.', verified: true },
      { category: 'skill', statement: 'Built and scaled payment processing systems handling 100K+ transactions/day.', verified: true },
      { category: 'skill', statement: 'Strong background in system design, microservices, and DevOps practices.', verified: true },
      { category: 'experience', statement: '4+ years across Mumbai and Pune tech ecosystems.', verified: true },
      { category: 'education', statement: 'B.E. Computer Engineering, Pune University.', verified: true },
    ],
    masterResume: {
      title: 'Arjun Desai - Master Resume',
      contact: { fullName: 'Arjun Desai', email: 'arjun.desai@demo.jobsapply', location: 'Pune, India', github: 'https://github.com/arjundesai' },
      summary: 'Full-Stack Engineer with payments domain expertise, building scalable systems in Mumbai-Pune corridor.',
      skills: [
        { category: 'Full Stack', skills: ['Node.js', 'React', 'TypeScript', 'PostgreSQL'] },
        { category: 'Payments & Fintech', skills: ['UPI Integration', 'PCI-DSS', 'Transaction Processing'] },
        { category: 'DevOps & Cloud', skills: ['Docker', 'Kubernetes', 'AWS', 'Terraform'] },
      ],
      experience: [
        {
          company: 'Payment Gateway Startup',
          role: 'Senior Full-Stack Engineer',
          startDate: '2021-01',
          endDate: 'Present',
          bullets: [
            { text: 'Built and scaled payment processing systems handling 100K+ transactions/day.' },
            { text: 'Designed idempotent transaction processing with exactly-once guarantees.' },
            { text: 'Implemented PCI-DSS compliant infrastructure with automated compliance checks.' },
          ],
        },
      ],
      projects: [],
      education: [{ institution: 'Pune University', degree: 'B.E. Computer Engineering', graduationDate: '2020-05' }],
    },
  },
];

async function main() {
  if (!sql) {
    console.error('❌ Database not configured. Check .env');
    process.exit(1);
  }

  console.log('🌱 Seeding persistent demo users...\n');

  // Seed real Indian tech jobs
  console.log('📥 Seeding real Indian tech jobs...');
  const { seedIndianTechJobs } = await import('../src/connectors/india-tech-seed.js');
  await seedIndianTechJobs();
  console.log('✅ Real jobs seeded\n');

  for (const demo of DEMO_USERS) {
    // Upsert candidate profile
    const [existing] = await sql<{ id: string }[]>`
      SELECT id FROM profile.candidate_profiles WHERE email = ${demo.email}
    `;

    let candidateId: string;
    if (existing) {
      candidateId = existing.id;
      await sql`
        UPDATE profile.candidate_profiles
        SET full_name = ${demo.fullName},
            preferred_locations = ${demo.preferredLocations},
            current_location = ${demo.currentLocation},
            is_demo = true,
            updated_at = now()
        WHERE id = ${candidateId}
      `;
      console.log(`🔄 Updated existing demo user: ${demo.fullName} (${candidateId})`);

      await sql`DELETE FROM profile.candidate_facts WHERE candidate_id = ${candidateId}`;
      await sql`DELETE FROM docs.resume_versions WHERE resume_id IN (SELECT id FROM docs.resumes WHERE candidate_id = ${candidateId})`;
      await sql`DELETE FROM docs.resumes WHERE candidate_id = ${candidateId}`;
      await sql`DELETE FROM docs.cover_letter_versions WHERE cover_letter_id IN (SELECT id FROM docs.cover_letters WHERE candidate_id = ${candidateId})`;
      await sql`DELETE FROM docs.cover_letters WHERE candidate_id = ${candidateId}`;
    } else {
      const [inserted] = await sql<{ id: string }[]>`
        INSERT INTO profile.candidate_profiles (full_name, email, preferred_locations, current_location, is_demo)
        VALUES (${demo.fullName}, ${demo.email}, ${demo.preferredLocations}, ${demo.currentLocation}, true)
        RETURNING id
      `;
      candidateId = inserted.id;
      console.log(`✅ Created demo user: ${demo.fullName} (${candidateId})`);
    }

    // Insert facts
    for (const fact of demo.facts) {
      await sql`
        INSERT INTO profile.candidate_facts (candidate_id, category, statement, verified)
        VALUES (${candidateId}, ${fact.category}, ${fact.statement}, ${fact.verified})
      `;
    }

    // Create master resume
    const master = await masterTemplateEngine.createMasterResume(candidateId, demo.masterResume.title, demo.masterResume);
    console.log(`   📄 Master Resume: ${master.resumeId} v1 (${master.artifactId})`);
  }

  console.log('\n🎉 Demo seeding complete! Users visible at http://localhost:3000');
  await sql.end();
}

main().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});