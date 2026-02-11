#!/bin/bash
# Antigravity Bootstrap - 新マシンへの環境展開
# Usage: curl -sL https://raw.githubusercontent.com/RYKNSH/antigravity-core/main/setup.sh | bash

set -e

ANTIGRAVITY_DIR="$HOME/.antigravity"
REPO_URL="https://github.com/RYKNSH/antigravity-core.git"

echo "🚀 Antigravity Bootstrap"
echo "========================"

# 1. Clone or Pull
if [ -d "$ANTIGRAVITY_DIR/.git" ]; then
  echo "📥 既存のAntigravityを更新中..."
  cd "$ANTIGRAVITY_DIR"
  git pull origin main
  echo "✅ 更新完了"
else
  if [ -d "$ANTIGRAVITY_DIR" ]; then
    echo "⚠️  $ANTIGRAVITY_DIR が存在しますがgitリポジトリではありません"
    echo "   バックアップして再作成します..."
    mv "$ANTIGRAVITY_DIR" "${ANTIGRAVITY_DIR}.bak.$(date +%Y%m%d%H%M)"
  fi
  echo "📥 Antigravityをクローン中..."
  git clone "$REPO_URL" "$ANTIGRAVITY_DIR"
  echo "✅ クローン完了"
fi

# 2. .env setup
if [ ! -f "$ANTIGRAVITY_DIR/.env" ]; then
  echo ""
  echo "⚠️  .env ファイルが見つかりません"
  echo "   SSD版からコピーするか、手動で作成してください:"
  echo ""
  echo "   cp /Volumes/PortableSSD/.antigravity/.env $ANTIGRAVITY_DIR/.env"
  echo ""
  echo "   必要なキー:"
  echo "   - NOTION_API_KEY"
  echo "   - NOTION_DATABASE_ID"
  echo "   - DISCORD_WEBHOOK_URL"
  echo "   - GOOGLE_API_KEY / GEMINI_API_KEY"
  echo "   - ANTHROPIC_API_KEY"
  echo "   - OPENAI_API_KEY"
  echo "   - DISCORD_BOT_TOKEN"
else
  echo "✅ .env 存在確認OK"
fi

# 3. Summary
echo ""
echo "========================"
echo "✅ Antigravity 環境準備完了"
echo ""
echo "📂 $ANTIGRAVITY_DIR"
echo "   workflows:  $(ls "$ANTIGRAVITY_DIR/agent/workflows/" 2>/dev/null | wc -l | tr -d ' ') files"
echo "   skills:     $(ls "$ANTIGRAVITY_DIR/agent/skills/" 2>/dev/null | wc -l | tr -d ' ') files"
echo "   scripts:    $(ls "$ANTIGRAVITY_DIR/agent/scripts/" 2>/dev/null | wc -l | tr -d ' ') files"
echo "   knowledge:  $(ls "$ANTIGRAVITY_DIR/knowledge/" 2>/dev/null | wc -l | tr -d ' ') dirs"
echo ""
echo "🎯 次のステップ: Gemini Code Assist で /go を実行"
