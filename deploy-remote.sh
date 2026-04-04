#!/usr/bin/env bash
# Deploy dashboard to remote Node-RED (e.g. http://smartiotcloud.io:40317/)
# 1. Set REMOTE_USER and REMOTE_PATH below (and REMOTE_HOST if different).
# 2. Run: ./deploy-remote.sh   or   bash deploy-remote.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# --- Configure for your server ---
REMOTE_HOST="${DEPLOY_HOST:-smartiotcloud.io}"
REMOTE_USER="${DEPLOY_USER:-}"   # e.g. ubuntu, root, or your username
REMOTE_PATH="${DEPLOY_PATH:-}"  # e.g. .node-red/uibuilder/drone-map/src/

if [ -z "$REMOTE_USER" ] || [ -z "$REMOTE_PATH" ]; then
  echo "Set DEPLOY_USER and DEPLOY_PATH (or edit this script)."
  echo "Example:"
  echo "  export DEPLOY_USER=ubuntu"
  echo "  export DEPLOY_PATH=.node-red/uibuilder/drone-map/src/"
  echo "  ./deploy-remote.sh"
  echo "Or one line: DEPLOY_USER=ubuntu DEPLOY_PATH=.node-red/uibuilder/drone-map/src/ ./deploy-remote.sh"
  exit 1
fi

echo "==> Building..."
npm run build:uibuilder

echo "==> Uploading to ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}"
rsync -avz --delete out/ "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/"

echo "==> Done. Open: http://${REMOTE_HOST}:40317/drone-map"
