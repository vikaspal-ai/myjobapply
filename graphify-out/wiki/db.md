# db

> God node · 9 connections · [/Users/apple/Desktop/myjobapply/src/apply/workflow.ts](file:///Users/apple/Desktop/myjobapply/src/apply/workflow.ts#L12)

## Call Trace Diagram

```mermaid
sequenceDiagram
    participant P0 as db
    participant P1 as .getApplication()
    participant P2 as .mapApplicationRow()
    participant P3 as .prepareApplication()
    participant P4 as .approveApplication()
    participant P5 as .createDraft()
    participant P6 as .pauseApplication()
    participant P7 as .cancelApplication()
    participant P8 as main()
    participant P9 as emitOutboxEvent()
    participant P10 as .executeApplicationRun()
    participant P11 as .getApplicationRuns()
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
    P1->>+ P3: calls
    P3-->>- P1: return
    P3->>+ P8: calls
    P8-->>- P3: return
    P3->>+ P9: calls
    P9-->>- P3: return
    P3->>+ P0: calls
    P0-->>- P3: return
    P3->>+ P1: calls
    P1-->>- P3: return
    P3->>+ P2: calls
    P2-->>- P3: return
    P1->>+ P4: calls
    P4-->>- P1: return
    P1->>+ P6: calls
    P6-->>- P1: return
    P1->>+ P7: calls
    P7-->>- P1: return
    P1->>+ P10: calls
    P10-->>- P1: return
    P0->>+ P3: calls
    P3-->>- P0: return
    P0->>+ P4: calls
    P4-->>- P0: return
    P0->>+ P5: calls
    P5-->>- P0: return
    P0->>+ P6: calls
    P6-->>- P0: return
    P0->>+ P7: calls
    P7-->>- P0: return
    P0->>+ P10: calls
    P10-->>- P0: return
    P0->>+ P11: calls
    P11-->>- P0: return
```

## Connections by Relation

### calls
- [[.getApplication()]] `EXTRACTED`
- [[.prepareApplication()]] `EXTRACTED`
- [[.approveApplication()]] `EXTRACTED`
- [[.createDraft()]] `EXTRACTED`
- [[.pauseApplication()]] `EXTRACTED`
- [[.cancelApplication()]] `EXTRACTED`
- [[.executeApplicationRun()]] `EXTRACTED`
- [[.getApplicationRuns()]] `EXTRACTED`

### contains
- [[workflow.ts]] `EXTRACTED`

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*