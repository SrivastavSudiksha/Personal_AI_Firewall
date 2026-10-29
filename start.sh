#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
export PYTHONPATH=.
echo "Shihezu API on :8000"
exec uvicorn src.api.main:app --host 0.0.0.0 --port 8000 --reload
