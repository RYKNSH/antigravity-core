#!/bin/bash
# Antigravity Bootstrap - 新マシンへの環境展開
# Usage: curl -sL https://raw.githubusercontent.com/RYKNSH/antigravity-core/main/setup.sh | bash
#
# やること:
# 1. GitHubから~/.antigravityにclone (or pull)
# 2. ~/.gemini/antigravity/.agent/ にワークフロー・スクリプト・スキル・ルールを同期
# 3. knowledge, mcp_config.json等をコピー
# 4. GEMINI.md をセットアップ
# 5. 依存関係インストール

set -e

ANTIGRAVITY_DIR="$HOME/.antigravity"
GEMINI_DIR="$HOME/.gemini/antigravity"
REPO_URL="https://github.com/RYKNSH/antigravity-core.git"

echo "🚀 Antigravity Bootstrap"
echo "========================"

# =============================================
# Phase 1: GitHub Clone or Pull
# =============================================
echo ""
echo "📥 Phase 1: GitHub同期"

if [ -d "$ANTIGRAVITY_DIR/.git" ]; then
  echo "   既存のAntigravityを更新中..."
  cd "$ANTIGRAVITY_DIR"
  git pull origin main 2>/dev/null && echo "   ✅ GitHub pull 完了" || echo "   ⚠️ GitHub pull 失敗（オフライン？）"
else
  if [ -d "$ANTIGRAVITY_DIR" ]; then
    echo "   ⚠️ $ANTIGRAVITY_DIR が存在しますがgitリポジトリではありません"
    echo "   バックアップして再作成します..."
    mv "$ANTIGRAVITY_DIR" "${ANTIGRAVITY_DIR}.bak.$(date +%Y%m%d%H%M)"
  fi
  echo "   クローン中..."
  git clone "$REPO_URL" "$ANTIGRAVITY_DIR"
  echo "   ✅ クローン完了"
fi

# =============================================
# Phase 2: Gemini Code Assist 同期
# =============================================
echo ""
echo "🔗 Phase 2: Gemini Code Assist 同期"

# ディレクトリ作成
mkdir -p "$GEMINI_DIR/.agent/workflows"
mkdir -p "$GEMINI_DIR/.agent/scripts"
mkdir -p "$GEMINI_DIR/.agent/skills"
mkdir -p "$GEMINI_DIR/.agent/rules"

# ワークフロー同期（ローカルカスタマイズ保護）
echo "   → ワークフロー同期..."
rsync -a --update "$ANTIGRAVITY_DIR/agent/workflows/" "$GEMINI_DIR/.agent/workflows/"
WF_COUNT=$(ls "$GEMINI_DIR/.agent/workflows/"*.md 2>/dev/null | wc -l | tr -d ' ')
echo "   ✅ ワークフロー: $WF_COUNT 個"

# スクリプト同期
echo "   → スクリプト同期..."
rsync -a --update "$ANTIGRAVITY_DIR/agent/scripts/" "$GEMINI_DIR/.agent/scripts/"
SC_COUNT=$(ls "$GEMINI_DIR/.agent/scripts/"*.js 2>/dev/null | wc -l | tr -d ' ')
echo "   ✅ スクリプト: $SC_COUNT 個"

# スキル同期
echo "   → スキル同期..."
rsync -a --update "$ANTIGRAVITY_DIR/agent/skills/" "$GEMINI_DIR/.agent/skills/"
SK_COUNT=$(ls -d "$GEMINI_DIR/.agent/skills/"*/ 2>/dev/null | wc -l | tr -d ' ')
echo "   ✅ スキル: $SK_COUNT 個"

# ルール同期
echo "   → ルール同期..."
rsync -a --update "$ANTIGRAVITY_DIR/agent/rules/" "$GEMINI_DIR/.agent/rules/"
RULE_COUNT=$(ls "$GEMINI_DIR/.agent/rules/"*.md 2>/dev/null | wc -l | tr -d ' ')
echo "   ✅ ルール: $RULE_COUNT 個"

# knowledge 同期
echo "   → knowledge同期..."
if [ -L "$GEMINI_DIR/knowledge" ]; then
  echo "   ⚠️ knowledgeがシンボリックリンクです。実体に置換..."
  rm "$GEMINI_DIR/knowledge"
fi
rsync -a --update "$ANTIGRAVITY_DIR/knowledge/" "$GEMINI_DIR/knowledge/"
KN_COUNT=$(ls -d "$GEMINI_DIR/knowledge/"*/ 2>/dev/null | wc -l | tr -d ' ')
echo "   ✅ knowledge: $KN_COUNT 個"

# mcp_config.json 同期
echo "   → mcp_config.json同期..."
if [ -L "$GEMINI_DIR/mcp_config.json" ]; then
  rm "$GEMINI_DIR/mcp_config.json"
