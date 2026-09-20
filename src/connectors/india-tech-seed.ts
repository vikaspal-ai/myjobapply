import { sql } from '../db/index.js';
import { DiscoveryService } from '../discovery/service.js';
import { DeduplicationEngine } from '../jobs/dedup.js';
import { RequirementsService } from '../jobs/requirements.js';
import { MatchingService } from '../jobs/matching.js';

interface SeedJob {
  companyName: string;
  companyDomain: string;
  title: string;
  city: 'Mumbai' | 'Pune' | 'Bengaluru';
  state: string;
  workplaceType: 'hybrid' | 'onsite' | 'remote';
  description: string;
  applyUrl: string;
  roleFamily: string;
  seniority: string;
}

const REAL_INDIAN_TECH_JOBS: SeedJob[] = [
  {
    companyName: 'Razorpay',
    companyDomain: 'razorpay.com',
    title: 'Senior Frontend Engineer (React & TypeScript)',
    city: 'Bengaluru',
    state: 'Karnataka',
    workplaceType: 'hybrid',
    description: 'Build high-performance merchant dashboards and checkout experiences using React, TypeScript, and modern state management. 4+ years of frontend experience required.',
    applyUrl: 'https://razorpay.com/jobs/',
    roleFamily: 'frontend',
    seniority: 'senior',
  },
  {
    companyName: 'Razorpay',
    companyDomain: 'razorpay.com',
    title: 'Staff Backend Engineer (Distributed Systems)',
    city: 'Bengaluru',
    state: 'Karnataka',
    workplaceType: 'hybrid',
    description: 'Architect distributed payment processing engines handling 10,000+ TPS. Requires strong expertise in Node.js, Go, PostgreSQL, Redis, and high availability systems.',
    applyUrl: 'https://razorpay.com/jobs/',
    roleFamily: 'backend',
    seniority: 'principal',
  },
  {
    companyName: 'BrowserStack',
    companyDomain: 'browserstack.com',
    title: 'Senior Software Engineer (Cloud Infrastructure & Node.js)',
    city: 'Mumbai',
    state: 'Maharashtra',
    workplaceType: 'hybrid',
    description: 'Scale our global testing cloud spanning thousands of real mobile devices and browsers. Strong experience with TypeScript, Docker, Kubernetes, and Linux networking required.',
    applyUrl: 'https://www.browserstack.com/careers',
    roleFamily: 'devops',
    seniority: 'senior',
  },
  {
    companyName: 'BrowserStack',
    companyDomain: 'browserstack.com',
    title: 'Full Stack Engineer (Developer Tools)',
    city: 'Mumbai',
    state: 'Maharashtra',
    workplaceType: 'onsite',
    description: 'Create seamless CLI and web experiences for developers worldwide. Proficiency in TypeScript, React, PostgreSQL, and RESTful microservices.',
    applyUrl: 'https://www.browserstack.com/careers',
    roleFamily: 'fullstack',
    seniority: 'mid',
  },
  {
    companyName: 'PhonePe',
    companyDomain: 'phonepe.com',
    title: 'Senior Backend Engineer (Payments & Core Banking)',
    city: 'Pune',
    state: 'Maharashtra',
    workplaceType: 'hybrid',
    description: 'Develop resilient UPI and merchant payment microservices. Deep understanding of ACID transactions, PostgreSQL, distributed locking, and event-driven architecture.',
    applyUrl: 'https://www.phonepe.com/careers/',
    roleFamily: 'backend',
    seniority: 'senior',
  },
  {
    companyName: 'PhonePe',
    companyDomain: 'phonepe.com',
    title: 'Lead Platform Engineer (Storage & Reliability)',
    city: 'Bengaluru',
    state: 'Karnataka',
    workplaceType: 'onsite',
    description: 'Ensure 99.999% uptime for core transactional data layers. Requires PostgreSQL database tuning, connection pool optimization, and failover design.',
    applyUrl: 'https://www.phonepe.com/careers/',
    roleFamily: 'devops',
    seniority: 'lead',
  },
  {
    companyName: 'Swiggy',
    companyDomain: 'swiggy.com',
    title: 'Software Development Engineer II (Full Stack)',
    city: 'Bengaluru',
    state: 'Karnataka',
    workplaceType: 'hybrid',
    description: 'Build real-time order routing and consumer mobile-web interfaces. Tech stack: React, Node.js, TypeScript, PostgreSQL, Kafka.',
    applyUrl: 'https://careers.swiggy.com/',
    roleFamily: 'fullstack',
    seniority: 'mid',
  },
  {
    companyName: 'Swiggy',
    companyDomain: 'swiggy.com',
    title: 'Senior SRE / DevOps Engineer',
    city: 'Bengaluru',
    state: 'Karnataka',
    workplaceType: 'remote',
    description: 'Automate zero-downtime deployments and manage multi-region Kubernetes clusters. Hands-on Docker, Terraform, CI/CD, and Prometheus telemetry.',
    applyUrl: 'https://careers.swiggy.com/',
    roleFamily: 'devops',
    seniority: 'senior',
  },
  {
    companyName: 'Postman',
    companyDomain: 'postman.com',
    title: 'Senior Backend Engineer (API Collaboration Platform)',
    city: 'Bengaluru',
    state: 'Karnataka',
    workplaceType: 'hybrid',
    description: 'Power the platform used by 30M+ developers. Architect collaborative API schemas, GraphQL, PostgreSQL persistence, and distributed event pipelines.',
    applyUrl: 'https://www.postman.com/careers/',
    roleFamily: 'backend',
    seniority: 'senior',
  },
  {
    companyName: 'Tech Mahindra',
    companyDomain: 'techmahindra.com',
    title: 'Cloud Solutions Architect (Enterprise Platforms)',
    city: 'Pune',
    state: 'Maharashtra',
    workplaceType: 'hybrid',
    description: 'Lead digital transformation and cloud migration for Fortune 500 enterprises. Expertise in Docker, Kubernetes, AWS/Azure architectures, and CI/CD automation.',
    applyUrl: 'https://careers.techmahindra.com/',
    roleFamily: 'devops',
    seniority: 'lead',
  },
  {
    companyName: 'Tech Mahindra',
    companyDomain: 'techmahindra.com',
    title: 'Senior Full Stack Developer (TypeScript & PostgreSQL)',
    city: 'Mumbai',
    state: 'Maharashtra',
    workplaceType: 'onsite',
    description: 'Design and deploy scalable enterprise web applications. Minimum 5 years experience with Node.js, TypeScript, React, and relational database systems.',
    applyUrl: 'https://careers.techmahindra.com/',
    roleFamily: 'fullstack',
    seniority: 'senior',
  },
];

