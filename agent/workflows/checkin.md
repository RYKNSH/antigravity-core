---
description: 環境を最新化して軽量状態で開始
---
# /checkin - Ultra-Lean

// turbo-all

```bash
ANTIGRAVITY_DIR="${ANTIGRAVITY_DIR:-$HOME/.antigravity}"

# 1. Sync & Cleanup
if [ -d "$ANTIGRAVITY_DIR/.git" ]; then
  cd "$ANTIGRAVITY_DIR" && git pull origin main 2>/dev/null && echo "✅ Core synced" &
fi

rm -rf ~/.gemini/antigravity/{browser_recordings,implicit}/* \
       ~/Library/Application\ Support/{Google/Chrome/Default/Service\ Worker,Adobe/CoreSync,Notion/Partitions} \
       ~/.npm/_{npx,logs,prebuilds,cacache} 2>/dev/null &

find ~/.gemini/antigravity/{conversations,brain} -mindepth 1 -maxdepth 1 -mtime +1 -exec rm -rf {} + 2>/dev/null &

# 2. Workspace Sync (Metadata base)
mkdir -p .agent/{skills,workflows}
rsync -a --update --quiet "$ANTIGRAVITY_DIR/agent/workflows/"*.md .agent/workflows/ 2>/dev/null &
rsync -a --update --quiet "$ANTIGRAVITY_DIR/agent/skills/" .agent/skills/ 2>/dev/null &

# 3. Configs & GEMINI.md
cp "$ANTIGRAVITY_DIR/mcp_config.json" ~/.gemini/antigravity/mcp_config.json 2>/dev/null
[ -f "$ANTIGRAVITY_DIR/agent/rules/GEMINI.md.master" ] && cp "$ANTIGRAVITY_DIR/agent/rules/GEMINI.md.master" "$HOME/.gemini/GEMINI.md"

# 4. Session Info
[ -f "./NEXT_SESSION.md" ] && echo "📋 NEXT:" && cat "./NEXT_SESSION.md"
[ -f ".sweep_patterns.md" ] && echo "📚 Patterns loaded"

wait && echo "✅ Check-in complete!" && df -h . | tail -1
```
