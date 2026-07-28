<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Evolv engineering rules

- Read `docs/phases.md` and the relevant local Next.js guide before editing.
- Work only inside the approved phase and do not change unrelated areas.
- Never bypass Guardian or commit with `--no-verify`.
- Handwritten source files stay below 500 lines; functions stay below 50 lines.
- TypeScript remains strict; validate every external input with Zod.
- OpenAI calls are server-only and can return structured data, never executable code.
- Supabase service credentials never enter client modules.
- Keep UI, domain logic, persistence, and external integrations separate.
- Published StoreVersions are immutable; edits and rollback create new versions.
- Analytics are derived from events. Synthetic traffic never writes aggregates.
- Never represent synthetic results as real customer evidence.
- Do not add pricing, billing, payments, orders, purchases, or revenue functionality.
- Add functional Guardian coverage with every business behavior.
