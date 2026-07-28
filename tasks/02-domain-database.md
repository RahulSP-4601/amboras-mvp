# Phase 2 task

- Goal: RLS schema, ownership, immutable versions, jobs, and rate limits.
- Dependencies: Phase 0.
- Acceptance: cross-store access fails; publish and rollback preserve history.
- Tests: migrations, schemas, version services, ownership, idempotency.
- Security: RLS plus service-layer ownership checks.
- Performance: event indexes and bounded queries.
