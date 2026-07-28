# Deployment

Deploy one Next.js application to Vercel. Configure production Supabase, Google
OAuth callback, OpenAI, service-role key, assignment secret, and application URL.
Apply migrations before deployment. Never reuse preview credentials in production.
Set explicit hourly generation and proposal limits for the expected merchant load.

Production fails closed when required integrations are absent. Synthetic simulation
is disabled by default. Run Guardian, production build, migration checks, and E2E
before promotion.
