#!/bin/bash
# One-shot setup helper (not a server). Installs a few deps and runs the static checks.
cd "$HOME/gits/amplifi-quotes" || exit 1
npm install --no-audit --no-fund --save-exact xss@1.0.15 fflate@0.8.2 2>&1 | tail -1
npm install -D --no-audit --no-fund --save-exact @axe-core/playwright 2>&1 | tail -1
./node_modules/.bin/vite build 2>&1 | tail -4
./node_modules/.bin/biome check . 2>&1 | tail -15
