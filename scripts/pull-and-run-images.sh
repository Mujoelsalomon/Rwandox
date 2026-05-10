#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/pull-and-run-images.sh [REGISTRY_OWNER]
# Example: REGISTRY_OWNER=ghcr.io ./scripts/pull-and-run-images.sh

REG_OWNER=${1:-ghcr.io/${USER}}

echo "Pulling images from ${REG_OWNER}..."
podman pull "${REG_OWNER}/oxygen-predictor-api:latest"
podman pull "${REG_OWNER}/oxygen-predictor-frontend:latest"

echo "Starting services using remote images..."
podman compose -f backend/podman-compose.yml -f backend/podman-compose.remote.yml up --detach

podman ps --all --format "table {{.Names}}\t{{.ID}}\t{{.Status}}\t{{.Ports}}"
