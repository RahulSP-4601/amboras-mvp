# Amboras-Inspired MVP — Phased Delivery Plan

Status: **Phase 0 in progress**

Last updated: **2026-07-28**

## 1. Working agreement

This document is the delivery contract for the MVP. We will implement **one phase at
a time**, manually test it, record the result here, and wait for explicit approval
before beginning the next phase.

- The goal is an accurate, production-quality vertical slice of the
  self-improving-store loop, not a recreation of the whole Amboras product.
- No feature work starts until its phase is approved.
- A phase is complete only when its acceptance criteria and manual test checklist
  pass.
- Failed or deferred checks stay visible in the phase record.
- Changes discovered during implementation are added here before expanding scope.
- Pricing, billing, subscriptions, migrations, custom domains, full commerce
  operations, and other stated non-goals remain out of scope.

## 2. Visual fidelity contract

The supplied screenshots in `docs/references/landing/` and
`docs/references/dashboard/`, together with the live reference at
`https://www.amboras.com`, are the visual source of truth.

“1:1” means matching the reference's observable design system and layout as closely
as practical:

- page geometry, grid, content width, spacing, alignment, and responsive behaviour;
- typography scale, weight, line height, hierarchy, and density;
- border weight, corner radius, surface treatment, and restrained shadows;
- sidebar, top bar, cards, tables, empty states, controls, and persistent AI composer;
- hover, focus, active, loading, success, error, draft, published, running, and
  completed states.

It does **not** mean copying Amboras branding, logo, copy, proprietary artwork,
exact icons, pricing, upgrade controls, or features outside this MVP. The MVP will
use an original temporary identity and product-specific generated content.

Every UI phase requires comparison at these viewports unless a screen is not
applicable:

| Viewport          |       Size | Required evidence                           |
| ----------------- | ---------: | ------------------------------------------- |
| Desktop reference | 1440 × 900 | Side-by-side screenshot comparison          |
| Laptop            | 1280 × 800 | No clipping or unintended overflow          |
| Mobile            |  390 × 844 | Responsive screenshot and interaction check |

Visual approval is based on side-by-side inspection. Material differences in
layout, spacing, type, colour, sizing, or behaviour must be fixed or explicitly
recorded before approval.

## 3. MVP completion path

The MVP is complete when this loop works end to end:

1. A visitor lands on the marketing page and signs in with Google.
2. A new merchant describes one product and generates a structured store draft.
3. The merchant edits, previews, publishes, and can roll back versions.
4. The same public URL renders the published storefront.
5. AI proposes a cold-start experiment as a clearly labelled hypothesis.
6. The merchant compares Version A and B and starts the experiment.
7. Visitors receive a stable server-side assignment and generate validated events.
8. Clearly labelled synthetic demo traffic can exercise the same event pipeline.
9. Deterministic analytics identify the current leader.
10. AI explains the validated aggregates without inventing metrics or certainty.
11. The merchant publishes the winner and the system proposes the next experiment.

## 4. Phase status

| Phase | Deliverable                                                    | Status      | Manual approval |
| ----: | -------------------------------------------------------------- | ----------- | --------------- |
|     0 | Specification, architecture, and quality foundation            | **Current** | Pending         |
|     1 | Visual foundation, landing page, auth, and app shell           | Not started | Required        |
|     2 | Database, ownership, and versioning foundation                 | Not started | Required        |
|     3 | Product onboarding and AI store generation                     | Not started | Required        |
|     4 | Store renderer, editing, preview, publish, and rollback        | Not started | Required        |
|     5 | Public storefront, visitor identity, events, and demo checkout | Not started | Required        |
|     6 | AI audit and experiment lifecycle                              | Not started | Required        |
|     7 | Synthetic demo traffic                                         | Not started | Required        |
|     8 | Analytics, AI explanation, and winner publication              | Not started | Required        |
|     9 | Persistent AI assistant and AI Activity                        | Not started | Required        |
|    10 | Hardening, full journey, and deployment readiness              | Not started | Required        |

Allowed status values: `Not started`, `Current`, `In progress`, `Blocked`,
`Ready for manual test`, `Approved`, and `Complete`.

---

## Phase 0 — Specification, architecture, and quality foundation

### Goal

Remove architectural ambiguity and establish enforceable quality gates before
product code is written.

### Scope

- Inspect the starter repository and pin the exact MVP scope and non-goals.
- Read the local Next.js 16.2.12 documentation relevant to each later change.
- Document product requirements, user flow, architecture, database schema,
  structured AI contracts, StoreConfig, experiment engine, event tracking,
  security, testing, UI system, and deployment.
- Record architecture decisions for a single Next.js application, a schema-driven
  storefront, and event-derived experiment analytics.
- Create focused task specifications for Phases 1–10.
- Add Static Guardian, Functional Guardian scaffolding, pre-commit integration,
  and CI checks.
