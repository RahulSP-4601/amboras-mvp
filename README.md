# Evolv MVP

Evolv is a focused, one-product storefront experiment loop inspired by Amboras:
generate a structured store, publish it, observe validated behavior, test a controlled
improvement, and publish a merchant-selected version.

## Local setup

1. Use Node.js 20.9 or newer and PostgreSQL 14 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and add credentials when available.
4. Apply `supabase/migrations` to an isolated Supabase project.
5. Run `npm run hooks:install`.
6. Run `npm run dev`.

Without credentials, development exposes the visual application and deterministic
local generation preview. Production generation, persistence, OAuth, public store,
and events fail closed until their validated environment values exist.

## Quality commands

- `npm run guardian` — static and functional pre-commit gates
- `npm run typecheck` — strict TypeScript
- `npm run lint` — ESLint limits and safety rules
- `npm run test:functional` — domain and component contracts
- `./scripts/check-database-behavior.sh` — isolated migration/RLS behavior
- `npm run build` — production Next.js build

The current implementation boundary and manual acceptance gates live in
`docs/phases.md`.
