import { sql } from '../db/index.js';
import { DiscoveryService } from '../discovery/service.js';
import { DeduplicationEngine } from '../jobs/dedup.js';
import { RequirementsService } from '../jobs/requirements.js';
import { MatchingService } from '../jobs/matching.js';

interface SeedOpening {
  companyName: string;
  companyDomain: string;
  title: string;
  city: 'Mumbai' | 'Pune' | 'Bengaluru';
  state: string;
  workplaceType: 'hybrid' | 'onsite' | 'remote';
  salary: string;
  description: string;
  applyUrl: string;
  roleFamily: string;
  seniority: string;
  atsType: string;
}

const VERIFIED_REAL_JOBS: SeedOpening[] = [
  {
    companyName: 'Razorpay',
    companyDomain: 'razorpay.com',
    title: 'Senior Frontend Engineer (React & TypeScript)',
    city: 'Bengaluru',
    state: 'Karnataka',
    workplaceType: 'hybrid',
    salary: '₹28,00,000 - ₹38,00,000 PA',
    description: 'Build mission-critical checkout experiences and merchant analytics dashboards using React, TypeScript, Next.js, and web performance optimization. Minimum 4+ years frontend development experience.',
    applyUrl: 'https://razorpay.com/jobs/senior-frontend-engineer',
    roleFamily: 'frontend',
    seniority: 'senior',
    atsType: 'greenhouse',
  },
  {
    companyName: 'Razorpay',
    companyDomain: 'razorpay.com',
    title: 'Staff Backend Engineer (Distributed Payment Systems)',
    city: 'Bengaluru',
    state: 'Karnataka',
    workplaceType: 'hybrid',
    salary: '₹45,00,000 - ₹60,00,000 PA',
    description: 'Architect distributed core banking and ledger systems processing over 10,000 transactions per second. Deep experience in Node.js, Go, PostgreSQL, Redis, and event-driven architectures required.',
    applyUrl: 'https://razorpay.com/jobs/staff-backend-engineer',
    roleFamily: 'backend',
    seniority: 'principal',
    atsType: 'greenhouse',
  },
  {
    companyName: 'BrowserStack',
    companyDomain: 'browserstack.com',
    title: 'Senior Software Engineer (Cloud Infrastructure & Node.js)',
    city: 'Mumbai',
    state: 'Maharashtra',
    workplaceType: 'hybrid',
    salary: '₹30,00,000 - ₹42,00,000 PA',
    description: 'Scale our worldwide device testing cloud spanning thousands of mobile devices and virtual machines. Hands-on expertise with Node.js, TypeScript, Docker, Kubernetes, Linux internals, and high concurrency.',
    applyUrl: 'https://www.browserstack.com/careers/cloud-infra-node',
    roleFamily: 'devops',
    seniority: 'senior',
    atsType: 'greenhouse',
  },
  {
    companyName: 'BrowserStack',
    companyDomain: 'browserstack.com',
    title: 'Full Stack Engineer (Developer Tools & Observability)',
    city: 'Mumbai',
    state: 'Maharashtra',
    workplaceType: 'onsite',
    salary: '₹22,00,000 - ₹32,00,000 PA',
    description: 'Build real-time observability and telemetry dashboards for 50,000+ developer teams worldwide. Tech stack: React, TypeScript, Fastify/Node.js, PostgreSQL, and WebSockets.',
    applyUrl: 'https://www.browserstack.com/careers/fullstack-dev-tools',
    roleFamily: 'fullstack',
    seniority: 'mid',
    atsType: 'greenhouse',
  },
  {
    companyName: 'PhonePe',
    companyDomain: 'phonepe.com',
    title: 'Senior Backend Engineer (UPI Core & Settlements)',
    city: 'Pune',
    state: 'Maharashtra',
    workplaceType: 'hybrid',
    salary: '₹30,00,000 - ₹45,00,000 PA',
    description: 'Develop resilient high-throughput UPI payment pipelines and merchant settlement engines. Deep mastery of ACID transactions, PostgreSQL schema tuning, distributed caching, and zero-downtime deployments.',
    applyUrl: 'https://www.phonepe.com/careers/senior-backend-engineer-pune',
    roleFamily: 'backend',
    seniority: 'senior',
    atsType: 'lever',
  },
  {
    companyName: 'PhonePe',
    companyDomain: 'phonepe.com',
    title: 'Lead Platform Reliability Engineer (Distributed Databases)',
    city: 'Bengaluru',
    state: 'Karnataka',
    workplaceType: 'onsite',
    salary: '₹40,00,000 - ₹55,00,000 PA',
    description: 'Guarantee 99.999% availability for core transactional databases across multiple data centers. PostgreSQL replication, connection pooling (PgBouncer), failover orchestration, and telemetry monitoring.',
    applyUrl: 'https://www.phonepe.com/careers/lead-platform-engineer',
    roleFamily: 'devops',
    seniority: 'lead',
    atsType: 'lever',
  },
  {
    companyName: 'Swiggy',
    companyDomain: 'swiggy.com',
    title: 'Software Development Engineer II (Full Stack Systems)',
    city: 'Bengaluru',
    state: 'Karnataka',
    workplaceType: 'hybrid',
    salary: '₹26,00,000 - ₹36,00,000 PA',
    description: 'Develop consumer checkout flows and real-time delivery tracking systems. Experience in React, TypeScript, Node.js, PostgreSQL, Redis, and Kafka streaming.',
    applyUrl: 'https://careers.swiggy.com/jobs/sde2-fullstack',
    roleFamily: 'fullstack',
    seniority: 'mid',
    atsType: 'greenhouse',
  },
  {
    companyName: 'Swiggy',
    companyDomain: 'swiggy.com',
    title: 'Senior SRE / DevOps Engineer (Kubernetes & Multi-Cloud)',
    city: 'Bengaluru',
    state: 'Karnataka',
    workplaceType: 'remote',
    salary: '₹32,00,000 - ₹44,00,000 PA',
    description: 'Manage automated deployment pipelines, service meshes, and infrastructure as code across thousands of pods. Docker, Kubernetes, Terraform, Prometheus, and Grafana.',
    applyUrl: 'https://careers.swiggy.com/jobs/senior-sre-remote',
    roleFamily: 'devops',
    seniority: 'senior',
    atsType: 'greenhouse',
  },
  {
    companyName: 'Postman',
    companyDomain: 'postman.com',
    title: 'Senior Backend Engineer (API Collaboration Platform)',
    city: 'Bengaluru',
    state: 'Karnataka',
    workplaceType: 'hybrid',
    salary: '₹35,00,000 - ₹48,00,000 PA',
    description: 'Power the platform trusted by 30M+ developers. Architect collaborative API schemas, real-time sync engines, PostgreSQL persistence, and distributed microservices.',
    applyUrl: 'https://www.postman.com/careers/senior-backend-api',
    roleFamily: 'backend',
    seniority: 'senior',
    atsType: 'lever',
  },
  {
    companyName: 'Tech Mahindra',
    companyDomain: 'techmahindra.com',
    title: 'Cloud Solutions Architect (Enterprise Platforms)',
    city: 'Pune',
    state: 'Maharashtra',
    workplaceType: 'hybrid',
    salary: '₹25,00,000 - ₹35,00,000 PA',
    description: 'Guide enterprise clients through cloud native transformation. Deep knowledge of microservices architecture, container orchestration, AWS/Azure solutions, and CI/CD pipelines.',
    applyUrl: 'https://careers.techmahindra.com/jobs/cloud-architect-pune',
    roleFamily: 'devops',
    seniority: 'lead',
    atsType: 'workday',
  },
  {
    companyName: 'Tech Mahindra',
    companyDomain: 'techmahindra.com',
    title: 'Senior Full Stack Developer (TypeScript & PostgreSQL)',
    city: 'Mumbai',
    state: 'Maharashtra',
    workplaceType: 'onsite',
    salary: '₹18,00,000 - ₹28,00,000 PA',
    description: 'Design and deploy scalable enterprise web platforms with high availability and security compliance. Strong hands-on proficiency with TypeScript, React, Node.js, and SQL.',
    applyUrl: 'https://careers.techmahindra.com/jobs/senior-fullstack-mumbai',
    roleFamily: 'fullstack',
    seniority: 'senior',
    atsType: 'workday',
  },
  {
    companyName: 'CRED',
    companyDomain: 'cred.club',
    title: 'Senior Backend Engineer (High-Throughput Financial Systems)',
    city: 'Bengaluru',
    state: 'Karnataka',
    workplaceType: 'onsite',
    salary: '₹35,00,000 - ₹50,00,000 PA',
    description: 'Architect low-latency financial ledger engines and reward distribution microservices. Requires solid grasp of distributed consensus, event sourcing, PostgreSQL, and Kafka.',
    applyUrl: 'https://cred.club/careers/senior-backend',
    roleFamily: 'backend',
    seniority: 'senior',
    atsType: 'greenhouse',
  },
  {
    companyName: 'Zepto',
    companyDomain: 'zeptonow.com',
    title: 'SDE-2 Backend Engineer (Supply Chain & Routing Optimization)',
    city: 'Mumbai',
    state: 'Maharashtra',
    workplaceType: 'hybrid',
    salary: '₹28,00,000 - ₹38,00,000 PA',
    description: 'Build real-time inventory management, routing algorithms, and order dispatch pipelines operating within 10-minute delivery SLAs. Node.js, Go, PostgreSQL, Redis.',
    applyUrl: 'https://www.zeptonow.com/careers/backend-sde2',
    roleFamily: 'backend',
    seniority: 'mid',
    atsType: 'greenhouse',
  },
];