- Establish environment validation, test structure, formatting, and dependency
  policy without implementing product features.

### Deliverables

- Root engineering instructions and updated project README.
- Phase 0 documentation and architecture decision records.
- Guardian scripts, hook installer, and CI workflow.
- Initial contract tests that run without paid or live external calls.
- A concise repository risk inventory.

### Manual verification

- [ ] All required documents exist and agree on scope and terminology.
- [ ] Every later phase has dependencies, acceptance criteria, tests, security
      notes, and a definition of done.
- [ ] Guardian succeeds on a clean checkout.
- [ ] A deliberate lint/type/test violation makes Guardian fail clearly.
- [ ] Pre-commit hook installation is documented and verified.
- [ ] No auth, database, AI, storefront, or other product feature was implemented.

### Exit gate

Architecture and task specifications are approved; Guardian passes; the user
explicitly authorizes Phase 1.

---

## Phase 1 — Visual foundation, landing page, auth, and app shell

### Goal

Establish the reference-quality visual language and a secure entry into the
authenticated product.

### Scope

- Create original temporary branding and reusable design tokens.
- Build the responsive landing page around the approved MVP message:
  “Build a store that improves itself.”
- Match the reference navigation, hero proportions, editorial sections, cards,
  whitespace rhythm, and footer while omitting pricing and unrelated features.
- Configure validated environment variables and Supabase browser/server clients.
- Implement Google OAuth, callback, logout, new/returning-user routing, and
  authenticated-route protection.
- Build the desktop admin shell: fixed sidebar, top bar, content canvas, mobile
  navigation, and placeholder states only for routes that will work.
- Build the persistent AI-composer shell visually; no AI execution yet.

### Automated checks

- Auth redirect and route protection integration tests.
- Landing, login, sidebar, mobile navigation, and shell component tests.
- No server secret in client bundles.

### Manual verification

- [ ] Landing screenshots pass desktop and mobile visual comparison.
- [ ] Google sign-in, callback, returning-user redirect, and logout work.
- [ ] Unauthenticated access to `/app` redirects safely.
- [ ] Sidebar and mobile navigation are keyboard accessible.
- [ ] No pricing, plan, upgrade, migration, or unsupported navigation appears.
- [ ] Loading, error, focus, hover, and active states match the design contract.

### Exit gate

Landing and shell receive visual approval; production OAuth flow is manually
verified; Guardian passes.

---

## Phase 2 — Database, ownership, and versioning foundation

### Goal

Create the secure dynamic data model that supports one product per store without
hardcoded demo business logic.

### Scope

- Add migrations for profiles, stores, products, store versions, experiments,
  variants, visitors, assignments, sessions, events, and AI actions.
- Add indexes, constraints, timestamps, status enums, and relationships.
- Add Row Level Security and server-side ownership checks.
- Implement strict domain types, repositories, and transactional versioning
  primitives.
- Support draft creation, publishing with history preservation, and rollback.

### Automated checks

- Migration validation and ownership/RLS tests.
- Draft, publish, previous-version preservation, and rollback service tests.
- Cross-store access rejection tests.

### Manual verification

- [ ] New user/profile and one owned store can be created dynamically.
- [ ] A second user cannot read or mutate the first user's records.
- [ ] Publishing preserves the prior version.
- [ ] Rollback creates/restores the correct published state without deleting history.
- [ ] Anonymous users have no broad database access.

### Exit gate

Schema, RLS, ownership, and versioning behaviour are approved; Guardian passes.

---

## Phase 3 — Product onboarding and AI store generation

### Goal

Turn a merchant's product description into a validated, editable store draft.

### Scope

- Build onboarding for product description, optional name, price, brand, and image.
- Upload product images securely to Supabase Storage.
- Define versioned Zod contracts for generation input and StoreConfig output.
- Add server-only OpenAI prompting with bounded retry and structured logging.
- Validate and sanitize all model output; never generate or render executable code.
- Show the five-step generation progress experience and useful failure/retry states.
- Persist the product and first draft StoreVersion.

### Automated checks

- Schema boundary, malformed model output, retry, upload, and draft-creation tests.
- Onboarding form and generation-progress component tests.
- Mocked OpenAI integration tests; no paid calls in Guardian.

### Manual verification

- [ ] Several unrelated product descriptions generate distinct dynamic drafts.
- [ ] Optional fields behave correctly and price requires user confirmation.
- [ ] Invalid files, invalid responses, timeouts, and retries are handled visibly.
- [ ] Refresh/retry does not create unintended duplicate stores or drafts.
- [ ] Secrets and prompts remain server-side.
- [ ] Onboarding and progress UI pass desktop/mobile visual review.

### Exit gate

The user can reliably create one valid draft from a product description; generated
data and UI are approved; Guardian passes.

