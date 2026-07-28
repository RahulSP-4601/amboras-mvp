# ADR 0003: Event-derived analytics

Status: accepted.

Validated append-only events are authoritative. Simulators use the same ingestion
service and never write aggregates. Metrics are deterministic queries or pure
application calculations; OpenAI receives only validated aggregates.
