# Agent 2 — Data & Database

## Done
- Closed Gate 1 context for CQ/Data.
- Confirmed `calculateCv` is currently aligned with the active Java code, `PLANS.md`, and `transicao-java/prompts/05-services-qc.md`.
- Reclassified the `calculateCv` issue as a semantic/domain ambiguity rather than a safe implementation bug.
- Tightened production JPA mode to `ddl-auto=validate`.

## Pending
- Add Flyway dependency and baseline migrations.
- Export current schema into `V1__baseline.sql`.
- Add missing indexes and unique constraints in migrations.
- Review N+1 hotspots, cascade policies, and optimistic locking.
- Add HikariCP production sizing.

## Domain Note
- `calculateCv` must remain frozen as the current “desvio percentual contra alvo” until an explicit CQ/domain audit approves a semantic change.
