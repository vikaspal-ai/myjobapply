# Graph Report - /Users/apple/Desktop/myjobapply  (2026-09-27)

## Corpus Check
- 94 files · ~95,521 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 783 nodes · 1118 edges · 32 communities detected
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 92 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]

## God Nodes (most connected - your core abstractions)
1. `main()` - 25 edges
2. `emitOutboxEvent()` - 16 edges
3. `parseResume()` - 13 edges
4. `ApplicationWorkflowEngine` - 10 edges
5. `db` - 9 edges
6. `api()` - 8 edges
7. `EmailService` - 8 edges
8. `seedIndianTechJobs()` - 7 edges
9. `SchedulerService` - 7 edges
10. `CircuitBreaker` - 7 edges

## Surprising Connections (you probably didn't know these)
- `handleSignInSubmit()` --calls--> `login()`  [INFERRED]
  /Users/apple/Desktop/myjobapply/frontend/src/components/auth/AuthModal.tsx → /Users/apple/Desktop/myjobapply/frontend/src/context/AuthContext.tsx
- `signup()` --calls--> `api()`  [INFERRED]
  /Users/apple/Desktop/myjobapply/frontend/src/context/AuthContext.tsx → /Users/apple/Desktop/myjobapply/frontend/src/api/client.ts
- `logout()` --calls--> `api()`  [INFERRED]
  /Users/apple/Desktop/myjobapply/frontend/src/context/AuthContext.tsx → /Users/apple/Desktop/myjobapply/frontend/src/api/client.ts
- `handleAutoApply()` --calls--> `api()`  [INFERRED]
  /Users/apple/Desktop/myjobapply/frontend/src/components/workspace/JobsFeedStep.tsx → /Users/apple/Desktop/myjobapply/frontend/src/api/client.ts
- `handleAddSkill()` --calls--> `api()`  [INFERRED]
  /Users/apple/Desktop/myjobapply/frontend/src/components/workspace/ProfileStep.tsx → /Users/apple/Desktop/myjobapply/frontend/src/api/client.ts

## Communities

### Community 0 - "Community 0"

Cohesion: 0.05
Nodes (43): db, workflowEngine, config, [candidate], [clVersionRow], company, dedupEngine, discoveryService (+35 more)

### Community 1 - "Community 1"

Cohesion: 0.03
Nodes (57): { activeCandidateId }, [applications, setApplications], fetchApplications(), handleApprove(), handleReject(), [loading, setLoading], api(), API_BASE_URL (+49 more)

### Community 2 - "Community 2"

Cohesion: 0.07
Nodes (18): AnswerMemoryService, AutoFillService, ChaosEngine, db, db, OutboxConsumer, main(), db (+10 more)

### Community 3 - "Community 3"

Cohesion: 0.05
Nodes (39): contactExtractor, db, EXCLUDED_PREFIXES, PublicContactExtractor, SandboxEmailProvider, db, app, approved (+31 more)

### Community 4 - "Community 4"

Cohesion: 0.04
Nodes (47): app, applicationId, approveBody, approveRes, blockedBody, blockedRes, body, [candidate] (+39 more)

### Community 5 - "Community 5"

Cohesion: 0.05
Nodes (30): IngestionCrawler, company, crawler, discoveryService, [jobSource], outboxAfterRun1, outboxAfterRun2, outboxAfterRun3 (+22 more)

### Community 6 - "Community 6"

Cohesion: 0.06
Nodes (31): PdfCompiler, artifactId, [artifactRow], benign, [candidate], check1, check2, check3 (+23 more)

### Community 7 - "Community 7"

Cohesion: 0.06
Nodes (22): CircuitBreaker, db, DomainRateLimiter, RobotsPolitenessService, breaker, [company], compliance, db (+14 more)

### Community 8 - "Community 8"

Cohesion: 0.08
Nodes (23): db, db, db, ResumeFileParser, calculateAtsScore(), calculateTotalExperience(), cleanBulletText(), createEmptyParsedResume() (+15 more)

### Community 9 - "Community 9"

Cohesion: 0.07
Nodes (28): DeduplicationEngine, canonicalJobId, company, dedupEngine, discoveryService, links, norm, raw (+20 more)

