# Amboras-Inspired MVP — Phased Delivery Plan

Status: **Phase 0 in progress**

Last updated: **2026-07-28**

## 1. Product purpose

This project is a production-quality vertical slice of Amboras' self-improving-store
concept. It demonstrates full-stack engineering, safe AI system design,
event-derived analytics, controlled A/B experimentation, high-quality frontend
implementation, and disciplined testing.

The MVP proves one loop:

> Generate a storefront, analyse it, create an improvement, test that improvement,
> measure visitor behaviour, and publish the merchant-selected leading version.

It is not a Shopify replacement, payment platform, generic AI website generator,
static prototype, collection of hardcoded screens, or fake analytics dashboard.

## 2. Working agreement

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

## 3. Exact MVP scope

The MVP supports one merchant account, one store, and one primary product per
store. The merchant can sign in with Google, describe a product, optionally upload
an image, generate a structured storefront, edit and publish it, request an AI
audit, create and run one controlled experiment, collect real or synthetic
behavioural events, inspect deterministic analytics, publish a selected variant,
roll back, and request the next experiment.

The MVP does not implement payments, Stripe, Razorpay, card collection, real
checkout, orders, real purchases, revenue, AOV, retention, LTV, inventory,
shipping, fulfilment, refunds, customer accounts, CRM, transactional or marketing
email, platform migration, existing-site integration, custom domains,
multi-currency, taxes, staff roles, multiple stores, multiple themes,
drag-and-drop editing, autonomous publishing, or additional infrastructure.

Database schema migrations are required. Commerce-platform migrations are not.

## 4. No-payment conversion model

The public store uses a clearly labelled demonstration journey:

```text
Product page
→ Click primary CTA
→ Open demo confirmation
→ Confirm demo conversion
→ Record conversion_completed
```

It must never request payment or unnecessary personal information, process money,
create an order, or claim a real purchase occurred. The UI must state:

> Demo conversion — no payment will be processed.

`conversion_completed` is the authoritative final funnel event. The MVP optimises
conversion rate only.

## 5. Visual and system-design reference contract

The supplied screenshots in `docs/references/landing/` and
`docs/references/dashboard/` are the frozen visual source of truth. The saved
system-design board at
`docs/references/system_design/ChatGPT Image Jul 27, 2026 at 11_03_44 PM.png` is a
required reference for the MVP journey, main screens, information relationships,
and A/B testing flow.

The live site at `https://www.amboras.com` may be studied for interaction
understanding, but later live-site changes must not silently change scope.

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

The saved system-design image is a conceptual reference, not an authority for
technology or superseded commerce scope. Where it shows Express, Render,
Cloudinary, purchases, revenue, orders, or checkout, this written plan wins:

- one Next.js App Router application and no separate Express backend;
- Vercel deployment;
- Supabase Auth, PostgreSQL, and Storage;
- no payment, order, purchase, or revenue implementation;
- `conversion_completed` as the demonstration outcome.

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

## 6. Required architecture

Use React, Next.js App Router, strict TypeScript, Tailwind CSS, Supabase Auth,
Supabase PostgreSQL, Supabase Storage, OpenAI, Zod, Vitest, React Testing Library,
Playwright, ESLint, Prettier, and Vercel in one application.

```text
Browser
  → Next.js: marketing, merchant app, public SSR store, handlers/actions
    → Supabase: Google auth, PostgreSQL, product image storage
    → OpenAI: generation, audit, proposals, experiments, explanations
```

Public routes are `/`, `/login`, `/auth/callback`, and `/s/[slug]`. Authenticated
routes are `/app`, `/app/onboarding`, `/app/store`, `/app/product`,
`/app/experiments`, `/app/experiments/[experimentId]`, `/app/analytics`, and
`/app/activity`. `/app/dev/simulator` is authenticated, owner-scoped,
environment-gated, and disabled in production by default.

The sidebar contains only Home, Store, Product, Experiments, Analytics, and AI
Activity. It must not show orders, customers, payments, emails, integrations,
pricing, upgrade, migration, shipping, or fulfilment.

## 7. Domain and algorithm contracts

### 7.1 Product, StoreConfig, and immutable versions

