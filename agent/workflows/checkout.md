---
description: データを整理し自己評価を行いクリーンな状態で終了
---
# /checkout - Ultra-Lean

> [!CAUTION]
> **AIエージェントはこのスクリプトを `bash -c "..."` でインライン実行してはいけない。**
> `bash -c` 内でのネスト変数（`$tmpout` 等）が二重展開されて空になり、`_smart_run` が無限ループハングする。
>
> **正しい実行手順:**
> 1. `write_to_file(/tmp/checkout_run.sh)` でスクリプトを書き出す
> 2. `bash /tmp/checkout_run.sh` で実行する

// turbo-all

```bash
ANTIGRAVITY_DIR="${ANTIGRAVITY_DIR:-$HOME/.antigravity}"
SCRIPT_PID=$$

# ═══ LAYER 3: Global Watchdog（全体90秒タイムアウト・macOS互換） ════════════
( sleep 90 && echo "💀 WATCHDOG: checkout hung >90s — force-killing" \
  && pgrep -P "$SCRIPT_PID" 2>/dev/null | xargs kill -9 2>/dev/null \
  && kill -TERM "$SCRIPT_PID" 2>/dev/null ) &
WD_PID=$!
trap 'kill "$WD_PID" 2>/dev/null' EXIT

# ═══ LAYER 2: 診断ツール（/dev/tcpで3秒以内接続テスト） ══════════
_check_net() {
  local host="${1:-github.com}" port="${2:-443}"
  ( timeout 3 bash -c "exec 3<>/dev/tcp/$host/$port && echo OK" ) &>/dev/null
}

# ═══ LAYER 1: 進捗監視+診断+リトライラッパー ════════════════════
_smart_run() {
  local stall=$1 retries=$2 label=$3; shift 3
  local attempt=0
  while [ $attempt -le $retries ]; do
    local tmpout; tmpout=$(mktemp)
    "$@" >"$tmpout" 2>&1 &
    local pid=$!
    local last_size=-1 stall_count=0
    while kill -0 "$pid" 2>/dev/null; do
      sleep 1
      local cur_size; cur_size=$(wc -c < "$tmpout" 2>/dev/null || echo 0)
      if [ "$cur_size" -eq "$last_size" ]; then
        stall_count=$((stall_count + 1))
        if [ $stall_count -ge $stall ]; then
          echo "⚠️ [$label] stalled ${stall}s — diagnosing..."
          if [[ " $* " == *" git "* ]]; then
            _check_net github.com 443 \
              && echo "🔧 [$label] network OK, stuck process → retry" \
              || echo "🔧 [$label] network unreachable → skip"
          elif [[ " $* " == *" node "* ]]; then
            echo "🔧 [$label] node stalled → retry"
          fi
          kill -9 "$pid" 2>/dev/null; stall_count=0; break
        fi
      else
        stall_count=0
      fi
      last_size=$cur_size
    done
    wait "$pid" 2>/dev/null; local rc=$?
    cat "$tmpout"; rm -f "$tmpout"
    if [ $rc -eq 0 ]; then echo "✅ [$label] done"; return 0; fi
    attempt=$((attempt + 1))
    [ $attempt -le $retries ] && echo "🔄 [$label] retry $attempt/$retries..."
  done
  echo "⚠️ [$label] gave up"; return 1
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
    git merge "$CURRENT" --ff-only 2>/dev/null && git branch -d "$CURRENT" 2>/dev/null \
      && echo "🔀 Merged: $CURRENT → $DEFAULT" || echo "⚠️ FF merge failed. Branch kept: $CURRENT"
  fi
fi

# ─── 2. Antigravity auto-commit + push ──────────────────
if [ -d "$ANTIGRAVITY_DIR/.git" ]; then
  _do_commit() {
    cd "$ANTIGRAVITY_DIR" || return 1
    GIT_TERMINAL_PROMPT=0 git add agent/workflows/ agent/skills/ agent/scripts/ agent/rules/ \
      README.md QUICKSTART.md BACKUP_STRATEGY.md KNOWLEDGE_INDEX.md AUTO_TRIGGERS.md ENVIRONMENTS.md 2>/dev/null
    GIT_TERMINAL_PROMPT=0 git diff --cached --quiet 2>/dev/null || \
      GIT_TERMINAL_PROMPT=0 git commit -m "auto-sync: $(date +%m%d%H%M)" 2>/dev/null
  }
  _smart_run 20 0 "auto-commit" _do_commit

  _smart_run 30 1 "git-push" git -C "$ANTIGRAVITY_DIR" push origin main --no-verify &
  PUSH_PID=$!

  if git -C "$ANTIGRAVITY_DIR" remote get-url private &>/dev/null; then
    if _check_net github.com 443; then
      _smart_run 20 1 "sync-private" node "$ANTIGRAVITY_DIR/agent/scripts/sync_private.js" &
      SYNC_PID=$!
    else
      echo "⚠️ network unreachable — skipping sync_private"
    fi
  fi
fi

# ─── 3. Cleanup (fire-and-forget) ─────────────────────
rm -rf ~/.gemini/antigravity/browser_recordings/* ~/.gemini/antigravity/implicit/* \
  ~/.npm/_npx ~/.npm/_logs ~/.npm/_prebuilds ~/.npm/_cacache 2>/dev/null &
find ~/.Trash -mindepth 1 -mtime +2 -delete 2>/dev/null &

# ─── 3.5. スクリプト存在チェック（P-01 Hallucinated API 対策） ─────
# 実行前に必ず存在を確認。なければ silent give-up でなく明示的警告を出す
for _script in git_context.js session_state.js evolve.js; do
  [ ! -f "$ANTIGRAVITY_DIR/agent/scripts/$_script" ] && \
    echo "⚠️ Script missing: $_script — 依存ステップがスキップされます"
done

# ─── 4. Context Snapshot ──────────────────────────────
_smart_run 15 1 "context-snapshot" node "$ANTIGRAVITY_DIR/agent/scripts/git_context.js" snapshot

# ─── 5. Session State & Evolve ────────────────────────
[ -f "NEXT_SESSION.md" ] && cp NEXT_SESSION.md "$ANTIGRAVITY_DIR/brain_log/session_$(date +%m%d%H%M).md" 2>/dev/null
_smart_run 10 1 "session-state" node "$ANTIGRAVITY_DIR/agent/scripts/session_state.js" snapshot
_smart_run 10 1 "usage-tracker" "$ANTIGRAVITY_DIR/agent/scripts/update_usage_tracker.sh" /checkout
_smart_run 10 1 "evolve"        node "$ANTIGRAVITY_DIR/agent/scripts/evolve.js" --checkout

# ─── 5.5. brain_log 構造化MD出力（INCIDENT_FORMAT.md形式） ─────────
# AIエージェントは checkout の自己評価後に以下の形式で brain_log を書き出すこと
# 参照: ~/.antigravity/INCIDENT_FORMAT.md
# 出力先: ~/.antigravity/brain_log/session_MMDDHHNN.md
# フォーマット:
#   ## [INCIDENT] session_MMDDHHNN  ← このセッション中に発生したハング
#   - type: hang | error | silent_failure | auth_block
#   - component: [スクリプト名/WF名]
#   - trigger: [原因]
#   - duration: [時間]
#   - layer: terminal | browser | network | git | filesystem
#   - resolution: pending | [解決方法]
#   - status: OPEN | FIXED
#   - related_wf: [影響WF]
#
#   ## [FIXED] session_MMDDHHNN  ← このセッション中に解決したインシデント
#   - type: ...（同上）
#   - resolution: [解決方法]
#   - fix_file: [修正ファイル]
#   - status: FIXED
#   - related_wf: [影響WF]
#
# ※ ハングが発生しなかったセッションでも "# No incidents this session" を書いてファイルを生成すること


# ─── 6. 全ジョブ待機（PID追跡分のみ） ────────────────
[ -n "${PUSH_PID:-}" ] && wait "$PUSH_PID" 2>/dev/null
[ -n "${SYNC_PID:-}" ] && wait "$SYNC_PID" 2>/dev/null
# `wait` without args waits for ALL background tasks, including the watchdog.
# Therefore we explicitly remove `wait` here, jobs in (3) are fire-and-forget.

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
