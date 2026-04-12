#!/usr/bin/env bash
# deploy.sh — one-shot script to git-init and deploy 20Tile to Vercel
# Run from the project root:  bash deploy.sh

set -e
cd "$(dirname "$0")"

echo ""
echo "=== 20Tile Deploy Script ==="
echo ""

# ── Step 1: Git ──────────────────────────────────────────────────────────────
if [ ! -d ".git" ]; then
  echo "→ Initialising git repository..."
  git init
  git branch -m main
else
  echo "→ Git repository already exists, skipping init."
fi

echo "→ Staging all files..."
git add .

# Only commit if there is something to commit
if git diff --cached --quiet; then
  echo "→ Nothing new to commit."
else
  echo "→ Committing..."
  git commit -m "initial commit"
fi

# ── Step 2 & 3: Deploy via npx (no global install needed) ───────────────────
echo ""
echo "→ Starting Vercel deployment via npx..."
echo "   (A browser window will open to log in if you are not already authenticated.)"
echo "   When prompted:"
echo "     - Set up and deploy: Y"
echo "     - Which scope: choose your personal account"
echo "     - Link to existing project: N  (first deploy)"
echo "     - Project name: 20tile  (or press Enter for the default)"
echo "     - In which directory is your code located: ./  (press Enter)"
echo ""

npx vercel

echo ""
echo "=== Deploy complete! ==="
echo "Run  'vercel --prod'  to promote this build to your production URL."
