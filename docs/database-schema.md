# Database schema

The executable sources are the ordered files in `supabase/migrations`. The initial
schema is followed by hardening and integrity migrations containing protected
policies, transactional mutation functions, and concurrency constraints.

Owner-scoped entities are profiles, stores, products, store_versions, ai_jobs,
experiments, experiment_variants, experiment_metric_snapshots, and ai_actions.
Visitor entities are visitors, assignments, sessions, and append-only events.
`rate_limits` provides serverless-safe enforcement with bounded retention. RLS is
enabled on every table;
public event writes go through server services instead of anonymous table access.
Authenticated clients can read their StoreVersions but cannot update or delete
published history. Generation persistence, draft creation, rollback-pointer updates,
and publication use bounded database transactions. Draft and rollback retries carry
mutation keys, publish is replay-safe, and AI writes are fenced to their claimed
attempt lease. One owner can have one store,
only one AI job of a given type can be active per user, and events must reference a
session with the same store and visitor.
