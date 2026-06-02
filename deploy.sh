#!/usr/bin/env bash
# deploy.sh — single-command prod deploy for Trip.AI
#
# Run from the project root: ./deploy.sh
# Requires: wrangler logged in (`npx wrangler login`) and gh-pages configured
#
# Steps:
#   1. Apply pending D1 migrations to the remote database (idempotent —
#      only runs migrations that haven't been applied yet)
#   2. Deploy the Cloudflare Worker (tripai-api)
#   3. Build the frontend with the prod API base
#   4. Push the build/ folder to the gh-pages branch on origin
#
# After this script completes, you still need to set the prod secrets
# if they aren't already set:
#   cd worker
#   npx wrangler secret put OPENROUTER_API_KEY
#   npx wrangler secret put EXA_API_KEY
#   npx wrangler secret put JWT_SECRET
#   # optional, for real GitHub/Google sign-in:
#   npx wrangler secret put GITHUB_CLIENT_ID
#   npx wrangler secret put GITHUB_CLIENT_SECRET
#   npx wrangler secret put GOOGLE_CLIENT_ID
#   npx wrangler secret put GOOGLE_CLIENT_SECRET

set -euo pipefail

# Resolve the project root, regardless of where this script was invoked from.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

WRANGLER="$SCRIPT_DIR/node_modules/.bin/wrangler"
WORKER_DIR="$SCRIPT_DIR/worker"
WORKER_CONFIG="$WORKER_DIR/wrangler.toml"

echo "==> 1/4  Applying pending D1 migrations to remote"
(
  cd "$WORKER_DIR"
  "$WRANGLER" d1 migrations apply tripai-database --remote --config="$WORKER_CONFIG"
)

echo
echo "==> 2/4  Deploying Cloudflare Worker (production env)"
"$WRANGLER" deploy --env production --config="$WORKER_CONFIG"

echo
echo "==> 3/4  Building frontend"
npm run build

echo
echo "==> 4/4  Pushing build/ to gh-pages"
npx gh-pages -d build

echo
echo "=========================================="
echo "Deploy complete."
echo "  - Worker:    https://tripai-api.athuspydy.workers.dev"
echo "  - Frontend:  https://atharva2099.github.io/Trip.AI/"
echo "=========================================="
echo
echo "Next: set the prod secrets if you haven't already:"
echo "  # IMPORTANT: --env production + --config so the secret goes to tripai-api,"
echo "  # not the 'tripai' static-assets worker defined in the root wrangler.jsonc."
echo "  cd /Users/atharva/Desktop/Projects/Trip.AI"
echo "  printf '%s' \"\$sk-or-v1-...\" | ./node_modules/.bin/wrangler secret put OPENROUTER_API_KEY --config=./worker/wrangler.toml --env production"
echo "  printf '%s' \"\$exa-...\"         | ./node_modules/.bin/wrangler secret put EXA_API_KEY        --config=./worker/wrangler.toml --env production"
echo "  printf '%s' \"\$any-random\"     | ./node_modules/.bin/wrangler secret put JWT_SECRET         --config=./worker/wrangler.toml --env production"