### Community 10 - "Community 10"

Cohesion: 0.08
Nodes (28): [activeCandidateId, setActiveCandidateId], AuthContext, [authModalTab, setAuthModalTab], [candidateProfile, setCandidateProfile], clearSession(), closeAuthModal(), context, handleOAuthRedirect() (+20 more)

### Community 11 - "Community 11"

Cohesion: 0.07
Nodes (29): [candidate], [company], consumer, crawler, crawlResult, cycle1, cycle2, cycle3 (+21 more)

### Community 12 - "Community 12"

Cohesion: 0.08
Nodes (25): appAfterCaptcha, approvedApp, [approvedEvent], autoFillPayload, [candidate], captchaRun, [company], createTestJob() (+17 more)

### Community 13 - "Community 13"

Cohesion: 0.09
Nodes (22): artifact1, artifact2, [candidate], company, dedupEngine, discoveryService, [fact], [fact1] (+14 more)

### Community 14 - "Community 14"

Cohesion: 0.09
Nodes (21): [cand], [candidate], company, dedupEngine, discoveryService, emailField, [fact], fillResult (+13 more)

### Community 15 - "Community 15"

Cohesion: 0.14
Nodes (14): buildCompanyFixtureDeletePlan(), listTestFixtures(), purgeTestFixtures(), TEST_COMPANY_PREDICATE, main(), buildCandidateDeletePlan(), buildResidueDeletePlan(), candidateIds() (+6 more)

### Community 16 - "Community 16"

Cohesion: 0.09
Nodes (21): [candidate], company, criteriaRows, dedupEngine, discoveryService, [fact1], [fact2], facts (+13 more)

### Community 17 - "Community 17"

Cohesion: 0.11
Nodes (17): [answerRow], [appRow], [candidate], company, custom, dedupEngine, discoveryService, email (+9 more)

### Community 18 - "Community 18"

Cohesion: 0.12
Nodes (16): company, dedupEngine, discoveryService, extracted, failCandidate, job, jobDescription, locationFail (+8 more)

### Community 19 - "Community 19"

Cohesion: 0.13
Nodes (14): backedOff, claimed, [company], completed, db, [event], nextClaim, recoveredTask (+6 more)

### Community 20 - "Community 20"

Cohesion: 0.36
Nodes (2): ClaimCheckValidator, ResumePlanner

### Community 21 - "Community 21"

Cohesion: 0.22
Nodes (8): [candidate], [company], db, [job], result, testCandidateId, testCompanyId, testJobId

### Community 22 - "Community 22"

Cohesion: 0.25
Nodes (7): [activeTab, setActiveTab], candidateEmail, candidateLocations, candidateName, { candidateProfile }, candidateRole, sampleLatex

### Community 23 - "Community 23"

Cohesion: 0.29
Nodes (6): [activeStep, setActiveStep], firstName, isActive, isDone, steps, { user }

### Community 24 - "Community 24"

Cohesion: 0.4
Nodes (3): faqs, { openAuthModal }, [openFaq, setOpenFaq]

### Community 25 - "Community 25"

Cohesion: 0.67
Nodes (2): { isAuthenticated }, [isConsoleOpen, setIsConsoleOpen]

### Community 26 - "Community 26"

Cohesion: 1.0
Nodes (1): rootEl

### Community 27 - "Community 27"

Cohesion: 1.0
Nodes (1): { user, isAuthenticated, openAuthModal, logout }

### Community 28 - "Community 28"

Cohesion: 1.0
Nodes (0): 

### Community 29 - "Community 29"

Cohesion: 1.0
Nodes (0): 

### Community 30 - "Community 30"

Cohesion: 1.0
Nodes (0): 

### Community 31 - "Community 31"

Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **466 isolated node(s):** `{ isAuthenticated }`, `[isConsoleOpen, setIsConsoleOpen]`, `rootEl`, `STORAGE_KEY_TOKEN`, `STORAGE_KEY_USER` (+461 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 26`** (2 nodes): `rootEl`, `main.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (2 nodes): `{ user, isAuthenticated, openAuthModal, logout }`, `Navbar.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (1 nodes): `vitest.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (1 nodes): `vite.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (1 nodes): `Footer.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (1 nodes): `types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.