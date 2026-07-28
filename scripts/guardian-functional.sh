#!/usr/bin/env bash

set -euo pipefail

echo "Guardian functional: running business and foundation contracts"
npm run test:functional
echo "Guardian functional: running database behavior contracts"
./scripts/check-database-behavior.sh
echo "Guardian functional: passed"
