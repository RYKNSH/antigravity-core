#!/bin/bash
set -e

# verify_core.sh — Antigravity Core 実態検証スクリプト v2
# 「主張された機能」と「実在する機能」の乖離を検知する。
# checkin時に自動実行。嘘を構造的に防ぐ。

CORE_DIR="${ANTIGRAVITY_DIR:-$HOME/.antigravity}"
ERRORS=0
WARNINGS=0

warn() { echo "⚠️  WARNING: $1"; WARNINGS=$((WARNINGS + 1)); }
fail() { echo "❌ FAIL: $1"; ERRORS=$((ERRORS + 1)); }
pass() { echo "✅ $1"; }

echo "🔍 Core Reality Check v2"
echo "========================"

# ── 1. 必須ファイル存在確認 ──
echo ""
echo "📂 [1/5] 必須ファイル"
REQUIRED=(
    "agent/workflows/WORKFLOW_ROUTER.md"
    "agent/workflows/WORKFLOW_CONTRACTS.md"
    "agent/workflows/go.md"
    "agent/workflows/checkin.md"
    "agent/workflows/checkout.md"
    "agent/workflows/verify.md"
    "agent/rules/user_global.md"
    "agent/rules/safe-commands.md"
    "agent/rules/code-standards.md"
    "agent/scripts/git_context.js"
    "agent/scripts/session_state.js"
    "DECISION_USECASES.md"
    "data_graph.json"
    "dependency_map.json"
)
for f in "${REQUIRED[@]}"; do
    [ -f "$CORE_DIR/$f" ] && pass "$f" || fail "Missing: $f"
done

# ── 2. スクリプト構文チェック ──
echo ""
echo "🧪 [2/5] スクリプト構文"
JS_ERRORS=0
for f in "$CORE_DIR/agent/scripts/"*.js; do
    [ -f "$f" ] || continue
    if ! node --check "$f" 2>/dev/null; then
        fail "Syntax error: $(basename "$f")"
        JS_ERRORS=$((JS_ERRORS + 1))
    fi
done
SH_ERRORS=0
for f in "$CORE_DIR/agent/scripts/"*.sh; do
    [ -f "$f" ] || continue
    if ! bash -n "$f" 2>/dev/null; then
        fail "Syntax error: $(basename "$f")"
        SH_ERRORS=$((SH_ERRORS + 1))
    fi
done
[ $JS_ERRORS -eq 0 ] && [ $SH_ERRORS -eq 0 ] && pass "全スクリプト構文OK"

# ── 3. 嘘検知: 「存在するが機能していない」パターン ──
echo ""
echo "🔎 [3/5] 嘘検知 (存在するが未稼働)"

# daemon.js がまだ agent/core にあったら警告
[ -f "$CORE_DIR/agent/core/daemon.js" ] && warn "daemon.js が agent/core/ に残存（未稼働・_archive推奨）"

# memory/*.json が空配列なら警告
for mf in "$CORE_DIR/memory/"*.json; do
    [ -f "$mf" ] || continue
    ITEMS=$(python3 -c "
import json, sys
try:
    d = json.load(open('$mf'))
    vals = [v for v in d.values() if isinstance(v, list)]
    print(sum(len(v) for v in vals))
except: print(-1)
" 2>/dev/null)
    [ "$ITEMS" = "0" ] && warn "$(basename "$mf") は空（学習データなし）"
done

# inbox/ が存在するのにdaemonが動いていなければ警告
[ -d "$CORE_DIR/inbox" ] && ! pgrep -f "daemon.js" >/dev/null 2>&1 && \
    warn "inbox/ があるが daemon.js は起動していない"

# ── 4. JSON整合性 ──
echo ""
echo "📋 [4/5] JSON整合性"
for jf in data_graph.json dependency_map.json; do
    if [ -f "$CORE_DIR/$jf" ]; then
        python3 -c "import json; json.load(open('$CORE_DIR/$jf'))" 2>/dev/null \
            && pass "$jf" || fail "Invalid JSON: $jf"
    fi
done

# ── 5. ワークフロー基本構文 ──
echo ""
echo "📜 [5/5] ワークフロー H1 チェック"
WF_MISSING=0
for wf in "$CORE_DIR/agent/workflows/"*.md; do
    [ -f "$wf" ] || continue
    if ! grep -q "^# \|^---" "$wf"; then
        warn "H1/frontmatter missing: $(basename "$wf")"
        WF_MISSING=$((WF_MISSING + 1))
    fi
done
[ $WF_MISSING -eq 0 ] && pass "全ワークフロー構文OK"

# ── 結果 ──
echo ""
echo "========================"
echo "🏁 Results: $ERRORS errors, $WARNINGS warnings"
[ $ERRORS -gt 0 ] && echo "❌ VERIFICATION FAILED" && exit 1
[ $WARNINGS -gt 0 ] && echo "⚠️  PASSED with warnings" && exit 0
echo "✅ ALL CLEAR — Core is honest" && exit 0
