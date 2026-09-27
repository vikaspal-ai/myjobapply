# api()

> God node · 8 connections · [/Users/apple/Desktop/myjobapply/frontend/src/api/client.ts](file:///Users/apple/Desktop/myjobapply/frontend/src/api/client.ts#L6)

## Call Trace Diagram

```mermaid
sequenceDiagram
    participant P0 as api()
    participant P1 as signup()
    participant P2 as login()
    participant P3 as setSession()
    participant P4 as syncStoredCandidate
    participant P5 as closeAuthModal()
    participant P6 as handleSignInSubmit()
    participant P7 as handleSignUpSubmit()
    participant P8 as logout()
    participant P9 as clearSession()
    participant P10 as handleOAuthRedirect()
    participant P11 as handleApprove()
    participant P12 as handleReject()
    participant P13 as handleAutoApply()
    participant P14 as handleAddSkill()
    participant P15 as handleSaveProfile()
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
    P1->>+ P7: calls
    P7-->>- P1: return
    P7->>+ P1: calls
    P1-->>- P7: return
    P0->>+ P8: calls
    P8-->>- P0: return
    P8->>+ P0: calls
    P0-->>- P8: return
    P8->>+ P9: calls
    P9-->>- P8: return
    P9->>+ P10: calls
    P10-->>- P9: return
    P9->>+ P8: calls
    P8-->>- P9: return
    P0->>+ P11: calls
    P11-->>- P0: return
    P0->>+ P12: calls
    P12-->>- P0: return
    P0->>+ P13: calls
    P13-->>- P0: return
    P0->>+ P14: calls
    P14-->>- P0: return
    P0->>+ P15: calls
    P15-->>- P0: return
```

## Connections by Relation

### calls
- [[signup()]] `INFERRED`
- [[logout()]] `INFERRED`
- [[handleApprove()]] `INFERRED`
- [[handleReject()]] `INFERRED`
- [[handleAutoApply()]] `INFERRED`
- [[handleAddSkill()]] `INFERRED`
- [[handleSaveProfile()]] `INFERRED`

### contains
- [[client.ts]] `EXTRACTED`

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*