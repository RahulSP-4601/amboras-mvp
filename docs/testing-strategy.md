# Testing strategy

Guardian runs strict TypeScript, ESLint, formatting, file limits, staged-file safety,
and fast Vitest behavior contracts before every commit.

Unit contracts cover Zod schemas, deterministic generation, controlled edits,
version immutability, assignment, OAuth destinations, identity, event validation,
and later analytics. Database Guardian starts an isolated PostgreSQL cluster,
applies every migration, and exercises ownership, stale-version, active-job,
session, rate-retention, foreign-key, storage-policy, and RPC-grant behavior.

React Testing Library expands with each interactive workflow. Playwright currently
covers the public landing smoke journey on desktop and mobile; credentialed browser
journeys are added alongside the manual environment. CI runs Guardian, the production
build, and Playwright. Paid APIs are never called by pre-commit or default CI.

Real-service smoke tests are opt-in and use isolated non-production credentials.
