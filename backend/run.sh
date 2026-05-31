#!/usr/bin/env bash
# Boot the Skinalizer backend. Creates a venv on first run.
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d .venv ]; then
  echo "Creating virtualenv + installing deps (first run)…"
  python3 -m venv .venv
  ./.venv/bin/pip install --upgrade pip
  ./.venv/bin/pip install -r requirements.txt
fi

# Optional: plug in dermafyr's pretrained Keras model (needs tensorflow installed).
#   export SKINALIZER_KERAS_MODEL=../other-people-codes/dermafyr-main/backend/model/tf_model.keras
exec ./.venv/bin/uvicorn skinalizer.api.app:app --host 127.0.0.1 --port 8000 --reload
