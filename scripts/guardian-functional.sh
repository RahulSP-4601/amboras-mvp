#!/usr/bin/env bash

set -euo pipefail

echo "Guardian functional: running business and foundation contracts"
npm run test:functional
echo "Guardian functional: passed"
