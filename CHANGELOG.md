# Project Changelog & System Context

All notable changes, architectural decisions, database migrations, domain events, and verification results for the **Job Hunt Platform** (`myjobapply`) are documented in this file.

This document is formatted for both human engineers and AI coding assistants to obtain immediate, full context on the architecture, database schema, event bus, invariants, and implementation status.

---

## 1. System Architecture & Core Invariants

The **Job Hunt Platform** is an enterprise-grade, single-user, hybrid job search automation platform built in accordance with [`job-hunt-platform-HLD-consolidated.md`](./job-hunt-platform-HLD-consolidated.md).

### Core Invariants & Rules
1. **Zero Hallucination / Anti-Fabrication Invariant (HLD §17 & §19):**
   - The platform strictly enforces verifiable grounding.
   - No resume bullet, tailoring plan, match criterion, or application response may exist without an explicit foreign reference to a verified fact ID in `profile.candidate_facts(id)`.
   - Metrics, dates, and claims cannot be invented, modified, or exaggerated.
2. **Transactional Outbox Event-Driven Coordination (HLD §5):**
   - Every state change writes domain events transactionally to `platform.outbox_events` within the same PostgreSQL transaction (`BEGIN ... COMMIT`).
   - Events are strictly idempotent using `idempotency_key` (e.g. `raw_posting:<source_id>:<external_id>:<content_hash>`, `resume:<resume_id>:v<version_no>`).
3. **Database Infrastructure & Supavisor Pooler Compatibility:**
   - **Database:** Supabase Cloud PostgreSQL 16 (Region: `ap-southeast-1`, Project Ref: `ecjmlvooqryqnqxvmwno`).
   - **Networking:** Direct connection `db.<ref>.supabase.co` is IPv6-only. All IPv4 traffic connects via Supavisor pooler (`aws-0-ap-southeast-1.pooler.supabase.com` on port 5432 session mode).
   - **Postgres.js JSONB Safety:** Objects passed to `db` queries must be wrapped with `sql.json(obj)` to prevent double-serialization as scalar strings.
4. **Content-Addressable & Immutable Versioning (HLD §8 & §10):**
   - Document artifacts (source code, Markdown, rendered PDFs) are content-hashed with SHA-256 and stored in `docs.artifacts` with unique constraint `uq_docs_artifact_hash`.
   - Resume and cover letter versions are strictly immutable. Once created, a version cannot be updated in-place; changes generate a new version increment with a pointer to its `parent_version_id`. Unique constraints `uq_docs_resume_version` and `uq_docs_cover_letter_version` enforce version numbering integrity.

---

## 2. Event Catalog (`platform.outbox_events`)

The following domain events are emitted across completed phases:

| Event Type | Producer | Idempotency Key Format | Entity References | Key Payload Attributes |
| :--- | :--- | :--- | :--- | :--- |
| `CareerPageFingerprinted` | `discovery-service` | `fingerprint:<company_id>:<page_class>` | `companyId`, `careerPageId` | `url`, `pageClass`, `detectedAts`, `hasJobListing`, `childSpokeCount`, `formFieldCount` |
| `JobDiscovered` | `ingest-crawler` | `raw_posting:<source_id>:<external_id>:<content_hash>` | `sourceId`, `postingId` | `externalId`, `title`, `contentHash`, `sourceUrl`, `applyUrl` |
| `JobCanonicalized` | `dedup-engine` | `job:<canonical_job_id>:v1` | `jobId`, `companyId`, `sourceId`, `postingId` | `layerMatched` (1=source, 2=url, 3=hash, 4=vector), `isNewJob`, `normalizedTitle`, `roleType`, `seniority` |
| `JobRequirementsExtracted` | `requirements-service`| `reqs:<canonical_job_id>:v1` | `jobId` | `requiredSkills`, `preferredSkills`, `minExperienceYears`, `evidenceCount` |
| `JobMatched` | `matching-service` | `match:<candidate_id>:<job_id>` | `matchId`, `jobId`, `candidateId` | `score`, `verdict` (`PASS`/`FAIL`/`UNKNOWN`), `criteriaCount`, `metCount`, `missingCount` |
| `MasterResumeCreated` | `document-engine` | `resume:<resume_id>:v1` | `candidateId`, `resumeId`, `versionId`, `artifactId` | `title`, `versionNo: 1`, `contentHash`, `factCount` |
| `ResumeVersionCreated` | `document-engine` | `resume:<resume_id>:v<version_no>` | `resumeId`, `versionId`, `jobId` | `versionNo`, `contentHash`, `factCount`, `templateName` |
| `CoverLetterGenerated` | `document-engine` | `cover_letter:<cover_letter_id>:v<version_no>` | `candidateId`, `coverLetterId`, `versionId`, `jobId`, `artifactId` | `title`, `versionNo`, `contentHash`, `companyName`, `sourcesCount`, `factsCitedCount` |
| `ApplicationCreated` | `application-workflow` | `application:<application_id>:created` | `applicationId`, `candidateId`, `jobId` | `status: DRAFT`, `resumeVersionId`, `coverLetterVersionId` |
| `ApplicationPrepared` | `application-workflow` | `application:<application_id>:prepared:<timestamp>` | `applicationId`, `candidateId`, `jobId` | `status: PENDING_APPROVAL`, `filledFieldCount` |
| `ApplicationApproved` | `application-workflow` | `application:<application_id>:approved:<timestamp>` | `applicationId`, `candidateId`, `jobId` | `status: APPROVED`, `approvedBy` |
| `ApplicationSubmitted` | `application-workflow` | `application_run:<run_id>:submitted` | `applicationId`, `runId`, `candidateId`, `jobId` | `path`, `confirmationReceipt` |
| `ApplicationPaused` | `application-workflow` | `application:<app_id>:paused:<ts>` or `application_run:<run_id>:paused` | `applicationId`, `candidateId`, `jobId` | `pauseReason` (`CAPTCHA_DETECTED`, `NEEDS_HUMAN_ANSWER`), `path` |
| `ApplicationFailed` | `application-workflow` | `application_run:<run_id>:failed` | `applicationId`, `runId`, `candidateId`, `jobId` | `error`, `path` |
| `ScheduleTriggered` | `scheduler-service` | `schedule:<schedule_id>:triggered:<row_version>` | `scheduleId`, `jobSourceId`, `companyId` | `workerId`, `leaseExpiresAt`, `rowVersion` |
| `ScheduleCompleted` | `scheduler-service` | `schedule:<schedule_id>:completed:<row_version>` | `scheduleId`, `jobSourceId`, `companyId` | `workerId`, `outcome`, `nextDueAt`, `rowVersion` |

