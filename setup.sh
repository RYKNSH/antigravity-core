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

# 2. Node.js チェック
echo ""
echo "🔍 Node.js チェック..."
if ! command -v node &> /dev/null; then
  echo "❌ Node.js が見つかりません"
  echo "   Node.js >= 18 をインストールしてください:"
  echo "   brew install node"
  echo ""
  echo "   インストール後、再度 setup.sh を実行してください"
  exit 1
fi

NODE_VERSION=$(node -v)
echo "✅ Node.js $NODE_VERSION"

# 3. .env setup
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

# 4. 依存関係インストール
echo ""
echo "📦 依存関係をインストール中..."

# Heartbeat daemon
if [ -f "$ANTIGRAVITY_DIR/heartbeat/package.json" ]; then
  echo "   → heartbeat..."
  cd "$ANTIGRAVITY_DIR/heartbeat" && npm install --silent 2>/dev/null
  if [ $? -eq 0 ]; then
    echo "   ✅ heartbeat 依存関係OK"
  else
    echo "   ⚠️  heartbeat npm install 失敗（後で手動実行: cd $ANTIGRAVITY_DIR/heartbeat && npm install）"
  fi
fi

# Checkpoint tool
if [ -f "$ANTIGRAVITY_DIR/agent/scripts/checkpoint/package.json" ]; then
  echo "   → checkpoint..."
  cd "$ANTIGRAVITY_DIR/agent/scripts/checkpoint" && npm install --silent 2>/dev/null
  if [ $? -eq 0 ]; then
    echo "   ✅ checkpoint 依存関係OK"
  else
    echo "   ⚠️  checkpoint npm install 失敗（後で手動実行: cd $ANTIGRAVITY_DIR/agent/scripts/checkpoint && npm install）"
  fi
fi

cd "$ANTIGRAVITY_DIR"

# 5. Summary
echo ""
echo "========================"
echo "✅ Antigravity 環境準備完了"
echo ""
echo "📂 $ANTIGRAVITY_DIR"
echo "   node:       $NODE_VERSION"
echo "   workflows:  $(ls "$ANTIGRAVITY_DIR/agent/workflows/" 2>/dev/null | wc -l | tr -d ' ') files"
echo "   skills:     $(ls "$ANTIGRAVITY_DIR/agent/skills/" 2>/dev/null | wc -l | tr -d ' ') files"
echo "   scripts:    $(ls "$ANTIGRAVITY_DIR/agent/scripts/" 2>/dev/null | wc -l | tr -d ' ') files"
echo "   knowledge:  $(ls "$ANTIGRAVITY_DIR/knowledge/" 2>/dev/null | wc -l | tr -d ' ') dirs"
echo ""
echo "🎯 次のステップ: Gemini Code Assist で /go を実行"
