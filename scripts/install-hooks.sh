#!/usr/bin/env bash

set -euo pipefail

git config core.hooksPath .githooks
echo "Guardian pre-commit hook installed from .githooks."