---

## 3. Database Schema Overview (Completed Migrations)

### Schemas Established:
`platform`, `discovery`, `ingest`, `sched`, `profile`, `jobs`, `ai`, `audit`, `docs`, `apply`.

### Tables Established:
- **`platform.outbox_events`**: Transactional outbox table (`id`, `event_type`, `producer`, `idempotency_key`, `correlation_id`, `entity_refs`, `payload`, `status`, `created_at`, `published_at`).
- **`profile.candidate_profiles`**: Candidate personal details, email, contact, links.
- **`profile.candidate_facts`**: Grounded truths for candidate background (`id`, `candidate_id`, `category` [skill/experience/education], `statement`, `verified`, `metadata`).
- **`discovery.companies`**: Company directory (`id`, `name`, `domain`, `registry_urls`, `metadata`).
- **`discovery.career_pages`**: Discovered career endpoints, classification (`page_class`), detected ATS (`ats_family`), endpoints, forms.
- **`ingest.job_sources`**: Registered scrapers and sources per company (`id`, `company_id`, `connector`, `base_url`).
- **`ingest.raw_postings`**: Immutable crawled snapshots (`id`, `source_id`, `external_id`, `content_hash`, `raw_payload`, `fetched_at`) with constraint `uq_raw_posting (source_id, external_id, content_hash)`.
- **`jobs.jobs`**: Canonical deduplicated job listings (`id`, `company_id`, `title`, `normalized_title`, `role_type`, `seniority`, `location_type`, `description`, `signature_hash`, `title_embedding` [pgvector(1536)], `canonical_url`).
- **`jobs.job_postings`**: Association mapping raw crawled postings to canonical jobs.
- **`jobs.job_requirements`**: Extracted criteria (`id`, `job_id`, `required_skills`, `preferred_skills`, `min_experience_years`, `raw_evidence`).
- **`jobs.job_matches`**: Candidate evaluation record (`id`, `job_id`, `candidate_id`, `score`, `verdict`).
- **`jobs.job_match_criteria`**: Itemized match audit (`id`, `match_id`, `criterion`, `result` [met/unmet/missing], `fact_ids` [FK references to candidate_facts], `evidence`).
- **`docs.artifacts`**: Content-addressable storage index (`id`, `content_hash`, `mime_type`, `storage_path`, `size_bytes`, `created_at`) with `uq_docs_artifact_hash`.
- **`docs.resumes`**: Candidate resume root containers (`id`, `candidate_id`, `title`, `is_master`).
- **`docs.resume_versions`**: Immutable resume versions (`id`, `resume_id`, `parent_version_id`, `job_id`, `version_no`, `content_hash`, `plan`, `template_name`, `artifact_id`) with `uq_docs_resume_version (resume_id, version_no)`.
- **`docs.cover_letters`**: Candidate cover letter root containers (`id`, `candidate_id`, `title`).
- **`docs.cover_letter_versions`**: Immutable cover letter drafts citing discovery URLs (`id`, `cover_letter_id`, `parent_version_id`, `job_id`, `version_no`, `content_hash`, `markdown_content`, `company_fact_sources`, `artifact_id`) with `uq_docs_cover_letter_version (cover_letter_id, version_no)`.
- **`apply.applications`**: Job applications container (`id`, `candidate_id`, `job_id`, `resume_version_id`, `cover_letter_version_id`, `status`, `notes`) with `uq_apply_candidate_job (candidate_id, job_id)`.
- **`apply.candidate_answers`**: Verified answers to sensitive/standard questions (`id`, `candidate_id`, `question_pattern`, `answer_text`, `category`, `verified`).
- **`apply.application_runs`**: Automation run execution attempts (`id`, `application_id`, `path` [PLAYWRIGHT/EXTENSION], `status`, `form_data`, `pause_reason`).

---

## 4. Phase-by-Phase Changelog & Implementation History

