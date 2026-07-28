# ADR 0001: Single Next.js application

Status: accepted.

Use one Next.js App Router application for marketing, merchant UI, public SSR store,
and backend-for-frontend handlers. This keeps authentication, deployment, types,
and transactions within one boundary and avoids an unnecessary Express service.
