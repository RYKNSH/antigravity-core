#!/bin/bash
# Antigravity Bootstrap - 新マシンへの環境展開
# Usage: curl -sL https://raw.githubusercontent.com/RYKNSH/antigravity-core/main/setup.sh | bash
#
# 2リポ構成:
#   antigravity-core    (public)  → OSS ワークフロー・スクリプト・スキル
#   antigravity-private (private) → 個人シークレット・ブログ・セッション履歴
#
# setup.shが両方pullして自動接続する。

set -e

ANTIGRAVITY_DIR="$HOME/.antigravity"
PRIVATE_DIR="$HOME/.antigravity-private"
GEMINI_DIR="$HOME/.gemini/antigravity"
CORE_REPO="https://github.com/RYKNSH/antigravity-core.git"
PRIVATE_REPO="https://github.com/RYKNSH/antigravity-private.git"

echo "🚀 Antigravity Bootstrap"
echo "========================"

# =============================================
# Phase 1: OSS Core (public)
# =============================================
echo ""
echo "📥 Phase 1: OSS Core 同期"

if [ -d "$ANTIGRAVITY_DIR/.git" ]; then
  echo "   既存のAntigravityを更新中..."
  cd "$ANTIGRAVITY_DIR"
  git pull origin main 2>/dev/null && echo "   ✅ GitHub pull 完了" || echo "   ⚠️ GitHub pull 失敗（オフライン？）"
else
  if [ -d "$ANTIGRAVITY_DIR" ]; then
    mv "$ANTIGRAVITY_DIR" "${ANTIGRAVITY_DIR}.bak.$(date +%Y%m%d%H%M)"
  fi
  git clone "$CORE_REPO" "$ANTIGRAVITY_DIR"
  echo "   ✅ クローン完了"
fi

# =============================================
# Phase 2: Personal Config (private)
# =============================================
echo ""
echo "🔑 Phase 2: 個人設定 同期"

if [ -d "$PRIVATE_DIR/.git" ]; then
  echo "   既存の個人設定を更新中..."
  cd "$PRIVATE_DIR"
  git pull origin main 2>/dev/null && echo "   ✅ Private pull 完了" || echo "   ⚠️ Private pull 失敗"
else
  echo "   個人設定をクローン中..."
  git clone "$PRIVATE_REPO" "$PRIVATE_DIR" 2>/dev/null
  if [ $? -eq 0 ]; then
    echo "   ✅ クローン完了"
  else
    echo "   ⚠️ Private repoにアクセスできません（権限確認してください）"
    echo "   → スキップして OSS版のみセットアップします"
  fi
fi

# =============================================
# Phase 3: 自動接続（Private → Core に接続）
# =============================================
echo ""
echo "🔗 Phase 3: 自動接続"

if [ -d "$PRIVATE_DIR" ]; then
  # mcp_config.json
  [ -f "$PRIVATE_DIR/mcp_config.json" ] && \
    cp "$PRIVATE_DIR/mcp_config.json" "$ANTIGRAVITY_DIR/mcp_config.json" && \
    echo "   ✅ mcp_config.json 接続"

  # .env
  [ -f "$PRIVATE_DIR/.env" ] && \
    cp "$PRIVATE_DIR/.env" "$ANTIGRAVITY_DIR/.env" && \
    echo "   ✅ .env 接続"

  # blogs/
  [ -d "$PRIVATE_DIR/blogs" ] && \
    rsync -a --update "$PRIVATE_DIR/blogs/" "$ANTIGRAVITY_DIR/blogs/" && \
    echo "   ✅ blogs/ 接続 ($(ls "$ANTIGRAVITY_DIR/blogs/"*.md 2>/dev/null | wc -l | tr -d ' ') 記事)"

  # brain_log/
  [ -d "$PRIVATE_DIR/brain_log" ] && \
    rsync -a --update "$PRIVATE_DIR/brain_log/" "$ANTIGRAVITY_DIR/brain_log/" && \
    echo "   ✅ brain_log/ 接続 ($(ls "$ANTIGRAVITY_DIR/brain_log/"*.md 2>/dev/null | wc -l | tr -d ' ') セッション)"

  # NEXT_SESSION.md
  [ -f "$PRIVATE_DIR/NEXT_SESSION.md" ] && \
    cp "$PRIVATE_DIR/NEXT_SESSION.md" "$ANTIGRAVITY_DIR/NEXT_SESSION.md" && \
    echo "   ✅ NEXT_SESSION.md 接続"

  # credentials/
  [ -d "$PRIVATE_DIR/credentials" ] && \
    rsync -a --update "$PRIVATE_DIR/credentials/" "$ANTIGRAVITY_DIR/credentials/" && \
    echo "   ✅ credentials/ 接続"
else
  echo "   ⚠️ Private repoなし — OSS版のみ（各自のトークンを設定してください）"
  echo "   → cp $ANTIGRAVITY_DIR/mcp_config.json.example $ANTIGRAVITY_DIR/mcp_config.json"
  echo "   → 各トークンを設定"
fi

