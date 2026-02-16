#!/bin/bash
# ============================================================
# Memory Status — Quick memory health check
# ============================================================
# Usage: memory_status.sh
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
GUARDIAN="$SCRIPT_DIR/memory_guardian.sh"

if [ -f "$GUARDIAN" ]; then
  bash "$GUARDIAN" --status
else
  echo "❌ memory_guardian.sh not found at: $GUARDIAN"
  echo ""
  echo "Fallback status:"
  echo "---"
  sysctl vm.swapusage
  echo "---"
  vm_stat | head -5
  echo "---"
  echo "Top 5 memory consumers:"
  ps -eo rss,comm -m | head -6 | tail -5 | while read -r rss comm; do
    mb=$((rss / 1024))
    name=$(basename "$comm" 2>/dev/null || echo "$comm")
    printf "  %4d MB  %s\n" "$mb" "$name"
  done
fi
