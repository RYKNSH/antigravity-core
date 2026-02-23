---
description: 環境を最新化して軽量状態で開始
---
# /checkin - Ultra-Lean

// turbo-all

```bash
ANTIGRAVITY_DIR="${ANTIGRAVITY_DIR:-$HOME/.antigravity}"

# 「進捗なし→診断→自己修正→リトライ」ラッパー（checkout.mdと共通）
_smart_run() {
  local stall=$1 retries=$2 label=$3; shift 3
  local attempt=0
  while [ $attempt -le $retries ]; do
    local tmpout; tmpout=$(mktemp)
    "$@" >"$tmpout" 2>&1 &
    local pid=$!
    local last_size=-1 stall_count=0 stalled=0
    while kill -0 "$pid" 2>/dev/null; do
      sleep 1
      local cur_size; cur_size=$(wc -c < "$tmpout" 2>/dev/null || echo 0)
      if [ "$cur_size" -eq "$last_size" ]; then
        stall_count=$((stall_count + 1))
        if [ $stall_count -ge $stall ]; then
          stalled=1
          echo "⚠️ [$label] stalled (${stall}s no progress) — diagnosing..."
          if [[ " $* " == *" git pull "* ]] || [[ " $* " == *" git push "* ]]; then
            if ! GIT_TERMINAL_PROMPT=0 git ls-remote --exit-code origin HEAD &>/dev/null; then
              echo "🔧 [$label] Remote unreachable → skip and continue"
            else
              echo "🔧 [$label] Network OK but stuck → killing for retry"
            fi
          elif [[ " $* " == *" node "* ]]; then
            echo "🔧 [$label] Node script stalled → killing for retry"
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
    [ $attempt -le $retries ] && echo "🔄 [$label] Retry $attempt/$retries..."
  done
  echo "⚠️ [$label] gave up after $retries retries"; return 1
}

# 1. Sync & Cleanup
if pgrep -f "next dev" > /dev/null; then
  echo "⚠️  WARNING: Found running 'next dev' processes."
  ps aux | grep "next dev" | grep -v grep
fi

if [ -d "$ANTIGRAVITY_DIR/.git" ]; then
  (cd "$ANTIGRAVITY_DIR" && GIT_TERMINAL_PROMPT=0 _smart_run 30 1 "git-pull" git pull origin main) &
fi

_smart_run 5 1 "usage-tracker" "$ANTIGRAVITY_DIR/agent/scripts/update_usage_tracker.sh" /checkin >/dev/null 2>&1 &

rm -rf ~/.gemini/antigravity/browser_recordings/* ~/.gemini/antigravity/implicit/* \
  ~/Library/Application\ Support/Google/Chrome/Default/Service\ Worker \
  ~/Library/Application\ Support/Adobe/CoreSync \
  ~/Library/Application\ Support/Notion/Partitions \
  ~/.npm/_npx ~/.npm/_logs ~/.npm/_prebuilds ~/.npm/_cacache 2>/dev/null &

find ~/.gemini/antigravity/conversations ~/.gemini/antigravity/brain \
  -mindepth 1 -maxdepth 1 -mtime +1 -exec rm -rf {} + 2>/dev/null &

# 2. Workspace Sync
mkdir -p .agent/skills .agent/workflows
rsync -a --update --quiet "$ANTIGRAVITY_DIR/agent/workflows/"*.md .agent/workflows/ 2>/dev/null &
rsync -a --update --quiet "$ANTIGRAVITY_DIR/agent/skills/" .agent/skills/ 2>/dev/null &

# 2.5. Git Hooks Auto-Setup
if [ -d ".git" ]; then
  CURRENT_HOOKS=$(git config --get core.hooksPath 2>/dev/null || echo "")
  if [ -z "$CURRENT_HOOKS" ] && [ -d "$ANTIGRAVITY_DIR/.git-hooks" ]; then
    git config core.hooksPath "$ANTIGRAVITY_DIR/.git-hooks"
    chmod +x "$ANTIGRAVITY_DIR/.git-hooks/"* 2>/dev/null
    echo "🪝 Git hooks activated"
  fi
fi

# 3. Configs & GEMINI.md
cp "$ANTIGRAVITY_DIR/mcp_config.json" ~/.gemini/antigravity/mcp_config.json 2>/dev/null
[ -f "$ANTIGRAVITY_DIR/agent/rules/GEMINI.md.master" ] && cp "$ANTIGRAVITY_DIR/agent/rules/GEMINI.md.master" "$HOME/.gemini/GEMINI.md"

# 4. Context Restore (Git-Driven)
_smart_run 10 1 "context-restore" node "$ANTIGRAVITY_DIR/agent/scripts/git_context.js" restore && echo "🧠 Context restored" &

[ -f "./NEXT_SESSION.md" ] && echo "📋 NEXT:" && cat "./NEXT_SESSION.md"
[ -f ".sweep_patterns.md" ] && echo "📚 Patterns loaded"

# 5. Session Branch
if [ -d ".git" ]; then
  CURRENT=$(git branch --show-current 2>/dev/null)
  if [ "$CURRENT" = "main" ] || [ "$CURRENT" = "master" ]; then
    SESSION_BRANCH="session/$(basename $(pwd))-$(date +%m%d%H%M)"
    git checkout -b "$SESSION_BRANCH" 2>/dev/null && echo "🌿 Branch: $SESSION_BRANCH"
  else
    echo "🌿 Branch: $CURRENT (already on non-default branch)"
  fi
  git branch --list 'session/*' | while read b; do
    b=$(echo "$b" | xargs)
    LAST_COMMIT=$(git log -1 --format=%ct "$b" 2>/dev/null || echo 0)
    NOW=$(date +%s)
    if [ $((NOW - LAST_COMMIT)) -gt 604800 ]; then
      git branch -D "$b" 2>/dev/null && echo "🗑️ Pruned: $b"
    fi
  done
fi

wait && echo "✅ Check-in complete!" && df -h . | tail -1
```
