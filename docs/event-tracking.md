# Event tracking

Allowed events are page_view, product_view, scroll_50, cta_click,
checkout_started, and conversion_completed. The final two are demo funnel labels,
not a real checkout or purchase.

The route supplies the store slug. Server code derives published store, visitor,
store-specific 30-minute session, synthetic status, and later experiment
attribution. Public-page proxy cookies exist before hydration, and initial events
are serialized. Event ID provides idempotency.
An ID is accepted as a replay only when store, visitor, session, type, metadata, and
synthetic context all match.

Metadata is bounded. PostgreSQL-backed limits apply per visitor, privacy-preserving
address hash, and store. The rate-limit RPC is service-role only. Existing sessions
must match both their visitor and store before an event is accepted.
Session preparation is atomic and backed by a composite event/session foreign key.
