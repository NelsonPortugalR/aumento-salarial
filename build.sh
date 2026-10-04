#!/bin/bash
set -e
cd "$(dirname "$0")"
OUT=./pidelo-bien.html
{ cat 01_head.html 02_body.html; echo '<script>'; cat 10_data.js 15_bands.js 20_engine.js 30_kit.js 40_ui.js 50_ai.js; echo '</script>'; echo '</body>'; echo '</html>'; } > "$OUT"
# syntax check of the script
{ cat 10_data.js 15_bands.js 20_engine.js 30_kit.js 40_ui.js 50_ai.js; } > "${TMPDIR:-/tmp}/pidelo-all.js"
node --check "${TMPDIR:-/tmp}/pidelo-all.js" && echo "SYNTAX OK"
wc -c "$OUT"
# Versión para publicar como artefacto de claude.ai: sin doctype/html/head/body (los pone la plataforma)
mkdir -p dist
sed -e '/^<!doctype html>$/d' -e '/^<html lang=/d' -e '/^<head>$/d' -e '/^<\/head>$/d' -e '/^<body>$/d' -e '/^<\/body>$/d' -e '/^<\/html>$/d' \
    -e '/^<meta charset=/d' -e '/^<meta name="viewport"/d' \
    -e 's#<title>.*</title>#<title>Pídelo Bien</title>#' "$OUT" > dist/pidelo-bien-artifact.html
