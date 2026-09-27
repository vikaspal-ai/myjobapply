# parseResume()

> God node · 13 connections · [/Users/apple/Desktop/myjobapply/src/docs/resume-parser.ts](file:///Users/apple/Desktop/myjobapply/src/docs/resume-parser.ts#L100)

## Call Trace Diagram

```mermaid
sequenceDiagram
    participant P0 as parseResume()
    participant P1 as extractSkills()
    participant P2 as formatSkillCasing()
    participant P3 as extractExperience()
    participant P4 as splitRoleAndCompany()
    participant P5 as extractProjects()
    participant P6 as cleanBulletText()
    participant P7 as .parseFile()
    participant P8 as .cleanExtractedText()
    participant P9 as createEmptyParsedResume()
    participant P10 as extractContactInfo()
    participant P11 as partitionSections()
    participant P12 as extractEducation()
    participant P13 as extractSummary()
    participant P14 as calculateTotalExperience()
    participant P15 as determineRoleTitle()
    participant P16 as calculateAtsScore()
    P0->>+ P1: calls
    P1-->>- P0: return
    P1->>+ P0: calls
    P0-->>- P1: return
    P1->>+ P2: calls
    P2-->>- P1: return
    P2->>+ P1: calls
    P1-->>- P2: return
    P0->>+ P3: calls
    P3-->>- P0: return
    P3->>+ P0: calls
    P0-->>- P3: return
    P3->>+ P4: calls
    P4-->>- P3: return
    P4->>+ P3: calls
    P3-->>- P4: return
    P0->>+ P5: calls
    P5-->>- P0: return
    P5->>+ P0: calls
    P0-->>- P5: return
    P5->>+ P6: calls
    P6-->>- P5: return
    P6->>+ P5: calls
    P5-->>- P6: return
    P0->>+ P7: calls
    P7-->>- P0: return
    P7->>+ P0: calls
    P0-->>- P7: return
    P7->>+ P8: calls
    P8-->>- P7: return
    P0->>+ P9: calls
    P9-->>- P0: return
    P0->>+ P10: calls
    P10-->>- P0: return
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
    P0->>+ P16: calls
    P16-->>- P0: return
```

## Connections by Relation

### calls
- [[extractSkills()]] `EXTRACTED`
- [[extractExperience()]] `EXTRACTED`
- [[extractProjects()]] `EXTRACTED`
- [[.parseFile()]] `INFERRED`
- [[createEmptyParsedResume()]] `EXTRACTED`
- [[extractContactInfo()]] `EXTRACTED`
- [[partitionSections()]] `EXTRACTED`
- [[extractEducation()]] `EXTRACTED`
- [[extractSummary()]] `EXTRACTED`
- [[calculateTotalExperience()]] `EXTRACTED`
- [[determineRoleTitle()]] `EXTRACTED`
- [[calculateAtsScore()]] `EXTRACTED`

### contains
- [[resume-parser.ts]] `EXTRACTED`

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*