`products` owns the confirmed product name, price, image, and base description.
`StoreConfig` references the product ID and owns presentation: brand and hero copy,
CTA and offer copy, benefits, trust, FAQ, colour, typography, section visibility,
and section order. Conflicting authoritative prices are forbidden.

Every StoreVersion is immutable and has `draft`, `published`, or `archived` status.
Manual or AI edits create a new draft. Publishing changes the store's current
published reference, preserves history, and records AI Activity. Rollback also
preserves history.

Each experiment freezes `base_store_version_id`. Version A is that exact
StoreConfig; Version B is an allow-listed patch against it. An experiment is never
silently rebased. Only one experiment may run per store. Publishing unrelated
changes while one runs requires explicit stop-and-publish confirmation.

Allowed experiment states and transitions:

```text
draft → ready → running → stopped
                    └──→ completed
stopped → running
draft | ready | stopped → cancelled
```

### 7.2 Store-generation and AI-job algorithm

```text
Validate input
→ create idempotent AI job
→ prepare versioned prompt
→ request structured OpenAI output
→ validate with versioned Zod schema
→ reject unknown/unsupported fields
→ create canonical Product
→ create draft StoreVersion
→ record AI Activity
→ return draft preview
```

The `ai_jobs` record includes store/user, job type, status, real current stage,
idempotency key, attempts, model/prompt/schema versions, input summary, error code,
and timestamps. Status is queued, running, succeeded, failed, or cancelled.
Refreshing must not duplicate work. Progress displays real stages, never fabricated
percentages.

OpenAI cannot return React, JSX, JavaScript, CSS, HTML, SQL, or executable code.
Reviews, ratings, guarantees, certifications, and performance claims remain
disabled unless authentic merchant data supports them.

### 7.3 Cold-start audit algorithm

Before traffic, deterministic code evaluates headline clarity, value proposition,
CTA specificity, benefits, trust signals, offer clarity, price justification,
section order, and mobile density. OpenAI receives only Product, StoreConfig,
structured findings, and allowed targets, then returns one validated hypothesis
labelled **Cold-start hypothesis**. It must never imply visitor evidence exists.

### 7.4 Experiment-generation algorithm

`ExperimentProposal` contains name, hypothesis, reason, target section and metric,
frozen base version ID, changed fields, variant patch, expected learning, and risk.
Allowed targets are hero headline/supporting copy/image, CTA, offer, benefit order,
trust message, and selected section visibility/order. The model returns a patch,
not a replacement store. The merchant previews A and B before starting.

### 7.5 Stable visitor-assignment algorithm

Use a random anonymous visitor ID in a secure first-party cookie. For a running
experiment, first read the unique `(visitor_id, experiment_id)` assignment. If
missing, calculate:

```text
HMAC_SHA256(
  EXPERIMENT_ASSIGNMENT_SECRET,
  experiment_id + ":" + visitor_id
) → bucket 0..9999

0..4999 → A
5000..9999 → B
```

Insert under a unique constraint; on a race, read the existing assignment.
Assignment and variant rendering occur server-side before the response. Refresh
never reassigns, and client `Math.random()` is never authoritative.

### 7.6 Session and event-ingestion algorithm

A new session begins after 30 minutes of inactivity. Identity is random,
first-party, non-fingerprinted, and does not rely on persistent IP data.

Allowed events:

```text
page_view
product_view
scroll_50
cta_click
checkout_started
conversion_completed
```

The event request is minimal. The server derives store, visitor, session, active
experiment, saved variant, and synthetic status. It validates event ID and type,
rejects cross-store or forged attribution, bounds metadata, applies PostgreSQL-
backed rate limiting, and guarantees idempotency. The client never declares
ownership, experiment, variant, synthetic status, or conversion value.

`checkout_started` names the demonstration funnel stage only; it does not represent
a real checkout or payment operation.

### 7.7 Synthetic traffic algorithm

Inputs are seed, session count, persona mix, and traffic quality. Personas are
price-sensitive, quality-focused, trust-sensitive, and impatient mobile. The
simulator extracts offer strength, quality messaging, trust strength, CTA clarity,
content length, and mobile density from each variant.

```text
Create synthetic visitor
→ assign through the real assignment service
→ select persona with seeded randomness
→ score persona/variant compatibility
→ derive stage probabilities
→ submit the journey through the real event service
```

