#!/bin/bash

# publish.sh — commit and push all changes to GitHub
cd "$(dirname "$0")"

echo "📦 Staging changes..."
git add .

# Check if there's anything to commit
if git diff --cached --quiet; then
  echo "✅ Nothing to commit — site is already up to date."
  exit 0
fi

# Use a timestamp commit message by default, or accept a custom one
MESSAGE="${1:-Update site $(date '+%Y-%m-%d %H:%M')}"

echo "💬 Committing: $MESSAGE"
git commit -m "$MESSAGE"

echo "🚀 Pushing to GitHub..."
if git push origin main; then
  echo "✅ Done! Changes are live."
else
  echo "❌ Push failed. Check the error above."
  exit 1
fi
