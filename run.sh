#!/usr/bin/env bash
# Skinalizer launcher for macOS / Linux. Delegates to the cross-platform run.py.
# Usage: ./run.sh [setup|backend|frontend]
set -e
cd "$(dirname "$0")"
exec python3 run.py "$@"