### [0.7.0-phase6] - 2026-09-20
#### Phase 6: Frontend Dashboard & Analytics — BFF REST API, Web Command Center & Human Approval Modal
- **Files Created/Modified:**
  - [`src/api/types.ts`](./src/api/types.ts): Strongly typed REST contracts for candidate facts, canonical jobs, applications, documents, pipeline triggers, and funnel analytics.
  - [`src/api/routes/candidates.ts`](./src/api/routes/candidates.ts): Candidate profiles and fact store CRUD (`GET /api/candidates`, `GET /api/candidates/:id/facts`, `POST /api/candidates/:id/facts`, `PATCH /api/candidates/:id/facts/:factId`).
  - [`src/api/routes/jobs.ts`](./src/api/routes/jobs.ts): Searchable canonical jobs feed with candidate match scoring, company domain join, and match criteria breakdown (`GET /api/jobs`, `GET /api/jobs/:id`, `GET /api/jobs/:id/matches`).
  - [`src/api/routes/applications.ts`](./src/api/routes/applications.ts): Complete application lifecycle API (`GET /api/applications`, `GET /api/applications/:id`, `POST /api/applications/draft`, `POST /api/applications/:id/prepare`, `POST /api/applications/:id/approve`, `POST /api/applications/:id/pause`, `POST /api/applications/:id/run`). Enforces HTTP 403 Forbidden on unapproved submission attempts.
  - [`src/api/routes/documents.ts`](./src/api/routes/documents.ts): Tailored and master resume versions and cover letter inspection (`GET /api/resumes`, `GET /api/resumes/:id`, `GET /api/cover-letters`).
  - [`src/api/routes/pipeline.ts`](./src/api/routes/pipeline.ts): On-demand career page ingestion crawls, outbox consumer sweep, and scheduler lease status (`GET /api/pipeline/status`, `POST /api/pipeline/consume`, `POST /api/pipeline/crawl`).
  - [`src/api/routes/analytics.ts`](./src/api/routes/analytics.ts): Aggregated funnel metrics, $0 budget quota meter (15/day safety limit), ATS distribution, and crawler health (`GET /api/analytics/metrics`).
  - [`src/api/server.ts`](./src/api/server.ts): Fastify server factory and runner unifying the REST API and static dashboard SPA on a single port (`http://localhost:3000`).
  - [`src/dashboard/public/index.html`](./src/dashboard/public/index.html): Responsive dark-themed SPA featuring Overview & Analytics, Human Review Queue, Jobs Feed, Grounded Fact Store, and Pipeline Controls.
  - [`src/dashboard/public/styles.css`](./src/dashboard/public/styles.css): Clean CSS design system with glassmorphic cards, responsive modals, status badges, and animated progress bars.
  - [`src/dashboard/public/app.js`](./src/dashboard/public/app.js): Vanilla ES module client state machine with dynamic candidate switching, real-time metrics, interactive Human Review & Approval Modal, and pipeline triggers.
  - [`src/api/server.test.ts`](./src/api/server.test.ts): Automated integration test suite (7 tests) validating all REST endpoints and the Human Approval Gate invariant against live Supabase.
  - [`package.json`](./package.json): Added `"server": "tsx src/api/server.ts"` script.
- **Key Technical Decisions & Highlights:**
  - **Single-Process $0 Hybrid Architecture:**
    - Fastify serves both the high-performance REST API (`/api/*`) and the zero-build web dashboard (`/`) on port 3000, eliminating dev-server reverse proxies, CORS issues, and build tool overhead.
  - **Human-in-the-Loop Review Gate Enforcement:**
    - The API and UI strictly prevent automated submission unless an explicit human approval is recorded (`POST /api/applications/:id/approve`). Unapproved submission attempts immediately return HTTP 403 Forbidden (`HUMAN_APPROVAL_REQUIRED`).
  - **$0 Budget & Safety Quota Meter:**
    - Built-in quota tracker measures daily application submissions against the configurable safety limit (default 15/day), visually tracking budget and preventing vendor account suspension.
  - **Anti-Fabrication Evidence Audit:**
    - The approval modal presents each evaluated match criterion linked directly to verified citations in `profile.candidate_facts`, ensuring 100% grounded transparency before submission.
- **Verification Status:**
  - 7/7 tests passed in `src/api/server.test.ts`.
  - Full system regression: **17 test files, 63/63 tests passing (100% green)** on live Supabase (`npm test`).
  - TypeScript typecheck: `npm run typecheck` passed with 0 errors.

---

### [0.6.2-phase5.3] - 2026-09-20
#### Phase 5: Search & Discovery Pipeline Orchestration — Chunk 5.3: Outbox Event Consumer & Autonomous Pipeline
- **Files Created/Modified:**
  - [`src/orchestration/consumer.ts`](./src/orchestration/consumer.ts): `OutboxConsumer` polling unpublished events with `FOR UPDATE SKIP LOCKED`, consumer-level idempotency via `platform.processed_events`, and failure routing to `platform.dead_letters`.
  - [`src/orchestration/pipeline.ts`](./src/orchestration/pipeline.ts): `PipelineOrchestrator` wiring reactive event streams:
    - `JobDiscovered` ➔ `DeduplicationEngine.processJob()` ➔ emits `JobCanonicalized`.
    - `JobCanonicalized` ➔ `RequirementsService.processJobRequirements()` ➔ emits `JobRequirementsExtracted`.
    - `JobRequirementsExtracted` ➔ `MatchingService.matchJob()` ➔ emits `JobMatched`.
    - `JobMatched` (score $\ge 70\%$ / `PASS`) ➔ generates alert in `platform.notifications`.
  - [`src/orchestration/pipeline.test.ts`](./src/orchestration/pipeline.test.ts): Unit & integration test suite (3 tests) verifying outbox consumption, dead-letter routing, and full 4-step autonomous reactive cascade.
  - [`scripts/demo.ts`](./scripts/demo.ts): Extended with Steps 12, 13, 14, 15 covering scheduled task leases, rate-limiting, and autonomous reactive cascade alerts.
