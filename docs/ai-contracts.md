# AI contracts

AI endpoints are authenticated, owner-scoped, length-limited, idempotent,
timeout-bounded, and version-logged. OpenAI structured output is validated by Zod.
The model cannot generate executable code, fabricate social proof, modify tables,
calculate authoritative analytics, or publish.

Store-generation keys are bound to an input hash. Completed results replay without
another model call; failed or stale jobs retry at most three times. Valid generated
output is staged before persistence so a database retry does not repeat a paid call.
Store persistence and successful job completion commit in one transaction.
Generation and edit proposals share configurable hourly request limits and
database-enforced one-active-job leases. Proposal keys also bind to an input hash
and completed proposals replay without another model call.

When no OpenAI key exists, deterministic preview generation is allowed only outside
production and is explicitly returned as `local_preview`.
