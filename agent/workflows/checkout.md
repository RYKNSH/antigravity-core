---
description: データを整理し自己評価を行いクリーンな状態で終了
---
# /checkout - Ultra-Lean

// turbo-all

```bash
ANTIGRAVITY_DIR="${ANTIGRAVITY_DIR:-$HOME/.antigravity}"

# ─── ユーティリティ ───────────────────────────────────────
# 「進捗なし → 原因診断 → 自己修正 → リトライ」ラッパー
# Usage: _smart_run <stall_sec> <max_retries> <label> <cmd...>
_smart_run() {
  local stall=$1 retries=$2 label=$3; shift 3
  local attempt=0
  while [ $attempt -le $retries ]; do
    local tmpout; tmpout=$(mktemp)
    "$@" >"$tmpout" 2>&1 &
    local pid=$!
    local last_size=-1 stall_count=0 stalled=0
    while kill -0 "$pid" 2>/dev/null; do
      sleep 1   # ← 1秒固定ポーリング（高速検知）
      local cur_size; cur_size=$(wc -c < "$tmpout" 2>/dev/null || echo 0)
      if [ "$cur_size" -eq "$last_size" ]; then
        stall_count=$((stall_count + 1))
        if [ $stall_count -ge $stall ]; then          # stall秒間進捗なしでstallと判定
          stalled=1
          echo "⚠️ [$label] stalled (${stall}s no progress) — diagnosing..."
          if [[ " $* " == *" git push "* ]] || [[ " $* " == *" git fetch "* ]]; then
            if ! GIT_TERMINAL_PROMPT=0 git ls-remote --exit-code origin HEAD &>/dev/null; then
              echo "🔧 [$label] Remote unreachable → killing"
            else
              echo "🔧 [$label] Network OK but stuck → killing for retry"
            fi
          elif [[ " $* " == *" node "* ]]; then
            echo "🔧 [$label] Node script stalled → killing for retry"
          fi
          kill -9 "$pid" 2>/dev/null
          stall_count=0
          break
        fi
      else
        stall_count=0   # 進捗があればリセット
      fi
      last_size=$cur_size
    done
    wait "$pid" 2>/dev/null; local rc=$?
    cat "$tmpout"; rm -f "$tmpout"
    if [ $rc -eq 0 ]; then echo "✅ [$label] done"; return 0; fi
    attempt=$((attempt + 1))
    [ $attempt -le $retries ] && echo "🔄 [$label] Retry $attempt/$retries..."
  done
  echo "⚠️ [$label] gave up after $retries retries"; return 1
}

# ─── 1. Score ────────────────────────────────────────────
SCORE=$(( ( $(git diff --shortstat HEAD~1 2>/dev/null | grep -oE '[0-9]+' | head -1 || echo 0) / 100 ) + $(git log --oneline --since='6 hours ago' 2>/dev/null | wc -l) ))
echo "🎯 Score: $SCORE/10"

# ─── 1.5. Session Branch Merge ───────────────────────────
if [ -d ".git" ]; then
  CURRENT=$(git branch --show-current 2>/dev/null)
  if [[ "$CURRENT" == session/* ]]; then
    DEFAULT=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@.*/@@' || echo "main")
    git checkout "$DEFAULT" 2>/dev/null
    git merge "$CURRENT" --ff-only 2>/dev/null && git branch -d "$CURRENT" 2>/dev/null && echo "🔀 Merged: $CURRENT → $DEFAULT" || echo "⚠️ FF merge failed. Branch kept: $CURRENT"
  fi
fi

# ─── 2. Antigravity auto-commit ──────────────────────────
if [ -d "$ANTIGRAVITY_DIR/.git" ]; then
  (
    cd "$ANTIGRAVITY_DIR"
    export GIT_TERMINAL_PROMPT=0
    git add agent/workflows/ agent/skills/ agent/scripts/ agent/rules/ *.md 2>/dev/null
    git diff --cached --quiet 2>/dev/null || git commit -m "auto-sync: $(date +%m%d%H%M)" 2>/dev/null
  )

  # git push: 30秒進捗なしで診断→リトライ（最大1回）
  (
    cd "$ANTIGRAVITY_DIR"
    export GIT_TERMINAL_PROMPT=0
    _smart_run 30 1 "git-push" git push origin main --no-verify
  ) &

  # Private sync: privateリモートの疎通確認→問題あれば自動スキップ
  (
    cd "$ANTIGRAVITY_DIR"
    if git remote get-url private &>/dev/null; then
      if git ls-remote --quiet private main &>/dev/null; then
        _smart_run 20 1 "sync-private" node "$ANTIGRAVITY_DIR/agent/scripts/sync_private.js"
      else
        echo "⚠️ private remote unreachable — skipping sync_private"
      fi
    fi
  ) &
fi

# ─── 3. Cleanup ──────────────────────────────────────────
rm -rf ~/.gemini/antigravity/browser_recordings/* ~/.gemini/antigravity/implicit/* \
  ~/.npm/_npx ~/.npm/_logs ~/.npm/_prebuilds ~/.npm/_cacache 2>/dev/null &
find ~/.Trash -mindepth 1 -mtime +2 -delete 2>/dev/null &

# ─── 4. Context Snapshot ─────────────────────────────────
_smart_run 15 1 "context-snapshot" node "$ANTIGRAVITY_DIR/agent/scripts/git_context.js" snapshot

# ─── 5. Session State & Evolve ───────────────────────────
[ -f "NEXT_SESSION.md" ] && cp NEXT_SESSION.md "$ANTIGRAVITY_DIR/brain_log/session_$(date +%m%d%H%M).md" 2>/dev/null
_smart_run 10 1 "session-state"   node "$ANTIGRAVITY_DIR/agent/scripts/session_state.js" snapshot
_smart_run 10 1 "usage-tracker"   bash -c '"$ANTIGRAVITY_DIR/agent/scripts/update_usage_tracker.sh" /checkout >/dev/null 2>&1'
_smart_run 10 1 "evolve"          node "$ANTIGRAVITY_DIR/agent/scripts/evolve.js" --checkout

# ─── 6. 全ジョブ待機 ─────────────────────────────────────
wait

echo "✅ Checkout complete!" && df -h . | tail -1
```

## 🔍 自己評価 (必須)
| 項目 | スコア | 課題 |
|---|---|---|
| 効率/正確/コミュ/自律/品質 | X/5 | [簡潔に] |

### 改善ソリューション (即時実装)
[評価に基づく改善案と実装結果]

## 📋 NEXT_SESSION.md
1. [タスク]
2. [注意]
