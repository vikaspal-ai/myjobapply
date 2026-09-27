# main()

> God node · 25 connections · [/Users/apple/Desktop/myjobapply/scripts/demo.ts](file:///Users/apple/Desktop/myjobapply/scripts/demo.ts#L18)

## Call Trace Diagram

```mermaid
sequenceDiagram
    participant P0 as main()
    participant P1 as .completeTask()
    participant P2 as emitOutboxEvent()
    participant P3 as db
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
    participant P17 as db
    participant P18 as .mapScheduleRow()
    participant P19 as .getSchedule()
    participant P20 as .runWorkerCrashRecoveryDrill()
    participant P21 as .planTailoredResume()
    participant P22 as .updateJobSourceCompliance()
    participant P23 as .processJob()
    participant P24 as .processJobRequirements()
    participant P25 as .matchJob()
    participant P26 as .execute()
    participant P27 as .registerCompany()
    participant P28 as .crawlSource()
    participant P29 as .createMasterResume()
    participant P30 as .generateCoverLetter()
    participant P31 as .createSchedule()
    participant P32 as .processCareerPage()
    participant P33 as .fillForm()
    participant P34 as .getState()
    participant P35 as .processPendingEvents()
    participant P36 as .saveAnswer()
    participant P37 as .inspectForm()
    participant P38 as .acquire()
    P0->>+ P1: calls
    P1-->>- P0: return
    P1->>+ P0: calls
    P0-->>- P1: return
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
    P0->>+ P4: calls
    P4-->>- P0: return
    P0->>+ P5: calls
    P5-->>- P0: return
    P0->>+ P6: calls
    P6-->>- P0: return
    P0->>+ P22: calls
    P22-->>- P0: return
    P0->>+ P23: calls
    P23-->>- P0: return
    P0->>+ P24: calls
    P24-->>- P0: return
    P0->>+ P25: calls
    P25-->>- P0: return
    P0->>+ P8: calls
    P8-->>- P0: return
    P0->>+ P11: calls
    P11-->>- P0: return
    P0->>+ P26: calls
    P26-->>- P0: return
    P0->>+ P27: calls
    P27-->>- P0: return
    P0->>+ P28: calls
    P28-->>- P0: return
    P0->>+ P29: calls
    P29-->>- P0: return
    P0->>+ P30: calls
    P30-->>- P0: return
    P0->>+ P31: calls
    P31-->>- P0: return
    P0->>+ P32: calls
    P32-->>- P0: return
    P0->>+ P33: calls
    P33-->>- P0: return
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
- [[.planTailoredResume()]] `INFERRED`
- [[.prepareApplication()]] `INFERRED`
- [[.approveApplication()]] `INFERRED`
- [[.claimDueTask()]] `INFERRED`
- [[.updateJobSourceCompliance()]] `INFERRED`
- [[.processJob()]] `INFERRED`
- [[.processJobRequirements()]] `INFERRED`
- [[.matchJob()]] `INFERRED`
- [[.createDraft()]] `INFERRED`
- [[.executeApplicationRun()]] `INFERRED`
- [[.execute()]] `INFERRED`
- [[.registerCompany()]] `INFERRED`
- [[.crawlSource()]] `INFERRED`
- [[.createMasterResume()]] `INFERRED`
- [[.generateCoverLetter()]] `INFERRED`
- [[.createSchedule()]] `INFERRED`
- [[.processCareerPage()]] `INFERRED`
- [[.fillForm()]] `INFERRED`
- [[.getState()]] `INFERRED`

### contains
- [[demo.ts]] `EXTRACTED`

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*