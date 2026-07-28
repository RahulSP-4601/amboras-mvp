# Security contract

- Verify Supabase identity server-side for authenticated writes.
- Enforce owner scope in RLS and again in sensitive application services.
- Keep OpenAI and service-role credentials in server-only modules.
- Validate forms, model output, route bodies, cookies, metadata, and identifiers.
- Public event routes derive store, visitor, session, experiment, and variant.
- Event IDs are idempotency keys; database uniqueness resolves duplicates.
- PostgreSQL-backed visitor, address-hash, and store limits are authoritative.
- SECURITY DEFINER mutation and rate-limit RPCs have explicit role grants.
- Paid AI calls have configurable PostgreSQL-backed hourly limits and one active
  job per user and request type.
- Visitor identity is random, first-party, non-fingerprinted, and contains no PII.
- Store sessions use distinct HTTP-only cookies and cannot be reassigned by upsert.
- Cookie writes use SameSite=Lax, Secure in production, and path `/`.
- OAuth return paths are resolved and required to remain on the application origin.
- Published StoreVersions are read-only outside constrained publication functions.
- Store ownership is one-to-one, and stale draft parents/publications are rejected.
- AI cannot publish, execute SQL, access raw event tables, or render arbitrary HTML.
- Public pages expose only the current published version.
- Demo conversion collects no payment or personal information and creates no order.