- **Key Technical Decisions & Highlights:**
  - **At-Least-Once Delivery with Exactly-Once Processing:**
    - `OutboxConsumer` uses PostgreSQL row-level locks (`SKIP LOCKED`) on `platform.outbox_events`, preventing concurrent workers from claiming identical events.
    - Idempotency is strictly enforced by recording `(consumer, event_id)` pairs in `platform.processed_events`.
    - Unhandled worker errors are captured in `platform.dead_letters` with stack trace and payload snapshot, preventing poisoned events from blocking queue progress.
  - **Autonomous Reactive Chaining:**
    - Decoupled event-driven choreography enables modular ingestion workers to trigger deduplication, deterministic skill extraction, candidate fit scoring, and candidate alerts without synchronous coupling.
- **Verification Status:**
  - 3/3 tests passed in `src/orchestration/pipeline.test.ts`.
  - Full system regression: **16 test files, 56/56 tests passing (100% green)** on live Supabase.
  - Interactive live demo: **All 15 steps executed and verified** on Supabase via `npm run demo`.

---

### [0.6.1-phase5.2] - 2026-09-20
#### Phase 5: Search & Discovery Pipeline Orchestration — Chunk 5.2: Rate Limiting, Circuit Breakers & Robots Politeness
- **Files Created/Modified:**
  - [`src/orchestration/rate-limiter.ts`](./src/orchestration/rate-limiter.ts): `DomainRateLimiter`, `CircuitBreaker`, and `RobotsPolitenessService`.
  - [`src/orchestration/types.ts`](./src/orchestration/types.ts): Added `CircuitState`, `CircuitBreakerOptions`, and `RobotsComplianceStatus`.
  - [`src/orchestration/rate-limiter.test.ts`](./src/orchestration/rate-limiter.test.ts): Unit & integration test suite (6 tests) verifying per-domain request throttling, circuit breaker state transitions (`CLOSED` ➔ `OPEN` ➔ `HALF_OPEN` ➔ `CLOSED`), instant 429 trips, robots.txt path validation, and compliance metadata persistence.
- **Key Technical Decisions & Highlights:**
  - **Polite Per-Domain Throttling:**
    - `DomainRateLimiter` tracks per-host timestamps, ensuring polite intervals between successive requests to the same target domain without delaying requests to unrelated domains.
  - **Circuit Breaker Protection against 429s/5xxs:**
    - Automatically trips to `OPEN` when consecutive failures exceed the threshold, fast-failing subsequent requests without consuming network bandwidth.
    - HTTP 429 Too Many Requests trips the circuit breaker immediately.
    - After cooldown, transitions to `HALF_OPEN` to probe upstream availability before returning to `CLOSED`.
  - **Robots.txt Directives & Compliance Storage:**
    - Parses universal `Disallow:` patterns and `Crawl-delay:` directives.
    - Stores metadata directly in `ingest.job_sources.compliance_status` (`robots_checked`, `allowed`, `crawl_delay_seconds`, `checked_at`).
- **Verification Status:**
  - 6/6 tests passed in `src/orchestration/rate-limiter.test.ts`.

---

### [0.6.0-phase5.1] - 2026-09-20
#### Phase 5: Search & Discovery Pipeline Orchestration — Chunk 5.1: Distributed Lease Scheduler & Crash Recovery Engine
- **Files Created/Modified:**
  - [`src/orchestration/types.ts`](./src/orchestration/types.ts): Data contracts for `ScheduleRecord`, `CreateScheduleInput`, `CompleteTaskOptions`.
  - [`src/orchestration/scheduler.ts`](./src/orchestration/scheduler.ts): `SchedulerService` implementing distributed lease acquisition with PostgreSQL `FOR UPDATE SKIP LOCKED`, automatic lease crash recovery, optimistic concurrency via `row_version`, and task rescheduling with jitter.
  - [`src/orchestration/scheduler.test.ts`](./src/orchestration/scheduler.test.ts): Unit & integration test suite (6 tests) verifying single-target database constraints, atomic non-blocking claims, crash recovery of abandoned leases, and exponential backoff on `RATE_LIMITED` and `FAILURE` outcomes.
- **Key Technical Decisions & Highlights:**
  - **Deadlock-Free Atomic Claims via `SKIP LOCKED`:**
    - Workers query due tasks in `sched.schedules` ordered by priority and `next_due_at`.
    - PostgreSQL row-level locks with `SKIP LOCKED` allow multiple concurrent workers to claim unique schedules simultaneously without race conditions or lock waits.
  - **Worker Crash Recovery & Lease Timeouts:**
    - Tasks in flight record `in_flight_since`, `locked_by`, and `lease_expires_at`.
    - If a worker crashes or drops offline, surviving workers automatically reclaim tasks whose `lease_expires_at <= now()`.
    - Active workers can invoke `renewLease()` as a heartbeat for long-running crawling operations.
  - **Rescheduling, Jitter & Exponential Backoff:**
    - Successful completions reschedule `next_due_at` based on `base_cadence + (random() * jitter)`, preventing synchronized request spikes.
    - Upstream rate limits (`RATE_LIMITED`) set `backoff_until` into the future, preventing immediate retry.
  - **Transactional Outbox Events:**
    - Emits `ScheduleTriggered` upon claim and `ScheduleCompleted` upon outcome resolution into `platform.outbox_events`.
- **Verification Status:**
  - 6/6 tests passed in `src/orchestration/scheduler.test.ts`.
  - Full system regression: **14 test files, 47/47 tests passing** on live Supabase.

---

