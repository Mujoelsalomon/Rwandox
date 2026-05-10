#!/usr/bin/env bash
set -euo pipefail

# Try to start podman machine if present (for macOS/Windows setups)
if command -v podman >/dev/null 2>&1; then
  podman machine start 2>/dev/null || true
  podman compose -f backend/podman-compose.yml up --build "${@-}"
else
  echo "podman not found. Install Podman first." >&2
  exit 1
fi