The same seed/configuration reproduces results; different inputs may differ.
Version B is never guaranteed to win. The simulator never writes aggregates.
Synthetic records and screens are always labelled and separable from live traffic.

### 7.8 Analytics and result-state algorithm

Authoritative metrics come from application code or database queries, never AI.
Unique exposure is the first valid `page_view` per assigned visitor in an
experiment. Product-view, CTA, checkout-start, and conversion rates are unique
visitors reaching that stage divided by unique exposed visitors. Funnel drop-off
is `1 - next_stage / current_stage`.

Live is the default filter. Synthetic and Combined are explicit alternatives;
synthetic views always show **Synthetic demo traffic**. Never calculate or display
real revenue, order value, AOV, retention, LTV, or profit.

Result states are:

```text
Insufficient data
Current leader
Merchant-confirmed selection
```

The configurable demonstration threshold defaults to at least 100 unique exposures
per variant and 10 total `conversion_completed` events. It is a guardrail, not
statistical significance. A merchant may select either variant after acknowledging
the warning.

### 7.9 Variant-publication algorithm

```text
Validate ownership and experiment state
→ validate selected variant
→ materialize selected StoreConfig
→ create new published StoreVersion
→ archive previous published reference
→ complete experiment
→ store observed metric snapshot
→ record merchant-confirmed selection and AI Activity
→ update public store reference
```

This is transactional, preserves history and the public URL, and always requires
explicit merchant confirmation.

### 7.10 AI explanation and assistant boundaries

OpenAI receives validated aggregate counts, rates, threshold status, changed fields,
hypothesis, and current leader—not raw tables. It may explain observations,
limitations, and one next experiment. It cannot invent metrics, claim certainty,
modify records, or publish.

The persistent assistant supports only `get_store_context`,
`propose_store_changes`, `create_experiment`, and
`explain_experiment_results`. Publishing and rollback remain explicit UI actions.
Every tool is schema-validated, authenticated, owner-scoped, and auditable.

### 7.11 Data, environment, and safeguards

Required tables are profiles, stores, products, store_versions, ai_jobs,
experiments, experiment_variants, visitors, visitor_assignments, sessions, events,
experiment_metric_snapshots, ai_actions, and rate_limits. Use RLS, server ownership
checks, foreign keys, status/unique constraints, analytics indexes, and
transactional publication. Anonymous users never receive broad database access.

All AI requests require authentication, ownership, length/output limits,
idempotency, timeout, bounded retries, one active same-type job, version and usage
logging, safe error logging, and configurable request limits. Pre-commit never
makes paid calls. Production rate limits are PostgreSQL-backed, not in-memory.

## 8. MVP completion path

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
11. The merchant confirms and publishes a selected variant, then the system proposes
    the next experiment.

## 9. Phase status

| Phase | Deliverable                                                      | Status      | Manual approval |
| ----: | ---------------------------------------------------------------- | ----------- | --------------- |
|     0 | Specification, architecture, and quality foundation              | **Current** | Pending         |
|     1 | Visual foundation, landing page, auth, and app shell             | Not started | Required        |
|     2 | Database, ownership, and versioning foundation                   | Not started | Required        |
|     3 | Product onboarding and AI store generation                       | Not started | Required        |
|     4 | Store renderer, editing, preview, publish, and rollback          | Not started | Required        |
|     5 | Public storefront, visitor identity, events, and demo conversion | Not started | Required        |
|     6 | AI audit and experiment lifecycle                                | Not started | Required        |
|     7 | Synthetic demo traffic                                           | Not started | Required        |
|     8 | Analytics, AI explanation, and variant publication               | Not started | Required        |
|     9 | Persistent AI assistant and AI Activity                          | Not started | Required        |
|    10 | Hardening, full journey, and deployment readiness                | Not started | Required        |

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
- [ ] Guardian succeeds from a clean repository state.
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

## Phase 5 — Public storefront, visitor identity, events, and demo conversion

### Goal

Publish a real public storefront and collect trustworthy behavioural events.

### Scope