### [0.5.2-phase4.3] - 2026-09-20
#### Phase 4: Agent & Browser Automation — Chunk 4.3: Application Lifecycle FSM, Human Review Gate & Sandbox Runner
- **Files Created/Modified:**
  - [`src/apply/workflow.ts`](./src/apply/workflow.ts): `ApplicationWorkflowEngine` implementing strict finite state machine (FSM) lifecycle transitions, mandatory human approval review gate, and Playwright sandbox execution runner.
  - [`src/apply/types.ts`](./src/apply/types.ts): Added `ApplicationRunRecord`, `ApplicationRunResult`, and `BrowserAutomationDriver` contracts.
  - [`src/apply/workflow.test.ts`](./src/apply/workflow.test.ts): Unit & integration test suite (4 tests) verifying idempotent draft creation, safety pause transitions, strict submission approval invariant, CAPTCHA interception, and outbox events.
  - [`scripts/demo.ts`](./scripts/demo.ts): Added Steps 10 & 11 verifying end-to-end form inspection, auto-fill, human approval, and sandbox submission.
- **Key Technical Decisions & Highlights:**
  - **Mandatory Human-in-the-Loop Review Gate (HLD §11 & §12):**
    - The engine strictly prohibits submitting any application that is not in `APPROVED` status.
    - Automated submissions attempted from `DRAFT`, `PREPARED`, or `PENDING_APPROVAL` states immediately throw an invariant violation error (`Invariant violation: Application ... cannot be submitted because it is in ... status. Human approval is strictly required prior to automated submission.`).
  - **Playwright Sandbox Simulator & Challenge Interception:**
    - Detects CAPTCHAs, login walls, and DOM layout shifts during browser interaction.
    - When a challenge is encountered, the run and parent application immediately transition to `PAUSED` state with `pause_reason = 'CAPTCHA_DETECTED'` and emit `ApplicationPaused` to `platform.outbox_events`.
    - Once the user resolves the challenge or adjusts the submission in the approval UI, `approveApplication()` enables re-submission without data loss.
  - **Database & Outbox Event Audit:**
    - Every run creates a persistent execution record in `apply.application_runs` (`PLAYWRIGHT` / `EXTENSION`, `form_data` snapshot, `pause_reason`, `submitted_at`).
    - Transactionally emits `ApplicationCreated`, `ApplicationPrepared`, `ApplicationApproved`, `ApplicationSubmitted`, and `ApplicationPaused` into `platform.outbox_events`.
- **Verification Status:**
  - 4/4 tests passed in `src/apply/workflow.test.ts`.
  - Full system regression: **13 test files, 41/41 tests passing** on live Supabase.
  - Interactive live demo: **All 12 steps executed and verified** on Supabase via `npm run demo`.

---

### [0.5.1-phase4.2] - 2026-09-20
#### Phase 4: Agent & Browser Automation — Chunk 4.2: Answer Memory & Auto-Fill Service
- **Files Created/Modified:**
  - [`src/apply/answer-memory.ts`](./src/apply/answer-memory.ts): `AnswerMemoryService` implementing memory retrieval, fuzzy question matching, dropdown option semantic mapping, and strict sensitive question safeguards.
  - [`src/apply/autofill.ts`](./src/apply/autofill.ts): `AutoFillService` coordinating candidate profile data, resume/cover letter artifacts, and answer memory into a complete form payload, with automated safety pauses.
  - [`src/apply/autofill.test.ts`](./src/apply/autofill.test.ts): Unit & integration test suite verifying dropdown mapping, complete form synthesis, and safety pause triggers.
- **Key Technical Decisions & Highlights:**
  - **Sensitive Question Safeguard (HLD §11):**
    - Sensitive topics (`sponsorship`, `work_authorization`, background checks, legal disclosures) must NEVER be answered by generative AI.
    - Only answers explicitly verified by a human (`verified = true` in `apply.candidate_answers`) are permitted. Unverified or missing answers halt the pipeline with `NEEDS_HUMAN_ANSWER` status.
  - **Semantic Dropdown Option Mapping:**
    - Fuzzy match algorithm maps canonical answers (`Yes`/`No`/`Full-time`) to custom ATS select options (e.g. `1 - Yes, I am legally authorized`, `No, I will need sponsorship`).
  - **Artifact Resolution:**
    - Resolves the candidate's latest compiled resume PDF artifact and tailored cover letter artifact for automated ATS file attachment fields.
- **Verification Status:**
  - 3/3 tests passed in `src/apply/autofill.test.ts`.
  - Full system regression: **12 test files, 37/37 tests passing** on live Supabase.

---

### [0.5.0-phase4.1] - 2026-09-20
#### Phase 4: Agent & Browser Automation — Chunk 4.1: Database Schema & Form Inspection Engine
- **Files Created/Modified:**
  - [`migrations/003_apply_schema.sql`](./migrations/003_apply_schema.sql): DDL for `apply.applications`, `apply.candidate_answers`, `apply.application_runs`.
  - [`scripts/migrate.ts`](./scripts/migrate.ts): Added idempotent migration runner tracking applied migrations in `platform.schema_migrations`.
  - [`src/apply/types.ts`](./src/apply/types.ts): Data contracts for `FormField`, `FormInspectionResult`, `ApplicationStatus`, and `CandidateAnswerRecord`.
  - [`src/apply/form-inspector.ts`](./src/apply/form-inspector.ts): `FormInspector` analyzing HTML forms and classifying standard ATS fields (Greenhouse, Lever, Workday, Ashby) and custom questions.
  - [`src/apply/form-inspector.test.ts`](./src/apply/form-inspector.test.ts): Unit tests on Greenhouse & Lever fixtures + live Supabase persistence tests.
