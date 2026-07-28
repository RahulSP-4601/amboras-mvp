#!/usr/bin/env bash

set -euo pipefail

echo "Guardian: static gate"
./scripts/guardian-static.sh

echo "Guardian: functional gate"
./scripts/guardian-functional.sh

echo "Guardian: all gates passed"
