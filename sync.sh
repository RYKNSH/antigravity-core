#!/bin/bash
# Antigravity Sync Script
# Bidirectional sync between local and GitHub

set -e

cd "$ANTIGRAVITY_DIR"

echo "🔄 Antigravity Sync"
echo ""

# 1. ローカルの変更をチェック
if [ -n "$(git status --porcelain)" ]; then
  echo "📝 Local changes detected"
  git status --short
  echo ""
  read -p "Commit and push? (y/n): " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    git add -A
    read -p "Commit message: " commit_msg
    git commit -m "${commit_msg:-auto-sync: $(date +%Y-%m-%d_%H%M)}"
    git push origin main
    echo "✅ Pushed to GitHub"
  fi
else
  echo "✅ No local changes"
fi

# 2. GitHubから最新を取得
echo ""
echo "📥 Pulling from GitHub..."
git pull origin main

# 3. ローカルプロジェクトへの同期
echo ""
echo "📋 Syncing to local projects..."
find ~/Desktop ~/Documents -maxdepth 2 -name ".agent" -type d 2>/dev/null | while read agent_dir; do
  project_dir=$(dirname "$agent_dir")
  echo "  → $(basename $project_dir)"
  rsync -a --update "$ANTIGRAVITY_DIR/agent/workflows/" "$agent_dir/workflows/"
  rsync -a --update "$ANTIGRAVITY_DIR/agent/skills/" "$agent_dir/skills/"
done

echo ""
echo "✅ Sync complete!"