---

## Phase 4 — Store renderer, editing, preview, publish, and rollback

### Goal

Let the merchant safely review and control the generated storefront.

### Scope

- Build one reusable StoreConfig-driven renderer with controlled sections.
- Add desktop/mobile and draft/published preview modes.
- Add controlled manual editing for approved StoreConfig fields.
- Add AI-assisted change proposals with apply/discard; applying creates a new draft.
- Publish only after explicit user action; never mutate a published version.
- Add version history and rollback.

### Automated checks

- StoreConfig rendering, patch allow-list, proposal, publish, and rollback tests.
- Builder controls, comparison states, and preview component tests.

### Manual verification

- [ ] Every enabled section and allowed ordering renders from stored data.
- [ ] No AI text is rendered as arbitrary HTML or executable code.
- [ ] Desktop/mobile preview switches without data loss.
- [ ] Discard leaves the draft unchanged; apply creates a new draft.
- [ ] Publish changes the published preview and preserves history.
- [ ] Rollback restores the prior storefront.
- [ ] Builder UI passes reference comparison at required viewports.

### Exit gate

Generate → edit → preview → publish → rollback works with version safety and visual
approval; Guardian passes.

---

## Phase 5 — Public storefront, visitor identity, events, and demo checkout

### Goal

Publish a real public storefront and collect trustworthy behavioural events.

### Scope

- Render `/s/[slug]` server-side from the current published version.
- Create anonymous visitor and session identity with secure first-party cookies.
- Add validated, idempotent, rate-limited, server-controlled event ingestion.
- Support the fixed event allow-list from page view through purchase.
- Implement the simulated add-to-cart and checkout-success journey.
- Attach store, visitor, session, experiment, variant, synthetic flag, and optional
  value on the server where applicable.

### Automated checks

- Event validation, idempotency, rate limiting, and cross-store rejection tests.
- Visitor/session persistence and public-store tests.
- Simulated checkout journey test.

### Manual verification

- [ ] Published content appears at one stable public URL.
- [ ] Draft content never leaks to the public page.
- [ ] Refresh preserves visitor identity and creates correct session behaviour.
- [ ] Events occur once at the intended interaction points.
- [ ] Unknown, duplicate, forged-store, and excessive events are rejected.
- [ ] Public storefront is responsive, accessible, and free of layout shifts.

### Exit gate

The public store and complete simulated funnel produce valid queryable events;
Guardian passes.

---

## Phase 6 — AI audit and experiment lifecycle

### Goal

Create, preview, and run one trustworthy A/B experiment against the published store.

### Scope

- Generate a cold-start audit from StoreConfig and label it as a hypothesis.
- Validate ExperimentProposal, allowed patch targets, changed fields, metric, risk,
  and expected learning.
- Present Version A/B side by side with a precise change summary.
- Add explicit experiment start and lifecycle state transitions.
- Assign new visitors approximately 50/50 on the server.
- Persist assignment in a cookie and database; never re-randomize on refresh.
- Render the assigned variant during SSR without a variant flash.

### Automated checks

- Proposal schema and patch allow-list tests.
- Deterministic distribution and stable-assignment tests.
- Experiment lifecycle, concurrency, and SSR variant tests.

### Manual verification

- [ ] Audit language never claims unsupported proof or certainty.
- [ ] Version A equals the current published configuration.
- [ ] Version B changes only the summarized allowed fields.
- [ ] Starting requires explicit merchant action.
- [ ] One browser retains its variant across refreshes and sessions as designed.
- [ ] A clean visitor population is approximately balanced.
- [ ] A/B comparison and statuses pass visual review.

### Exit gate

A validated experiment can be previewed, started, and served consistently without
layout flash; Guardian passes.

---

## Phase 7 — Synthetic demo traffic

### Goal

Demonstrate the experiment loop without misrepresenting simulated behaviour as
real customer evidence.

### Scope

- Add authenticated, owner-only, environment-gated simulator controls.
- Label all controls and output “Synthetic demo traffic.”
- Implement seeded personas, journey probabilities, and abandonment.
- Route simulated visitors through the real assignment and event-ingestion services.
- Store synthetic flags and support live/synthetic separation.
- Never write aggregate results directly and never hardcode a winner.

### Automated checks

- Seed repeatability, persona, probability, and non-guaranteed-winner tests.
- Same-service-path and no-direct-aggregate-write tests.
- owner/environment protection and synthetic/live separation tests.

### Manual verification

- [ ] The same seed and configuration reproduce the same event journey.
- [ ] Different seeds/persona mixes can produce different outcomes.
- [ ] Synthetic records are clearly labelled everywhere.
- [ ] Simulator is unavailable when production configuration disables it.
- [ ] Another user cannot simulate traffic for a store they do not own.

### Exit gate

