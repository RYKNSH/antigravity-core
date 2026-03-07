#!/bin/bash
# io_guard.sh — I/O ハング防止ラッパー (3-Layer Defense)
# Usage: io_guard.sh <timeout_seconds> <command> [args...]
#
# Layer 1: perl alarm でタイムアウト
# Layer 2: バックグラウンド実行 + watchdog kill (Layer 1失敗時)
# Layer 3: 手動(ファイルシステムAPI等)に委譲

TIMEOUT=${1:-10}
shift
CMD="$@"

if [ -z "$CMD" ]; then
  echo "Usage: io_guard.sh <timeout_seconds> <command> [args...]"
  echo "Example: io_guard.sh 10 cp file.txt ~/Desktop/dest/"
  exit 1
fi

echo "🛡️ Core Guard: timeout=${TIMEOUT}s cmd='$CMD'"

perl -e "alarm $TIMEOUT; exec @ARGV" $CMD
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ Layer 1 success"
  exit 0
fi

echo "⚠️ Layer 1 failed (exit=$EXIT_CODE). Trying Layer 2 (background+kill)..."

eval "$CMD" &
BG_PID=$!
sleep $TIMEOUT

if kill -0 $BG_PID 2>/dev/null; then
  kill -9 $BG_PID 2>/dev/null
  wait $BG_PID 2>/dev/null
  echo "❌ Layer 2: process hung, killed (PID=$BG_PID)"
  echo "📝 Record this in NEXT_SESSION.md ## 🔄 Deferred Tasks"
  echo "- [ ] \`$CMD\` — timeout ${TIMEOUT}s at $(date '+%Y-%m-%d %H:%M')" >> /tmp/deferred_tasks.log
  exit 1
else
  wait $BG_PID
  BG_EXIT=$?
  if [ $BG_EXIT -eq 0 ]; then
    echo "✅ Layer 2 success"
    exit 0
  else
    echo "❌ Layer 2 failed (exit=$BG_EXIT)"
    echo "📝 Record this in NEXT_SESSION.md ## 🔄 Deferred Tasks"
    echo "- [ ] \`$CMD\` — failed at $(date '+%Y-%m-%d %H:%M')" >> /tmp/deferred_tasks.log
    exit 1
  fi
fi
