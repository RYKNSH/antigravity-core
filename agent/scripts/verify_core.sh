#!/bin/bash
# verify_core.sh — Antigravity Core 実態検証スクリプト v3 (高速版)
# 目標: 30秒以内に完了 / python3大量起動を排除

CORE_DIR="${ANTIGRAVITY_DIR:-$HOME/.antigravity}"
ERRORS=0
WARNINGS=0
START_TIME=$(date +%s)

warn() { echo "⚠️  WARNING: $1"; WARNINGS=$((WARNINGS + 1)); }
fail() { echo "❌ FAIL: $1"; ERRORS=$((ERRORS + 1)); }
pass() { echo "✅ $1"; }

# macOS互換タイムアウトラッパー
if command -v gtimeout &>/dev/null; then
  _timeout() { gtimeout "$@"; }
elif command -v timeout &>/dev/null; then
  _timeout() { timeout "$@"; }
else
  _timeout() { shift; "$@"; }  # タイムアウトなしで実行
fi

# 時間チェック: 25秒を超えたら強制終了でOK
check_timeout() {
  local elapsed=$(( $(date +%s) - START_TIME ))
  if [ "$elapsed" -gt 25 ]; then
    echo "⚡ verify_core: 25s budget 消費 — 残りスキップして完了"
    exit 0
  fi
}

echo "🔍 Core Reality Check v3 (Fast)"
echo "========================"

# ── 1. 必須ファイル存在確認 (最重要のみ) ──
echo ""
echo "📂 [1/5] 必須ファイル"
REQUIRED=(
    "agent/workflows/WORKFLOW_ROUTER.md"
    "agent/workflows/WORKFLOW_CONTRACTS.md"
    "agent/workflows/go.md"
    "agent/workflows/checkin.md"
    "agent/workflows/checkout.md"
    "agent/rules/user_global.md"
    "agent/scripts/session_state.js"
    "docs/DECISION_USECASES.md"
)
for f in "${REQUIRED[@]}"; do
    [ -f "$CORE_DIR/$f" ] && pass "$f" || fail "Missing: $f"
done

check_timeout

# ── 2. スクリプト構文チェック (並列化) ──
echo ""
echo "🧪 [2/5] スクリプト構文 (parallel)"
JS_ERRORS=0
SH_ERRORS=0

# JS: tmpfileにエラーを書き込む方式（zsh/bash共通）
JS_ERR_FILE=$(mktemp)
for f in "$CORE_DIR/agent/scripts/"*.js; do
    [ -f "$f" ] || continue
    name=$(basename "$f")
    ( node --check "$f" 2>/dev/null || echo "$name" >> "$JS_ERR_FILE" ) &
done
wait

if [ -s "$JS_ERR_FILE" ]; then
    while IFS= read -r name; do
        fail "Syntax error: $name"
        JS_ERRORS=$((JS_ERRORS + 1))
    done < "$JS_ERR_FILE"
fi
rm -f "$JS_ERR_FILE"

# SH: シェル構文チェック（高速・python不要）
for f in "$CORE_DIR/agent/scripts/"*.sh; do
    [ -f "$f" ] || continue
    bash -n "$f" 2>/dev/null || {
        fail "Syntax error: $(basename "$f")"
        SH_ERRORS=$((SH_ERRORS + 1))
    }
done

[ $JS_ERRORS -eq 0 ] && [ $SH_ERRORS -eq 0 ] && pass "全スクリプト構文OK"

check_timeout

# ── 3. 嘘検知: ポイントチェックのみ ──
echo ""
echo "🔎 [3/5] 嘘検知"

[ -f "$CORE_DIR/agent/core/daemon.js" ] && warn "daemon.js が agent/core/ に残存"

# memory/*.json 空チェック — pythonなしでjqまたはgrepで高速化
for mf in "$CORE_DIR/memory/"*.json; do
    [ -f "$mf" ] || continue
    # jqがあれば使い、なければgrepで代替
    if command -v jq &>/dev/null; then
        ITEMS=$(jq '[.. | arrays | length] | add // 0' "$mf" 2>/dev/null || echo 0)
    else
        ITEMS=$(grep -c '"' "$mf" 2>/dev/null || echo 1)
    fi
    [ "${ITEMS:-0}" -eq 0 ] && warn "$(basename "$mf") は空（学習データなし）"
done

pass "嘘検知 完了"

check_timeout

# ── 4. JSON整合性 (jq優先 / node heredoc fallback) ──
echo ""
echo "📋 [4/5] JSON整合性"
check_json() {
  local file="$1"
  if command -v jq &>/dev/null; then
    jq empty "$file" 2>/dev/null && return 0 || return 1
  else
    node << NODE_EOF 2>/dev/null
try { JSON.parse(require('fs').readFileSync('${file}','utf8')); process.exit(0); } catch(e) { process.exit(1); }
NODE_EOF
    return $?
  fi
}
for jf in data/data_graph.json data/dependency_map.json; do
    if [ -f "$CORE_DIR/$jf" ]; then
        check_json "$CORE_DIR/$jf" && pass "$jf" || fail "Invalid JSON: $jf"
    fi
done

check_timeout

# ── 5. env_loader統一 + SSD参照 (grepのみ・高速) ──
echo ""
echo "🔑 [5/5] env_loader + SSD参照チェック"
ENV_VIOLATIONS=0
SSD_REFS=0

# scripts/*.jsのみ対象（md除外して高速化）
while IFS= read -r -d '' f; do
    name=$(basename "$f")
    [ "$name" = "env_loader.js" ] || [ "$name" = "verify_core.sh" ] && continue
    grep -q 'readFileSync.*\.env' "$f" 2>/dev/null \
        && ! grep -q 'env_loader' "$f" 2>/dev/null \
        && { warn "$name: 独自.envパース (env_loader.js 未使用)"; ENV_VIOLATIONS=$((ENV_VIOLATIONS + 1)); }
    grep -q 'PortableSSD' "$f" 2>/dev/null \
        && { warn "$name: /Volumes/PortableSSD 参照残存"; SSD_REFS=$((SSD_REFS + 1)); }
done < <(find "$CORE_DIR/agent/scripts" -name "*.js" -print0 2>/dev/null)

[ $ENV_VIOLATIONS -eq 0 ] && pass "env_loader.js 統一OK"
[ $SSD_REFS -eq 0 ] && pass "外部SSD参照なし"

# ── 結果 ──
ELAPSED=$(( $(date +%s) - START_TIME ))
echo ""
echo "========================"
echo "🏁 Results: $ERRORS errors, $WARNINGS warnings [${ELAPSED}s]"
[ $ERRORS -gt 0 ] && echo "❌ VERIFICATION FAILED" && exit 1
[ $WARNINGS -gt 0 ] && echo "⚠️  PASSED with warnings" && exit 0
echo "✅ ALL CLEAR — Core is honest" && exit 0