# =============================================
# Phase 4: Gemini Code Assist 同期
# =============================================
echo ""
echo "📦 Phase 4: Gemini Code Assist 同期"

mkdir -p "$GEMINI_DIR/.agent/workflows"
mkdir -p "$GEMINI_DIR/.agent/scripts"
mkdir -p "$GEMINI_DIR/.agent/skills"
mkdir -p "$GEMINI_DIR/.agent/rules"

rsync -a --update "$ANTIGRAVITY_DIR/agent/workflows/" "$GEMINI_DIR/.agent/workflows/"
echo "   ✅ ワークフロー: $(ls "$GEMINI_DIR/.agent/workflows/"*.md 2>/dev/null | wc -l | tr -d ' ') 個"

rsync -a --update "$ANTIGRAVITY_DIR/agent/scripts/" "$GEMINI_DIR/.agent/scripts/"
echo "   ✅ スクリプト: $(ls "$GEMINI_DIR/.agent/scripts/"*.js 2>/dev/null | wc -l | tr -d ' ') 個"

rsync -a --update "$ANTIGRAVITY_DIR/agent/skills/" "$GEMINI_DIR/.agent/skills/"
echo "   ✅ スキル: $(ls -d "$GEMINI_DIR/.agent/skills/"*/ 2>/dev/null | wc -l | tr -d ' ') 個"

rsync -a --update "$ANTIGRAVITY_DIR/agent/rules/" "$GEMINI_DIR/.agent/rules/"
echo "   ✅ ルール: $(ls "$GEMINI_DIR/.agent/rules/"*.md 2>/dev/null | wc -l | tr -d ' ') 個"

# knowledge
if [ -L "$GEMINI_DIR/knowledge" ]; then rm "$GEMINI_DIR/knowledge"; fi
rsync -a --update "$ANTIGRAVITY_DIR/knowledge/" "$GEMINI_DIR/knowledge/"
echo "   ✅ knowledge: $(ls -d "$GEMINI_DIR/knowledge/"*/ 2>/dev/null | wc -l | tr -d ' ') 個"

# mcp_config.json → Gemini
[ -f "$ANTIGRAVITY_DIR/mcp_config.json" ] && \
  cp "$ANTIGRAVITY_DIR/mcp_config.json" "$GEMINI_DIR/mcp_config.json" && \
  echo "   ✅ mcp_config.json → Gemini"

# =============================================
# Phase 5: GEMINI.md セットアップ
# =============================================
echo ""
echo "📝 Phase 5: GEMINI.md"

GEMINI_MASTER="$ANTIGRAVITY_DIR/agent/rules/GEMINI.md.master"
GEMINI_LOCAL="$HOME/.gemini/GEMINI.md"

if [ -f "$GEMINI_MASTER" ]; then
  cp "$GEMINI_MASTER" "$GEMINI_LOCAL"
  echo "   ✅ GEMINI.md 同期完了"
fi

# =============================================
# Phase 6: 依存関係
# =============================================
echo ""
echo "📦 Phase 6: 依存関係"

if ! command -v node &> /dev/null; then
  echo "   ⚠️ Node.js が見つかりません (brew install node)"
else
  echo "   ✅ Node.js $(node -v)"
fi

[ -f "$ANTIGRAVITY_DIR/heartbeat/package.json" ] && \
  cd "$ANTIGRAVITY_DIR/heartbeat" && npm install --silent 2>/dev/null && echo "   ✅ heartbeat OK"

[ -f "$ANTIGRAVITY_DIR/agent/scripts/checkpoint/package.json" ] && \
  cd "$ANTIGRAVITY_DIR/agent/scripts/checkpoint" && npm install --silent 2>/dev/null && echo "   ✅ checkpoint OK"

# =============================================
# Summary
# =============================================
cd "$ANTIGRAVITY_DIR"

WF_COUNT=$(ls "$GEMINI_DIR/.agent/workflows/"*.md 2>/dev/null | wc -l | tr -d ' ')
SC_COUNT=$(ls "$GEMINI_DIR/.agent/scripts/"*.js 2>/dev/null | wc -l | tr -d ' ')
SK_COUNT=$(ls -d "$GEMINI_DIR/.agent/skills/"*/ 2>/dev/null | wc -l | tr -d ' ')
KN_COUNT=$(ls -d "$GEMINI_DIR/knowledge/"*/ 2>/dev/null | wc -l | tr -d ' ')

echo ""
echo "╔═══════════════════════════════════════════════╗"
echo "║  ✅ Antigravity 環境準備完了                   ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""
echo "📂 $ANTIGRAVITY_DIR (OSS Core)"
if [ -d "$PRIVATE_DIR" ]; then
  echo "📂 $PRIVATE_DIR (Personal)"
fi
echo "📂 $GEMINI_DIR (Gemini Code Assist)"
echo ""
echo "   workflows:  $WF_COUNT"
echo "   scripts:    $SC_COUNT"
echo "   skills:     $SK_COUNT"
echo "   knowledge:  $KN_COUNT"
echo ""
echo "🎯 次のステップ: Gemini Code Assist で /go を実行"
