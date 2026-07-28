# StoreConfig schema

`src/lib/domain/store-config.ts` is authoritative. StoreConfig contains only
validated presentation data and a canonical Product reference. A fixed section
registry owns rendering. Unknown fields, duplicate ordering, missing enabled
sections, invalid colors, oversized text, and executable output are rejected.

Canonical product price, image, name, and base description remain in Product.
