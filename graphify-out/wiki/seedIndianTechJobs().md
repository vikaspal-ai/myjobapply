# seedIndianTechJobs()

> God node · 7 connections · [/Users/apple/Desktop/myjobapply/src/connectors/india-tech-seed.ts](file:///Users/apple/Desktop/myjobapply/src/connectors/india-tech-seed.ts#L155)

## Call Trace Diagram

```mermaid
sequenceDiagram
    participant P0 as seedIndianTechJobs()
    participant P1 as db
    participant P2 as emitOutboxEvent()
    participant P3 as .completeTask()
    participant P4 as .prepareApplication()
    participant P5 as .approveApplication()
    participant P6 as .claimDueTask()
    participant P7 as .sendOutreach()
    participant P8 as .createDraft()
    participant P9 as .pauseApplication()
    participant P10 as .cancelApplication()
    participant P11 as .executeApplicationRun()
    participant P12 as .runPoisonPillIsolationDrill()
    participant P13 as .draftOutreach()
    participant P14 as .recordBounce()
    participant P15 as .approveOutreach()
    participant P16 as .recordReply()
    participant P17 as main()
    participant P18 as .checkOutreachEligibility()
    participant P19 as .isSuppressed()
    participant P20 as .addSuppression()
    participant P21 as .processJob()
    participant P22 as .processJobRequirements()
    participant P23 as .matchJob()
    participant P24 as main()
    participant P25 as .registerCompany()
    P0->>+ P1: calls
    P1-->>- P0: return
    P1->>+ P2: calls
    P2-->>- P1: return
    P2->>+ P3: calls
    P3-->>- P2: return
    P2->>+ P1: calls
    P1-->>- P2: return
    P2->>+ P4: calls
    P4-->>- P2: return
    P2->>+ P5: calls
    P5-->>- P2: return
    P2->>+ P6: calls
    P6-->>- P2: return
    P2->>+ P7: calls
    P7-->>- P2: return
    P2->>+ P8: calls
    P8-->>- P2: return
    P2->>+ P9: calls
    P9-->>- P2: return
    P2->>+ P10: calls
    P10-->>- P2: return
    P2->>+ P11: calls
    P11-->>- P2: return
    P2->>+ P12: calls
    P12-->>- P2: return
    P2->>+ P13: calls
    P13-->>- P2: return
    P2->>+ P14: calls
    P14-->>- P2: return
    P2->>+ P15: calls
    P15-->>- P2: return
    P2->>+ P16: calls
    P16-->>- P2: return
    P1->>+ P0: calls
    P0-->>- P1: return
    P1->>+ P17: calls
    P17-->>- P1: return
    P1->>+ P18: calls
    P18-->>- P1: return
    P1->>+ P19: calls
    P19-->>- P1: return
    P1->>+ P20: calls
    P20-->>- P1: return
    P0->>+ P21: calls
    P21-->>- P0: return
    P0->>+ P22: calls
    P22-->>- P0: return
    P0->>+ P23: calls
    P23-->>- P0: return
    P0->>+ P24: calls
    P24-->>- P0: return
    P0->>+ P25: calls
    P25-->>- P0: return
```

## Connections by Relation

### calls
- [[db]] `INFERRED`
- [[.processJob()]] `INFERRED`
- [[.processJobRequirements()]] `INFERRED`
- [[.matchJob()]] `INFERRED`
- [[main()]] `INFERRED`
- [[.registerCompany()]] `INFERRED`

### contains
- [[india-tech-seed.ts]] `EXTRACTED`

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*