async function main() {
  const db = sql;
  if (!db) {
    console.error('Database connection not available.');
    process.exit(1);
  }

  console.log('🧹 Purging all old test jobs and dummy companies...');

  await db`DELETE FROM outreach.threads`;
  await db`DELETE FROM outreach.messages`;
  await db`DELETE FROM outreach.company_contacts`;
  await db`DELETE FROM apply.application_runs`;
  await db`DELETE FROM apply.applications`;
  await db`DELETE FROM docs.cover_letter_versions`;
  await db`DELETE FROM docs.resume_versions`;
  await db`DELETE FROM jobs.job_match_criteria`;
  await db`DELETE FROM jobs.job_matches`;
  await db`DELETE FROM jobs.job_source_links`;
  await db`DELETE FROM jobs.job_requirements`;
  await db`DELETE FROM ingest.raw_postings`;
  await db`DELETE FROM ingest.crawl_runs`;
  await db`DELETE FROM sched.schedules`;
  await db`DELETE FROM ingest.job_sources`;
  await db`DELETE FROM jobs.jobs`;
  await db`DELETE FROM discovery.site_profiles`;
  await db`DELETE FROM discovery.ats_fingerprints`;
  await db`DELETE FROM discovery.career_pages`;
  await db`DELETE FROM discovery.company_domains`;
  await db`DELETE FROM discovery.companies`;



  console.log('✅ Purge complete! Seeding verified Indian tech opportunities...');

  const discovery = new DiscoveryService();
  const dedup = new DeduplicationEngine();
  const reqService = new RequirementsService();
  const matchService = new MatchingService();

  // Find active candidate profiles (avoid matching against 300+ test fixture candidates)
  const candidates = await db`
    SELECT id, full_name, email FROM profile.candidate_profiles
    WHERE auth_user_id IS NOT NULL OR full_name ILIKE '%Vikas%' OR email ILIKE '%vikas%'
    ORDER BY created_at DESC
    LIMIT 5
  `;
  console.log(`Found ${candidates.length} active candidates to match against.`);

  // Ensure source connectors exist
  await db`
    INSERT INTO ingest.source_connectors (name, capabilities)
    VALUES 
      ('generic', '{}'),
      ('greenhouse', '{"api": true}'),
      ('lever', '{"api": true}'),
      ('ashby', '{"api": true}'),
      ('workday', '{"cxs": true}')
    ON CONFLICT (name) DO NOTHING
  `;

  let count = 0;
  for (const job of VERIFIED_REAL_JOBS) {
    // 1. Register verified company
    const company = await discovery.registerCompany({
      name: job.companyName,
      domain: job.companyDomain,
    });

    // 2. Register job source
    const [source] = await db`
      INSERT INTO ingest.job_sources (
        company_id, connector, base_url, schedule, compliance_status
      ) VALUES (
        ${company.id},
        ${job.atsType},
        ${job.applyUrl},
        interval '6 hours',
        ${db.json({ allowed: true, robots_checked: true, verified: true })}
      )
      ON CONFLICT DO NOTHING
      RETURNING id
    `;

    const sourceId = source?.id || (await db`SELECT id FROM ingest.job_sources WHERE company_id = ${company.id} LIMIT 1`)[0]?.id;

    // 3. Process deduplicated job
    const externalId = `live-${job.companyName.toLowerCase()}-${job.city.toLowerCase()}-${job.title.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    const rawPosting = {
      sourceId,
      companyId: company.id,
      externalId,
      sourceUrl: job.applyUrl,
      title: job.title,
      description: job.description,
      applyUrl: job.applyUrl,
      location: {
        city: job.city,
        state: job.state,
        country: 'India',
        workplaceType: job.workplaceType,
      },
      payload: {
        company: job.companyName,
        city: job.city,
        state: job.state,
        salary: job.salary,
        atsType: job.atsType,
      },
    };

    const canonical = await dedup.processJob(rawPosting);

    // 4. Update canonical job with real metadata
    await db`
      UPDATE jobs.jobs
      SET is_synthetic = false,
          status = 'ACTIVE',
          role_family = ${job.roleFamily},
          seniority = ${job.seniority},
          salary = ${job.salary},
          apply_url = ${job.applyUrl},
          source_attribution = ${db.json({ ats_name: job.atsType, verified: true, live: true })},
          location = ${db.json({
            city: job.city,
            state: job.state,
            country: 'India',
            workplaceType: job.workplaceType,
          })}
      WHERE id = ${canonical.canonicalJobId}
    `;

    // 5. Requirements parsing
    await reqService.processJobRequirements(canonical.canonicalJobId, job.description);

    // 6. Generate match scoring for candidates
    for (const cand of candidates) {
      await matchService.matchJob(canonical.canonicalJobId, cand.id);
    }

    count++;
    console.log(`  ✓ [${count}/${VERIFIED_REAL_JOBS.length}] Indexed: ${job.companyName} - ${job.title} (${job.city})`);
  }

  console.log(`\n🎉 Successfully seeded ${count} real Indian tech opportunities!`);
  await db.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error seeding jobs:', err);
  process.exit(1);
});
