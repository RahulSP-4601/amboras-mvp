# ADR 0002: Schema-driven storefront

Status: accepted.

OpenAI returns a strict StoreConfig. A fixed application-owned section registry
renders it. Unknown keys and executable output are rejected. This preserves visual
quality, security, versionability, and predictable experiments.