fi
cp "$ANTIGRAVITY_DIR/mcp_config.json" "$GEMINI_DIR/mcp_config.json" 2>/dev/null && \
  sed -i '' "s|~/|$HOME/|g" "$GEMINI_DIR/mcp_config.json" 2>/dev/null && \
  echo "   ✅ mcp_config.json 同期完了" || echo "   ⚠️ mcp_config.json 未検出"

# =============================================
# Phase 3: GEMINI.md セットアップ
# =============================================
echo ""
echo "📝 Phase 3: GEMINI.md セットアップ"

GEMINI_MASTER="$ANTIGRAVITY_DIR/agent/rules/GEMINI.md.master"
GEMINI_LOCAL="$HOME/.gemini/GEMINI.md"

if [ -f "$GEMINI_MASTER" ]; then
  if [ -f "$GEMINI_LOCAL" ]; then
    if ! diff -q "$GEMINI_LOCAL" "$GEMINI_MASTER" > /dev/null 2>&1; then
      echo "   ⚠️ ローカルGEMINI.mdとmasterに差分あり"
      echo "   masterで上書きします..."
    fi
  fi
  cp "$GEMINI_MASTER" "$GEMINI_LOCAL"
  echo "   ✅ GEMINI.md 同期完了"
else
  echo "   ⚠️ GEMINI.md.master が見つかりません"
fi

# =============================================
# Phase 4: Node.js チェック
# =============================================
echo ""
echo "🔍 Phase 4: Node.js チェック"

if ! command -v node &> /dev/null; then
  echo "   ❌ Node.js が見つかりません"
  echo "   brew install node でインストールしてください"
else
  NODE_VERSION=$(node -v)
  echo "   ✅ Node.js $NODE_VERSION"
fi

# =============================================
# Phase 5: 依存関係インストール
# =============================================
echo ""
echo "📦 Phase 5: 依存関係"

# Heartbeat daemon
if [ -f "$ANTIGRAVITY_DIR/heartbeat/package.json" ]; then
  echo "   → heartbeat..."
  cd "$ANTIGRAVITY_DIR/heartbeat" && npm install --silent 2>/dev/null && \
    echo "   ✅ heartbeat OK" || echo "   ⚠️ heartbeat npm install 失敗"
fi

# Checkpoint tool
if [ -f "$ANTIGRAVITY_DIR/agent/scripts/checkpoint/package.json" ]; then
  echo "   → checkpoint..."
  cd "$ANTIGRAVITY_DIR/agent/scripts/checkpoint" && npm install --silent 2>/dev/null && \
    echo "   ✅ checkpoint OK" || echo "   ⚠️ checkpoint npm install 失敗"
fi

# =============================================
# Phase 6: .env チェック
# =============================================
echo ""
echo "🔑 Phase 6: シークレット確認"

if [ ! -f "$ANTIGRAVITY_DIR/.env" ]; then
  echo "   ⚠️ .env ファイルがありません"
  echo "   必要なキー:"
  echo "   - NOTION_API_KEY"
  echo "   - NOTION_DATABASE_ID"
  echo "   - DISCORD_WEBHOOK_URL"
  echo "   - GOOGLE_API_KEY / GEMINI_API_KEY"
  echo "   - ANTHROPIC_API_KEY"
  echo "   - OPENAI_API_KEY"
else
  echo "   ✅ .env 存在確認OK"
fi

# gdrive credentials
mkdir -p ~/.secrets/antigravity/gdrive
if [ -d "$ANTIGRAVITY_DIR/credentials" ]; then
  cp "$ANTIGRAVITY_DIR/credentials/credentials.json" ~/.secrets/antigravity/gdrive/gcp-oauth.keys.json 2>/dev/null && \
  cp "$ANTIGRAVITY_DIR/credentials/.gdrive-server-credentials.json" ~/.secrets/antigravity/gdrive/.gdrive-server-credentials.json 2>/dev/null && \
  echo "   ✅ gdrive credentials 同期完了" || echo "   ⚠️ gdrive credentials 未検出"
fi

cd "$ANTIGRAVITY_DIR"

# =============================================
# Summary
# =============================================
echo ""
echo "╔═══════════════════════════════════════════════╗"
echo "║  ✅ Antigravity 環境準備完了                   ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""
echo "📂 $ANTIGRAVITY_DIR (GitHub sync)"
echo "📂 $GEMINI_DIR (Gemini Code Assist)"
echo ""
echo "   workflows:  $WF_COUNT"
echo "   scripts:    $SC_COUNT"
echo "   skills:     $SK_COUNT"
echo "   rules:      $RULE_COUNT"
echo "   knowledge:  $KN_COUNT"
echo ""
echo "🎯 次のステップ: Gemini Code Assist で /go を実行"
