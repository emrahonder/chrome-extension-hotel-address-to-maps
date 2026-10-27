#!/bin/sh
# Packages the extension for Chrome Web Store upload: dist/<name>-<version>.zip
set -e
cd "$(dirname "$0")"
VERSION=$(python3 -c "import json; print(json.load(open('manifest.json'))['version'])")
OUT="dist/hotel-address-to-maps-$VERSION.zip"
mkdir -p dist
rm -f "$OUT"
zip -qr "$OUT" manifest.json content.js styles.css _locales icons -x "icons/logo.svg" "*.DS_Store"
echo "$OUT"
