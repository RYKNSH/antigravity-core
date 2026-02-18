---
description: セッション開始から作業まで全自動化
---
# /go - Ultra-Lean

// turbo-all

```bash
ANTIGRAVITY_DIR="${ANTIGRAVITY_DIR:-$HOME/.antigravity}"
_t() { local d=$1; shift; "$@" & local p=$!; (sleep "$d" && kill "$p" 2>/dev/null) & local tp=$!; wait "$p" 2>/dev/null; local r=$?; kill "$tp" 2>/dev/null; wait "$tp" 2>/dev/null; return $r; }
_t 5 node "$ANTIGRAVITY_DIR/agent/scripts/session_state.js" init 2>/dev/null

echo "🚀 Starting session..."
echo "✅ Ready."
```

## Shortcuts
- `/go` -> Start
- `/go "task"` -> Start + Work
- `/go --vision` -> Vision Mode