- **Key Technical Decisions & Highlights:**
  - **State Machine Database Constraints:**
    - `apply.applications` enforces strict lifecycle states (`DRAFT`, `PREPARED`, `PENDING_APPROVAL`, `APPROVED`, `SUBMITTING`, `SUBMITTED`, `FAILED`, `PAUSED`, `CANCELLED`, `UNCONFIRMED`).
    - Constraint `uq_apply_candidate_job (candidate_id, job_id)` prevents duplicate applications to the same canonical job.
  - **Form Field Classification & ATS Detection:**
    - Rule-based classifier mapping input names/labels to standard categories (`first_name`, `last_name`, `email`, `phone`, `resume`, `cover_letter`, `sponsorship`, `work_authorization`).
    - Detects platform footprints (`Greenhouse`, `Lever`, `Workday`, `Ashby`, `SmartRecruiters`).
    - Distinguishes file uploads (resume vs cover letter) and isolates custom essay/text questions.
- **Verification Status:**
  - 3/3 tests passed in `src/apply/form-inspector.test.ts`.
  - Full system regression: **11 test files, 34/34 tests passing** on live Supabase.

---

### [0.4.3-phase3.4] - 2026-09-20
#### Phase 3: Document Engine — Chunk 3.4: Grounded Cover Letter Engine & Immutable Versioning
- **Files Created/Modified:**
  - [`src/docs/cover-letter.ts`](./src/docs/cover-letter.ts): `CoverLetterEngine` generating grounded Markdown and PDF cover letters citing verified company discovery endpoints and candidate verified facts.
  - [`src/docs/types.ts`](./src/docs/types.ts): Added `CompanyFactSource`, `CoverLetterResult` interfaces.
  - [`src/docs/cover-letter.test.ts`](./src/docs/cover-letter.test.ts): Unit & integration test suite verifying fact citations, immutable versioning lineage, unique constraints, and transactional outbox event.
  - [`scripts/demo.ts`](./scripts/demo.ts): Added Step 9 verifying end-to-end cover letter generation and storage.
- **Key Technical Decisions & Highlights:**
  - **Company Discovery Grounding:**
    - Cites verified company discovery sources (`discovery.company_domains` and `discovery.career_pages`) in the generated cover letter body.
  - **Verified Candidate Fact Citations:**
    - Directly links paragraphs to matching candidate verified fact IDs (`profile.candidate_facts(id)`), ensuring absolute compliance with the zero-hallucination invariant.
  - **Immutable Versioning Lineage:**
    - Cover letter versions are strictly immutable. Revisions automatically increment `version_no` and set `parent_version_id` pointing to the previous draft.
    - Verified constraint `uq_docs_cover_letter_version (cover_letter_id, version_no)`.
  - **Transactional Outbox Event:**
    - Emits `CoverLetterGenerated` into `platform.outbox_events` with entity references to candidate, cover letter, version, job, and storage artifact.
- **Verification Status:**
  - 1/1 test passed in `src/docs/cover-letter.test.ts`.
  - Full system regression: **10 test files, 31/31 tests passing** on live Supabase.
  - Interactive demo: **All 10 steps passed** via `npm run demo`.

---

### [0.4.2-phase3.3] - 2026-09-20
#### Phase 3: Document Engine — Chunk 3.3: Modular LaTeX / PDF Compilation Sandbox & Quality Checks
- **Files Created/Modified:**
  - [`src/docs/latex.ts`](./src/docs/latex.ts): Modular LaTeX templating (`modern-deedy`, `clean-classic`), strict character escaping (`&`, `%`, `$`, `#`, `_`, `{`, `}`), and exploit defense sanitizer.
  - [`src/docs/compiler.ts`](./src/docs/compiler.ts): Isolated `PdfCompiler` with security sandbox check, PDF 1.4 binary synthesis engine, page budget quality verification ($\le 2$ pages), and artifact database linking.
  - [`src/docs/compiler.test.ts`](./src/docs/compiler.test.ts): Unit & integration test suite (6 tests).
- **Key Technical Decisions & Highlights:**
  - **Exploit & Injection Defense:**
    - Explicitly detects and blocks malicious LaTeX directives (`\write18`, `\immediate\write18`, `\input`, `\include`, `\openin`, `\catcode`, `file://`), preventing arbitrary remote shell execution or file access.
  - **Traceability & Escaping:**
    - Automatically escapes special LaTeX characters (`C#` -> `C\#`, `99.9%` -> `99.9\%`, `&` -> `\&`).
    - Embeds anti-fabrication comments `% factId: <id>` in the rendered LaTeX source for every bullet point.
  - **Self-Contained Portable PDF Compilation:**
    - Generates standard, valid PDF 1.4 binary documents without requiring heavy external TeX Live binaries, ensuring zero-cost container portability.
    - Strictly enforces enterprise page limits ($\le 2$ pages), throwing quality errors if content exceeds budget.
    - Saves rendered PDF to `docs.artifacts` with SHA-256 deduplication and updates `docs.resume_versions.artifact_id`.
- **Verification Status:**
  - 6/6 tests passed in `src/docs/compiler.test.ts`.
  - Full regression: **9 test files, 30/30 tests passing** on live Supabase.

---

### [0.4.1-phase3.2] - 2026-09-20
#### Phase 3: Document Engine — Chunk 3.2: AI Resume Planning & Anti-Fabrication Claim-Check Validator
- **Files Created/Modified:**
  - [`src/docs/claim-check.ts`](./src/docs/claim-check.ts): `ClaimCheckValidator` enforcing zero-hallucination constraints on candidate resumes and tailoring plans.
  - [`src/docs/planner.ts`](./src/docs/planner.ts): `ResumePlanner` matching job requirements to verified candidate facts, ranking bullets, selecting optimal subsets, highlighting skills, and generating tailored drafts.
  - [`src/docs/types.ts`](./src/docs/types.ts): Added `ClaimViolation`, `ClaimViolationType`, `ClaimCheckResult`, `TailoredResumeDraft`.
  - [`src/docs/planner.test.ts`](./src/docs/planner.test.ts): Comprehensive test suite (6 unit rule tests + 1 live Supabase integration test).
