# emitOutboxEvent()

> God node · 16 connections · [/Users/apple/Desktop/myjobapply/src/db/index.ts](file:///Users/apple/Desktop/myjobapply/src/db/index.ts#L35)

## Call Trace Diagram

```mermaid
sequenceDiagram
    participant P0 as emitOutboxEvent()
    participant P1 as .completeTask()
    participant P2 as main()
    participant P3 as .planTailoredResume()
    participant P4 as .prepareApplication()
    participant P5 as .approveApplication()
    participant P6 as .claimDueTask()
    participant P7 as .updateJobSourceCompliance()
    participant P8 as .processJob()
    participant P9 as .processJobRequirements()
    participant P10 as .matchJob()
    participant P11 as .createDraft()
    participant P12 as .executeApplicationRun()
    participant P13 as .execute()
    participant P14 as .registerCompany()
    participant P15 as .crawlSource()
    participant P16 as .createMasterResume()
    participant P17 as .generateCoverLetter()
    participant P18 as .createSchedule()
    participant P19 as .processCareerPage()
    participant P20 as .fillForm()
    participant P21 as .getState()
    participant P22 as .processPendingEvents()
    participant P23 as .saveAnswer()
    participant P24 as .inspectForm()
    participant P25 as .acquire()
    participant P26 as db
    participant P27 as .mapScheduleRow()
    participant P28 as .getSchedule()
    participant P29 as .runWorkerCrashRecoveryDrill()
    participant P30 as db
    participant P31 as .sendOutreach()
    participant P32 as .pauseApplication()
    participant P33 as .cancelApplication()
    participant P34 as .runPoisonPillIsolationDrill()
    participant P35 as .draftOutreach()
    participant P36 as .recordBounce()
    participant P37 as .approveOutreach()
    participant P38 as .recordReply()
    P0->>+ P1: calls
    P1-->>- P0: return
    P1->>+ P2: calls
    P2-->>- P1: return
    P2->>+ P1: calls
    P1-->>- P2: return
    P2->>+ P3: calls
    P3-->>- P2: return
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
    P2->>+ P17: calls
    P17-->>- P2: return
    P2->>+ P18: calls
    P18-->>- P2: return
    P2->>+ P19: calls
    P19-->>- P2: return
    P2->>+ P20: calls
    P20-->>- P2: return
    P2->>+ P21: calls
    P21-->>- P2: return
    P2->>+ P22: calls
    P22-->>- P2: return
    P2->>+ P23: calls
    P23-->>- P2: return
    P2->>+ P24: calls
    P24-->>- P2: return
    P2->>+ P25: calls
    P25-->>- P2: return
    P1->>+ P0: calls
    P0-->>- P1: return
    P1->>+ P26: calls
    P26-->>- P1: return
    P1->>+ P27: calls
    P27-->>- P1: return
    P1->>+ P28: calls
    P28-->>- P1: return
    P1->>+ P29: calls
    P29-->>- P1: return
    P0->>+ P30: calls
    P30-->>- P0: return
    P0->>+ P4: calls
    P4-->>- P0: return
    P0->>+ P5: calls
    P5-->>- P0: return
    P0->>+ P6: calls
    P6-->>- P0: return
    P0->>+ P31: calls
    P31-->>- P0: return
    P0->>+ P11: calls
    P11-->>- P0: return
    P0->>+ P32: calls
    P32-->>- P0: return
    P0->>+ P33: calls
    P33-->>- P0: return
    P0->>+ P12: calls
    P12-->>- P0: return
    P0->>+ P34: calls
    P34-->>- P0: return
    P0->>+ P35: calls
    P35-->>- P0: return
    P0->>+ P36: calls
    P36-->>- P0: return
    P0->>+ P37: calls
    P37-->>- P0: return
    P0->>+ P38: calls
    P38-->>- P0: return
```

## Connections by Relation

### calls
- [[.completeTask()]] `INFERRED`
- [[db]] `INFERRED`
- [[.prepareApplication()]] `INFERRED`
- [[.approveApplication()]] `INFERRED`
- [[.claimDueTask()]] `INFERRED`
- [[.sendOutreach()]] `INFERRED`
- [[.createDraft()]] `INFERRED`
- [[.pauseApplication()]] `INFERRED`
- [[.cancelApplication()]] `INFERRED`
- [[.executeApplicationRun()]] `INFERRED`
- [[.runPoisonPillIsolationDrill()]] `INFERRED`
- [[.draftOutreach()]] `INFERRED`
- [[.recordBounce()]] `INFERRED`
- [[.approveOutreach()]] `INFERRED`
- [[.recordReply()]] `INFERRED`

### contains
- [[index.ts]] `EXTRACTED`

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*