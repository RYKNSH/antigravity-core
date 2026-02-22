---
description: データを整理し自己評価を行いクリーンな状態で終了
---
# /checkout - Ultra-Lean

// turbo-all

```bash
ANTIGRAVITY_DIR="${ANTIGRAVITY_DIR:-$HOME/.antigravity}"
PIDS=()  # バックグラウンドPID追跡用
MAX_WAIT=45  # 全体の最大待機秒数

# 安全なタイムアウト関数（プロセスグループ単位kill + 確実クリーンアップ）
_t() {
  local d=$1; shift
  ( "$@" ) &
  local p=$!
  PIDS+=($p)
  ( sleep "$d" && kill -TERM "$p" 2>/dev/null && sleep 2 && kill -9 "$p" 2>/dev/null ) &
  local tp=$!
  wait "$p" 2>/dev/null
  local r=$?
  kill "$tp" 2>/dev/null
  wait "$tp" 2>/dev/null
  return $r
}

# バックグラウンドジョブを安全に起動（PID追跡）
_bg() { "$@" & PIDS+=($!); }

# 1. Scoring (同期・短時間)
SCORE=$(( ( $(git diff --shortstat HEAD~1 2>/dev/null | grep -oE '[0-9]+' | head -1 || echo 0) / 100 ) + $(git log --oneline --since='6 hours ago' 2>/dev/null | wc -l) ))
echo "🎯 Score: $SCORE/10"

# 2. Git Sync（サブシェル全体を30秒タイムアウトで保護）
if [ -d "$ANTIGRAVITY_DIR/.git" ]; then
  _t 30 bash -c '
    cd "'"$ANTIGRAVITY_DIR"'"
    export GIT_TERMINAL_PROMPT=0
    # Auto-commit
    if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
      git add -A
      git commit -m "auto-sync: $(date +%m%d%H%M)" 2>/dev/null
    fi
    # Private Sync
    if [ -f "agent/scripts/sync_private.js" ]; then
      timeout 20 node agent/scripts/sync_private.js >> logs/sync.log 2>&1 || true
    fi
    # Public Push
    timeout 15 git push origin main 2>/dev/null || true
  ' &
  PIDS+=($!)
fi

# 3. Parallel Cleanup
pkill -f "next-server" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true

_bg bash -c 'rm -rf ~/.gemini/antigravity/browser_recordings/* ~/.gemini/antigravity/implicit/* "$HOME/Library/Application Support/Google/Chrome/Default/Service Worker" "$HOME/Library/Application Support/Adobe/CoreSync" "$HOME/Library/Application Support/Notion/Partitions" ~/.npm/_npx ~/.npm/_logs ~/.npm/_prebuilds ~/.npm/_cacache 2>/dev/null'
_bg bash -c 'find ~/.Trash -mindepth 1 -mtime +2 -delete 2>/dev/null'

# 4. Context Snapshot (Git-Driven — NEVER LOSE CONTEXT)
_t 10 node "$ANTIGRAVITY_DIR/agent/scripts/git_context.js" snapshot 2>/dev/null && echo "🧠 Context committed to Git"

# 5. Session Info & State（直列・タイムアウト付き）
[ -f "NEXT_SESSION.md" ] && cp NEXT_SESSION.md "$ANTIGRAVITY_DIR/brain_log/session_$(date +%m%d%H%M).md" 2>/dev/null
_t 5 node "$ANTIGRAVITY_DIR/agent/scripts/session_state.js" snapshot 2>/dev/null
_t 5 bash -c '"$ANTIGRAVITY_DIR/agent/scripts/update_usage_tracker.sh" /checkout >/dev/null 2>&1'
_t 5 node "$ANTIGRAVITY_DIR/agent/scripts/evolve.js" --checkout 2>/dev/null

# 6. 全バックグラウンドジョブの安全な待機（最大MAX_WAIT秒）
DEADLINE=$((SECONDS + MAX_WAIT))
for pid in "${PIDS[@]}"; do
  REMAINING=$((DEADLINE - SECONDS))
  if [ "$REMAINING" -le 0 ]; then
    echo "⏰ Timeout: killing remaining jobs"
    kill -9 "$pid" 2>/dev/null
    continue
  fi
  # タイムアウト付きwait（bashビルトインwait -t未対応のためループ）
  while kill -0 "$pid" 2>/dev/null; do
    if [ "$((SECONDS))" -ge "$DEADLINE" ]; then
      echo "⏰ Timeout: killing PID $pid"
      kill -9 "$pid" 2>/dev/null
      break
    fi
    sleep 0.5
  done
done 2>/dev/null

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
