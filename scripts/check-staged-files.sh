#!/usr/bin/env bash

set -euo pipefail

staged_files="$(git diff --cached --name-only --diff-filter=ACMR)"

if [[ -z "${staged_files}" ]]; then
  echo "Guardian: no staged files require safety inspection."
  exit 0
fi

if grep -Ev '(^|/)\.env\.example$' <<<"${staged_files}" |
  grep -Eq '(^|/)\.env($|\.)|(^|/)(\.next|coverage|out)/'; then
  echo "Guardian: staged secrets or generated output detected."
  exit 1
fi

if git diff --cached --no-ext-diff --unified=0 |
  grep -E '^\+[^+]' |
  grep -E '((OPENAI_API_KEY|SUPABASE_SERVICE_ROLE_KEY)[[:space:]]*=[[:space:]]*["'\'']?[A-Za-z0-9_./+-]{16}|(OPENAI_API_KEY|SUPABASE_SERVICE_ROLE_KEY)[[:space:]]*:[[:space:]]*["'\''][A-Za-z0-9_./+-]{16}|BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY)' >/dev/null; then
  echo "Guardian: staged content resembles a secret."
  exit 1
fi

echo "Guardian: staged-file safety checks passed."
