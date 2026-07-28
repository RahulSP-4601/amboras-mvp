# MVP architecture

The MVP is one Next.js App Router application deployed to Vercel. Server Components
render data-heavy pages; Client Components are limited to interaction boundaries.
Route Handlers own JSON APIs, cookie writes, event ingestion, and OAuth callback.

Supabase provides Google Auth, PostgreSQL, Row Level Security, and product-image
Storage. The publishable key is used with a verified user session. The service role
is restricted to server-only public-store/event services that derive identity and
store context rather than trusting client attribution.

OpenAI is a server-only structured-output boundary. Zod validates input and output.
The application owns the StoreConfig renderer and never executes model-generated
code.

Domain modules are pure where practical. Store versions are immutable, publication
is transactional, and analytics will be derived from append-only events. The
development deterministic generator is explicit and unavailable in production.

The screenshots in `docs/references/landing` and `docs/references/dashboard` are the
visual baseline. `docs/references/system_design` informs the journey, but its
Express, Cloudinary, payment, purchase, and revenue details are superseded by this
architecture and `docs/phases.md`.