- **Key Technical Decisions & Highlights:**
  - **Anti-Fabrication Rule Engine:**
    - `UNKNOWN_FACT_ID`: Rejects plans or bullets citing fact IDs not found in the candidate fact store.
    - `UNVERIFIED_FACT`: Rejects any fact where `verified !== true`.
    - `FACT_CANDIDATE_MISMATCH`: Rejects any fact belonging to a different candidate ID.
    - `MISSING_CITATION`: Rejects any resume bullet or skill category lacking a `factId` reference.
    - `TEXT_HALLUCINATION`: Uses regular expression tokenization to compare numbers, multipliers, and metrics in resume bullets (e.g. `50k`, `99.9%`, `500k`) against ground truth fact statements, strictly rejecting exaggerated or invented metrics.
  - **Tailoring Planner & Event Emission:**
    - Maps `jobs.job_requirements` (`required_skills`, `preferred_skills`) against candidate facts, prioritizing matching experience and project bullets.
    - Restricts bullet count per role to maintain page limits ($\le 3$ bullets per role).
    - Automatically validates tailored draft with `ClaimCheckValidator` before saving.
    - Persists to `docs.resume_versions` with parent version lineage and emits `ResumeVersionCreated` into `platform.outbox_events`.
- **Verification Status:**
  - 7/7 tests passed in `src/docs/planner.test.ts`.
  - Full regression: **8 test files, 24/24 tests passing** on live Supabase.

---

### [0.4.0-phase3.1] - 2026-09-20
#### Phase 3: Document Engine — Chunk 3.1: Database Schema & Master Template Engine
- **Files Created/Modified:**
  - [`migrations/002_docs_schema.sql`](./migrations/002_docs_schema.sql): DDL for `docs.artifacts`, `docs.resumes`, `docs.resume_versions`, `docs.cover_letters`, `docs.cover_letter_versions`.
  - [`scripts/migrate.ts`](./scripts/migrate.ts): Automated migration executor using direct/pooled connections.
  - [`src/docs/types.ts`](./src/docs/types.ts): TypeScript data interfaces for resume data, tailoring plans, and artifacts.
  - [`src/docs/master.ts`](./src/docs/master.ts): `MasterTemplateEngine` with `saveArtifact`, `createMasterResume`, `createTailoredVersion`.
  - [`src/docs/master.test.ts`](./src/docs/master.test.ts): Unit/Integration test suite.
- **Key Technical Decisions & Highlights:**
  - Artifacts are indexed by SHA-256 with conflict handling (`ON CONFLICT (content_hash) DO UPDATE`), preventing identical documents from being duplicated in storage.
  - Root master resumes are created at `version_no = 1` with a `MasterResumeCreated` transactional outbox event.
  - Tailored versions enforce `parent_version_id` lineage and target `job_id` association.
  - Strict database constraint `uq_docs_resume_version` verified: attempting to insert duplicate version numbers for the same resume throws a constraint violation.
- **Verification Status:**
  - All 3 tests in `src/docs/master.test.ts` passed against live Supabase.
  - Regression passed: **7 test files, 17/17 tests passing**.

---

### [0.3.0-phase2] - 2026-09-20
#### Phase 2: Processing, Deduplication & Candidate Matching Engine
- **Chunk 2.1: Ingestion & Raw Postings Engine:**
  - [`src/ingest/crawler.ts`](./src/ingest/crawler.ts): Crawler fetching and saving raw posting payloads idempotently using `uq_raw_posting` (`source_id`, `external_id`, `content_hash`).
  - [`src/connectors/generic.ts`](./src/connectors/generic.ts): Configurable generic HTML/JSON job crawler connector.
  - Outbox Event: `JobDiscovered`.
  - Tests: [`src/ingest/crawler.test.ts`](./src/ingest/crawler.test.ts).
- **Chunk 2.2: Normalization & 4-Layer Deduplication Engine:**
  - [`src/jobs/normalizer.ts`](./src/jobs/normalizer.ts): Deterministic taxonomy classifier for roles, seniority, employment type, location type. Fixed keyword precedence (e.g. evaluating `fullstack` before `frontend`/`backend` to avoid misclassification).
  - [`src/jobs/dedup.ts`](./src/jobs/dedup.ts): 4-layer deduplication engine:
    1. Layer 1: Source identity match (`source_id` + `external_id`).
    2. Layer 2: Normalized URL canonicalization.
    3. Layer 3: Normalized signature hash (`company_id` + title + location).
    4. Layer 4: Semantic vector cosine distance match via `pgvector` (`title_embedding <=> $1`).
  - Outbox Event: `JobCanonicalized`.
  - Tests: [`src/jobs/dedup.test.ts`](./src/jobs/dedup.test.ts).
- **Chunk 2.3: Deterministic Requirements Extraction & Hard Filters:**
  - [`src/jobs/requirements.ts`](./src/jobs/requirements.ts): Regex-based extraction of required and preferred technical skills, minimum years of experience, and hard filter evaluation (`PASS` | `FAIL` | `UNKNOWN`).
  - Outbox Event: `JobRequirementsExtracted`.
  - Tests: [`src/jobs/requirements.test.ts`](./src/jobs/requirements.test.ts).