- Render `/s/[slug]` server-side from the current published version.
- Create anonymous visitor and session identity with secure first-party cookies.
- Add validated, idempotent, rate-limited, server-controlled event ingestion.
- Support the fixed event allow-list from page view through `conversion_completed`.
- Implement the clearly labelled no-payment demo conversion journey.
- Attach store, visitor, session, experiment, variant, synthetic flag, and optional
  value on the server where applicable.

### Automated checks

- Event validation, idempotency, rate limiting, and cross-store rejection tests.
- Visitor/session persistence and public-store tests.
- Demo conversion journey test.

### Manual verification

- [ ] Published content appears at one stable public URL.
- [ ] Draft content never leaks to the public page.
- [ ] Refresh preserves visitor identity and creates correct session behaviour.
- [ ] Events occur once at the intended interaction points.
- [ ] Demo conversion states that no payment is processed.
- [ ] No personal or payment data is requested.
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

## Phase 8 — Analytics, AI explanation, and variant publication

### Goal

Convert event data into deterministic results and safely publish a
merchant-confirmed variant.

### Scope

- Calculate unique exposures, funnel counts, drop-off, and conversion rate from
  events.
- Compare variants and filter synthetic versus live data.
- Make application logic—not OpenAI—the numeric source of truth and current leader.
- Give AI only validated aggregates for explanation, limitations, and next-test ideas.
- Publish a merchant-selected variant transactionally, preserve versions and
  observed metrics, complete the experiment, and keep the same public URL.

### Automated checks

- Exposure, funnel, conversion, filter, and aggregation tests.
- Small-sample/insufficient-evidence explanation guard tests.
- Atomic variant-publication and public-version update tests.

### Manual verification

- [ ] Analytics match a hand-calculated seeded dataset.
- [ ] No revenue, order, AOV, retention, LTV, or profit metric appears.
- [ ] Live-only, synthetic-only, and combined filters are correct.
- [ ] Empty, running, insufficient-sample, and completed states are clear.
- [ ] AI numbers exactly match validated aggregates and include limitations.
- [ ] Variant publication requires confirmation and changes the public store.
- [ ] The prior version remains available for rollback.
- [ ] Analytics and result screens pass visual comparison.

### Exit gate

Metrics are reproducible, explanations are bounded, and a merchant-confirmed
variant can be published safely; Guardian passes.

---

## Phase 9 — Persistent AI assistant and AI Activity

### Goal

Unify the MVP workflow through a constrained assistant and a transparent action
history.

### Scope

- Activate the persistent composer across authenticated pages.
- Supply page-specific suggestions for Store, Experiments, and Analytics.
- Implement validated application tools for context, proposals, experiments,
  explanations and experiment creation; publication and rollback stay explicit UI
  actions.
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
- Final visual pass against every supplied landing/dashboard reference and the
  saved system-design journey.

Required end-to-end journey:

```text
Landing → Google login → onboarding → generate → preview → publish
→ public store → cold-start audit → create and preview A/B experiment
→ start → synthetic traffic → analytics → AI explanation
→ merchant selects variant → publish → confirm public update
→ rollback → confirm restoration → request next experiment
```

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
- [ ] No payment, order, purchase, or revenue logic exists.
- [ ] Rollback and recovery paths are demonstrated.

### Exit gate

All checks pass, no critical known security or data-integrity risk remains, visual
review is approved, and the deployed MVP completes the promised loop.

## 10. Phase completion record template

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

## 11. Change log

### 2026-07-28

- Created the phased MVP delivery plan.
- Reconciled the supplied product brief, current Next.js starter repository, local
  landing/dashboard screenshots, and live Amboras reference.
- Marked Phase 0 as current.
- Began Phase 0 by adding the two-part Guardian quality gate and pre-commit hook.
- Replaced payment, purchase, order, and revenue-adjacent scope with the explicitly
  labelled `conversion_completed` demonstration funnel.
- Added Product/StoreConfig ownership, immutable version and experiment-base rules,
  HMAC visitor assignment, event attribution, seeded simulator, deterministic
  analytics, result states, and transactional variant-publication algorithms.
- Made `docs/references/landing/`, `docs/references/dashboard/`, and
  `docs/references/system_design/` required implementation references.
- Recorded that the written Next.js/Supabase/no-payment architecture overrides
  superseded Express, Cloudinary, purchase, and revenue details in the conceptual
  system-design image.
- No product feature code was changed.
