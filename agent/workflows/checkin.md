---
description: 環境を最新化して軽量状態で開始
---
# /checkin - Ultra-Lean

// turbo-all

```bash
ANTIGRAVITY_DIR="${ANTIGRAVITY_DIR:-$HOME/.antigravity}"

# macOS互換タイムアウト関数
_t() { local d=$1; shift; "$@" & local p=$!; (sleep "$d" && kill "$p" 2>/dev/null) & local tp=$!; wait "$p" 2>/dev/null; local r=$?; kill "$tp" 2>/dev/null; wait "$tp" 2>/dev/null; return $r; }

# 1. Sync & Cleanup
if pgrep -f "next dev" >/dev/null; then
  echo "⚠️  WARNING: Found running 'next dev' processes."
  ps aux | grep "next dev" | grep -v grep
fi

if [ -d "$ANTIGRAVITY_DIR/.git" ]; then
  (cd "$ANTIGRAVITY_DIR" && GIT_TERMINAL_PROMPT=0 _t 10 git pull origin main 2>/dev/null && echo "✅ Core synced") &
fi

_t 5 "$ANTIGRAVITY_DIR/agent/scripts/update_usage_tracker.sh" /checkin >/dev/null 2>&1 &

_t 10 rm -rf ~/.gemini/antigravity/browser_recordings/* ~/.gemini/antigravity/implicit/* ~/Library/Application\ Support/Google/Chrome/Default/Service\ Worker ~/Library/Application\ Support/Adobe/CoreSync ~/Library/Application\ Support/Notion/Partitions ~/.npm/_npx ~/.npm/_logs ~/.npm/_prebuilds ~/.npm/_cacache 2>/dev/null &

_t 10 find ~/.gemini/antigravity/conversations ~/.gemini/antigravity/brain -mindepth 1 -maxdepth 1 -mtime +1 -exec rm -rf {} + 2>/dev/null &

# 2. Workspace Sync
mkdir -p .agent/skills .agent/workflows
_t 10 rsync -a --update --quiet "$ANTIGRAVITY_DIR/agent/workflows/"*.md .agent/workflows/ 2>/dev/null &
_t 10 rsync -a --update --quiet "$ANTIGRAVITY_DIR/agent/skills/" .agent/skills/ 2>/dev/null &

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
_t 5 node "$ANTIGRAVITY_DIR/agent/scripts/git_context.js" restore 2>/dev/null && echo "🧠 Context restored" &

[ -f "./NEXT_SESSION.md" ] && echo "📋 NEXT:" && cat "./NEXT_SESSION.md"
[ -f ".sweep_patterns.md" ] && echo "📚 Patterns loaded"

# 5. Session Branch (Project-side — isolate concurrent sessions)
if [ -d ".git" ]; then
  CURRENT=$(git branch --show-current 2>/dev/null)
  if [ "$CURRENT" = "main" ] || [ "$CURRENT" = "master" ]; then
    SESSION_BRANCH="session/$(basename $(pwd))-$(date +%m%d%H%M)"
    git checkout -b "$SESSION_BRANCH" 2>/dev/null && echo "🌿 Branch: $SESSION_BRANCH"
  else
    echo "🌿 Branch: $CURRENT (already on non-default branch)"
  fi
  # Cleanup stale session branches (>7 days)
  git branch --list 'session/*' | while read b; do
    b=$(echo "$b" | xargs)  # trim whitespace
    LAST_COMMIT=$(git log -1 --format=%ct "$b" 2>/dev/null || echo 0)
    NOW=$(date +%s)
    if [ $((NOW - LAST_COMMIT)) -gt 604800 ]; then
      git branch -D "$b" 2>/dev/null && echo "🗑️ Pruned: $b"
    fi
  done
fi

wait && echo "✅ Check-in complete!" && df -h . | tail -1
```