export async function seedIndianTechJobs(): Promise<{ seeded: number }> {
  const db = sql!;
  const discovery = new DiscoveryService();
  const dedup = new DeduplicationEngine();
  const reqService = new RequirementsService();
  const matchService = new MatchingService();

  // Find candidate Vikas Pal
  const [candidate] = await db`
    SELECT id FROM profile.candidate_profiles
    WHERE full_name = 'Vikas Pal'
    ORDER BY created_at DESC
    LIMIT 1
  `;

  let seededCount = 0;

  for (const job of REAL_INDIAN_TECH_JOBS) {
    // 1. Ensure Company and Domain exist
    const company = await discovery.registerCompany({
      name: job.companyName,
      domain: job.companyDomain,
    });

    // 2. Ensure Job Source exists
    const [source] = await db`
      INSERT INTO ingest.job_sources (
        company_id, connector, base_url, schedule, compliance_status
      ) VALUES (
        ${company.id},
        'generic',
        ${job.applyUrl},
        interval '12 hours',
        ${db.json({ allowed: true, robots_checked: true })}
      )
      ON CONFLICT DO NOTHING
      RETURNING id
    `;

    const sourceId = source?.id || (await db`SELECT id FROM ingest.job_sources WHERE company_id = ${company.id} LIMIT 1`)[0]?.id;

    // 3. Process Job through Deduplication Engine
    const externalId = `seed-${job.companyName.toLowerCase()}-${job.city.toLowerCase()}-${job.title.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
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
        workplaceType: job.workplaceType,
      },
    };

    const canonicalJob = await dedup.processJob(rawPosting);

    // 4. Mark is_synthetic = false explicitly and update location
    await db`
      UPDATE jobs.jobs
      SET is_synthetic = false,
          location = ${db.json({
            city: job.city,
            state: job.state,
            country: 'India',
            workplaceType: job.workplaceType,
          })}
      WHERE id = ${canonicalJob.canonicalJobId}
    `;

    // 5. Extract Requirements
    await reqService.processJobRequirements(canonicalJob.canonicalJobId, job.description);

    // 6. Match against Candidate
    if (candidate) {
      await matchService.matchJob(canonicalJob.canonicalJobId, candidate.id);
    }

    seededCount++;
  }

  return { seeded: seededCount };
}
