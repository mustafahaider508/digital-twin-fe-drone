#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

SRC_TWINS="src/app/twins"
BAK_TWINS="src/app/_twins_excluded"

echo "==> Temporarily excluding dynamic routes..."
[ -d "$SRC_TWINS" ] && mv "$SRC_TWINS" "$BAK_TWINS"

echo "==> Building static export (dashboard at root for Node-RED)..."
NEXT_EXPORT=1 NEXT_PUBLIC_UIBUILDER_ENTRY=dashboard npx next build

echo "==> Restoring dynamic routes..."
[ -d "$BAK_TWINS" ] && mv "$BAK_TWINS" "$SRC_TWINS"

echo ""
echo "====================================="
echo " Static export ready in:  out/"
echo " Dashboard at root:       http://localhost:1880/drone-map"
echo "====================================="
echo ""
echo "Copy the entire 'out/' folder contents into your"
echo "uibuilder instance src/ directory, e.g.:"
echo ""
echo "  cp -r out/* ~/.node-red/uibuilder/drone-map/src/"
echo ""