Repeatable synthetic sessions exercise the genuine pipeline and remain unmistakably
separate from live traffic; Guardian passes.

---

## Phase 8 — Analytics, AI explanation, and winner publication

### Goal

Convert event data into deterministic results and safely publish the current winner.

### Scope

- Calculate sessions, funnel counts, drop-off, conversion, revenue, and revenue per
  visitor from events.
- Compare variants and filter synthetic versus live data.
- Make application logic—not OpenAI—the numeric source of truth and current leader.
- Give AI only validated aggregates for explanation, limitations, and next-test ideas.
- Publish a selected winner transactionally, preserve versions and observed metrics,
  complete the experiment, and keep the same public URL.

### Automated checks

- Funnel, conversion, revenue, filter, and aggregation tests.
- Small-sample/insufficient-evidence explanation guard tests.
- Atomic winner-publication and public-version update tests.

### Manual verification

- [ ] Analytics match a hand-calculated seeded dataset.
- [ ] Live-only, synthetic-only, and combined filters are correct.
- [ ] Empty, running, insufficient-sample, and completed states are clear.
- [ ] AI numbers exactly match validated aggregates and include limitations.
- [ ] Winner publication requires confirmation and changes the public store.
- [ ] The prior version remains available for rollback.
- [ ] Analytics and result screens pass visual comparison.

### Exit gate

Metrics are reproducible, explanations are bounded, and a confirmed winner can be
published safely; Guardian passes.

---

## Phase 9 — Persistent AI assistant and AI Activity

### Goal

Unify the MVP workflow through a constrained assistant and a transparent action
history.

### Scope

- Activate the persistent composer across authenticated pages.
- Supply page-specific suggestions for Store, Experiments, and Analytics.
- Implement validated application tools for context, proposals, experiments,
  explanations, winner publication, and rollback.
- Require explicit confirmation for publishing and rollback.
- Record user, AI, and system activities with status, summary, entity, timestamp,
  metadata, and actor.

### Automated checks

- Tool validation, authorization, confirmation, and failure tests.
- AI cannot execute SQL, directly mutate tables, or publish autonomously.
- Composer and Activity timeline component tests.

### Manual verification

- [ ] Suggestions change appropriately with the active page.
- [ ] Proposed mutations are previewable and dismissible.
- [ ] Sensitive actions cannot run without explicit confirmation.
- [ ] Failed and successful actions appear accurately in the timeline.
- [ ] Composer remains usable without hiding important mobile content.
- [ ] Composer and Activity UI pass reference comparison.

### Exit gate

Assistant tools are useful, constrained, auditable, owner-scoped, and visually
approved; Guardian passes.

---

## Phase 10 — Hardening, full journey, and deployment readiness

### Goal

Prove the complete MVP is secure, accessible, responsive, deployable, and ready for
a founder demonstration.

### Scope

- Accessibility, responsive, security, privacy, and performance audits.
- Skeleton, empty, error, retry, and success-state completion.
- Full Playwright journey with mocked AI and approved test-auth strategy.
- Separate opt-in smoke tests for real Supabase, OAuth, and OpenAI boundaries.
- Vercel configuration, deployment documentation, and demo seed workflow.
- Final visual pass against every supplied reference screen.

### Automated checks

- Static Guardian, Functional Guardian, production build, migrations, and full E2E.
- Critical accessibility checks and public-page performance budget.
- Secret scanning and production configuration checks.

### Manual verification

- [ ] Complete MVP path works from landing through next-experiment proposal.
- [ ] Desktop and mobile visual evidence is approved for every route.
- [ ] Keyboard-only and screen-reader spot checks pass.
- [ ] Production secrets, OAuth redirects, RLS, cookies, rate limits, and simulator
      gating are verified.
- [ ] Public storefront has no assignment flash or major layout shift.
- [ ] Synthetic results are never presented as real customer results.
- [ ] Rollback and recovery paths are demonstrated.

### Exit gate

All checks pass, no critical known security or data-integrity risk remains, visual
review is approved, and the deployed MVP completes the promised loop.

## 5. Phase completion record template

Append one record below whenever a phase is submitted for approval.

```md
### Phase N completion — YYYY-MM-DD

- Status:
- Summary:
- Files created:
- Files modified:
- Database changes:
- Automated tests:
- Guardian result:
- Manual verification performed:
- Visual comparison evidence:
- Known limitations:
- Security risks:
- Performance risks:
- Deferred items:
- Suggested commit:
- Approval:
```

## 6. Change log

### 2026-07-28

- Created the phased MVP delivery plan.
- Reconciled the supplied product brief, current Next.js starter repository, local
  landing/dashboard screenshots, and live Amboras reference.
- Marked Phase 0 as current.
- Began Phase 0 by adding the two-part Guardian quality gate and pre-commit hook.
- No product feature code was changed.
