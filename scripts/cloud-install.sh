#!/usr/bin/env bash
set -euo pipefail
cd /workspace/-
export npm_config_cache=/workspace/.npm
node -e 'const [major,minor]=process.versions.node.split(".").map(Number); if(major<22||(major===22&&minor<12)) throw new Error("Node.js 22.12+ required")'
npm ci --no-audit --no-fund
npm run tokens:check
npm run build
npm run test
