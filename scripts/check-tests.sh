#!/usr/bin/env bash

set -euo pipefail

if command -v rg >/dev/null 2>&1; then
  focused_tests="$(rg -n '\.(only|skip)\s*\(' tests src \
    --glob '*.{test,spec}.{ts,tsx}' || true)"
else
  focused_tests="$(grep -REn '\.(only|skip)[[:space:]]*\(' tests src \
    --include='*.test.ts' --include='*.test.tsx' \
    --include='*.spec.ts' --include='*.spec.tsx' || true)"
fi

if [[ -n "${focused_tests}" ]]; then
  echo "Guardian: focused or skipped test detected."
  exit 1
fi

echo "Guardian: no focused or skipped tests."
