#!/usr/bin/env bash

set -euo pipefail

echo "Guardian static: checking file sizes"
node scripts/check-file-lengths.mjs

echo "Guardian static: checking staged files"
./scripts/check-staged-files.sh

echo "Guardian static: checking TypeScript"
npm run typecheck

echo "Guardian static: checking ESLint"
npm run lint

echo "Guardian static: checking formatting"
npm run format:check

echo "Guardian static: checking migrations"
./scripts/check-migrations.sh

echo "Guardian static: checking focused tests"
./scripts/check-tests.sh

echo "Guardian static: passed"