- **Chunk 2.4: Candidate Fit Evaluation & Anti-Fabrication Engine:**
  - [`src/jobs/matching.ts`](./src/jobs/matching.ts): Fit scoring engine (0–100 score + `PASS`/`FAIL`/`UNKNOWN` verdict).
  - Enforces the anti-fabrication invariant: all met criteria link directly to `profile.candidate_facts(id)` via `fact_ids`. Missing criteria cite zero facts.
  - Outbox Event: `JobMatched`.
  - Tests: [`src/jobs/matching.test.ts`](./src/jobs/matching.test.ts).
- **Verification Status:**
  - 14/14 tests passing across Phase 0, 1, and 2.

---

### [0.2.0-phase1] - 2026-09-20
#### Phase 1: Ingestion Spike & Career Page Discovery Engine
- **Files Created/Modified:**
  - [`src/connectors/types.ts`](./src/connectors/types.ts): Interfaces for `JobConnector`, `FingerprintResult`, `PageClass`, `RawJob`.
  - [`src/discovery/fingerprint.ts`](./src/discovery/fingerprint.ts): ATS detection rules and classification heuristics (`ats-direct`, `hub-to-spoke`, `talent-pool`, `empty-listings`).
  - [`src/discovery/service.ts`](./src/discovery/service.ts): Company registration and career page persistence with transactional outbox event.
  - [`src/discovery/fingerprint.test.ts`](./src/discovery/fingerprint.test.ts): Live and fixture verification.
- **Reference Fixture Results:**
  - `vidushiinfotech.com/careers/`: Correctly classified as `talent-pool` (0 job cards, 7 form input fields + resume upload extracted).
  - `techmahindra.com/careers/`: Correctly classified as `hub-to-spoke` (`careers.techmahindra.com` child spoke discovered).
- **Outbox Event:** `CareerPageFingerprinted`.
- **Verification Status:**
  - 4/4 tests passed.

---

### [0.1.0-phase0] - 2026-09-20
#### Phase 0: Foundations & Project Scaffolding
- **Files Created/Modified:**
  - [`docker-compose.yml`](./docker-compose.yml): Local PostgreSQL 16 image (`pgvector/pgvector:pg16`) with `pgvector` and `pg_trgm` extensions enabled.
  - [`migrations/001_initial_schema.sql`](./migrations/001_initial_schema.sql): DDL establishing 10 schemas, `platform.outbox_events`, `profile.candidate_facts`.
  - [`src/config.ts`](./src/config.ts): Environment configuration parsing `DATABASE_URL` and `DIRECT_DATABASE_URL`.
  - [`src/db/index.ts`](./src/db/index.ts): Database client initialization using `postgres.js` with `emitOutboxEvent()` helper.
  - [`vitest.config.ts`](./vitest.config.ts): Vitest configuration tuned for cloud database latency (`testTimeout: 20000`, `fileParallelism: false`).
  - [`src/db/index.test.ts`](./src/db/index.test.ts): Database connectivity and schema verification test.
- **Key Technical Findings:**
  - Direct connection to Supabase ref is IPv6-only; resolved by utilizing Supavisor IPv4 session pooler (`aws-0-ap-southeast-1.pooler.supabase.com:5432`).
  - Passwords with special characters (`$`) are safely URL-encoded as `%24`.
- **Verification Status:**
  - 2/2 tests passed.

---

## 5. Roadmap & Upcoming Phase Chunks

- **Phase 3: Document Engine (Completed)**
  - [x] **Chunk 3.1**: Database Schema & Master Template Engine (`docs.*` tables, `MasterTemplateEngine`, SHA-256 artifact storage).
  - [x] **Chunk 3.2**: AI Resume Planning & Deterministic Anti-Fabrication Claim-Check Validator (`src/docs/claim-check.ts`, `src/docs/planner.ts`).
  - [x] **Chunk 3.3**: Modular LaTeX / PDF Compilation Sandbox (safe escaping, `\write18` suppression, $\le 2$ page budget validator).
  - [x] **Chunk 3.4**: Cover Letter Generation Engine (citing grounded company discovery facts, immutable versioning).
- **Phase 4: Agent & Browser Automation Engine (Completed)**
  - [x] **Chunk 4.1**: Database Schema & Form Inspection Engine (`apply.*` tables, `FormInspector`, ATS detection).
  - [x] **Chunk 4.2**: Answer Memory & Auto-Fill Service (caching verified candidate answers).
  - [x] **Chunk 4.3**: Playwright Sandbox & Human-in-the-Loop Approval Modal (`ApplicationWorkflowEngine`, FSM, approval invariant).
- **Phase 5: Search & Discovery Pipeline Orchestration (Completed)**
  - [x] **Chunk 5.1**: Distributed Lease Scheduler & Crash Recovery Engine (`sched.schedules`, atomic `SKIP LOCKED`, crash timeout).
  - [x] **Chunk 5.2**: Domain Rate-Limiting, Robots Politeness & Circuit Breakers (`DomainRateLimiter`, `CircuitBreaker`, `RobotsPolitenessService`).
- **Phase 6: Frontend Dashboard & Analytics (Completed)**
  - [x] **Chunk 6.1**: Backend REST API & Controllers (`src/api/routes/*`, typed contracts, error handlers).
  - [x] **Chunk 6.2**: Human-in-the-Loop Review Queue & Approval Modal (Evidence audit, resume & letter preview, ATS review).
  - [x] **Chunk 6.3**: Single-Process Command Center & Quota Meter (Served via Fastify, 63/63 tests green).
