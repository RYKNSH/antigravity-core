#!/bin/bash
# ============================================================
# Memory Guardian — Antigravity Autonomous Memory Manager
# ============================================================
# 5分間隔で実行。メモリ圧力を監視し、段階的に自動回復。
# 再起動もアプリ終了も不要。
#
# Usage:
#   memory_guardian.sh              通常実行（launchd から）
#   memory_guardian.sh --dry-run    何が実行されるか表示のみ
#   memory_guardian.sh --force      閾値無視で全レベル実行
#   memory_guardian.sh --status     現在の状態を表示
# ============================================================

set -euo pipefail

# --- Configuration ---
THRESHOLD_L1=30    # Level 1: 予防的クリーンアップ (フリー < 30%)
THRESHOLD_L2=20    # Level 2: 積極的回復 (フリー < 20%)
THRESHOLD_L3=10    # Level 3: 緊急対応 (フリー < 10%)
SWAP_CRITICAL=2048 # SWAP 2GB超で Level 3 発動 (MB)
INTERVAL_GUARD=240 # 最低実行間隔 (秒) — 連続実行防止

LOG_FILE="/tmp/memory_guardian.log"
LOCK_FILE="/tmp/memory_guardian.lock"
STATE_FILE="/tmp/memory_guardian.state"
MAX_LOG_SIZE=1048576  # 1MB log rotation

SSD="/Volumes/PortableSSD"
DEV_DIR="$SSD/STUDIO/Apps"

# --- Flags ---
DRY_RUN=false
FORCE=false
STATUS_ONLY=false

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --force)   FORCE=true ;;
    --status)  STATUS_ONLY=true ;;
  esac
done

# --- Logging ---
log() {
  local level="$1"; shift
  local msg="$*"
  local timestamp
  timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  echo "[$timestamp] [$level] $msg" >> "$LOG_FILE"
  if [ "$DRY_RUN" = true ] || [ "$STATUS_ONLY" = true ]; then
    echo "[$level] $msg"
  fi
}

# --- Log Rotation ---
rotate_log() {
  if [ -f "$LOG_FILE" ]; then
    local size
    size=$(stat -f%z "$LOG_FILE" 2>/dev/null || echo 0)
    if [ "$size" -gt "$MAX_LOG_SIZE" ]; then
      tail -100 "$LOG_FILE" > "${LOG_FILE}.tmp" && mv "${LOG_FILE}.tmp" "$LOG_FILE"
      log "INFO" "Log rotated (was ${size} bytes)"
    fi
  fi
}

# --- Memory Info ---
get_memory_info() {
  local page_size
  page_size=$(sysctl -n hw.pagesize)

  local vm_output
  vm_output=$(vm_stat)

  local free_pages speculative_pages inactive_pages total_pages
  free_pages=$(echo "$vm_output" | awk '/Pages free/ {gsub(/\./,"",$3); print $3}')
  speculative_pages=$(echo "$vm_output" | awk '/Pages speculative/ {gsub(/\./,"",$3); print $3}')
  inactive_pages=$(echo "$vm_output" | awk '/Pages inactive/ {gsub(/\./,"",$3); print $3}')
  total_pages=$(sysctl -n hw.memsize)
  total_pages=$((total_pages / page_size))

  # "available" = free + speculative + inactive (macOS can reclaim these)
  local available_pages
  available_pages=$(( ${free_pages:-0} + ${speculative_pages:-0} + ${inactive_pages:-0} ))

  FREE_PERCENT=$(( available_pages * 100 / total_pages ))
  FREE_MB=$(( available_pages * page_size / 1024 / 1024 ))

  # SWAP info
  local swap_info
  swap_info=$(sysctl vm.swapusage 2>/dev/null)
  SWAP_USED_MB=$(echo "$swap_info" | awk '{for(i=1;i<=NF;i++) if($i=="used") {gsub(/M/,"",$(i+2)); printf "%.0f", $(i+2)}}')
  SWAP_USED_MB=${SWAP_USED_MB:-0}

  # Compressor info
  COMPRESSOR_PAGES=$(echo "$vm_output" | awk '/Pages stored in compressor/ {gsub(/\./,"",$NF); print $NF}')
  COMPRESSOR_PAGES=${COMPRESSOR_PAGES:-0}
  COMPRESSOR_MB=$(( COMPRESSOR_PAGES * page_size / 1024 / 1024 ))
}

# --- Status Display ---
show_status() {
  get_memory_info
  echo "╔══════════════════════════════════════╗"
  echo "║    🛡️  Memory Guardian Status        ║"
  echo "╠══════════════════════════════════════╣"
  printf "║  Free: %3d%% (%s MB available)      \n" "$FREE_PERCENT" "$FREE_MB"
  printf "║  SWAP: %s MB used                   \n" "$SWAP_USED_MB"
  printf "║  Compressor: %s MB                  \n" "$COMPRESSOR_MB"
  echo "╠══════════════════════════════════════╣"

  # Determine current level
  local current_level="✅ NORMAL"
  if [ "$FREE_PERCENT" -lt "$THRESHOLD_L3" ] || [ "$SWAP_USED_MB" -gt "$SWAP_CRITICAL" ]; then
    current_level="🔴 Level 3 (CRITICAL)"
  elif [ "$FREE_PERCENT" -lt "$THRESHOLD_L2" ]; then
    current_level="🟠 Level 2 (RECOVERY)"
  elif [ "$FREE_PERCENT" -lt "$THRESHOLD_L1" ]; then
    current_level="🟡 Level 1 (PREVENTION)"
  fi
  printf "║  Status: %s\n" "$current_level"
  echo "╠══════════════════════════════════════╣"

  # Top 5 memory consumers
  echo "║  Top 5 Memory Consumers:             ║"
  ps -eo rss,comm -m | head -6 | tail -5 | while read -r rss comm; do
    local mb=$((rss / 1024))
    local name
    name=$(basename "$comm" 2>/dev/null || echo "$comm")
    printf "║    %4d MB  %s\n" "$mb" "$name"
  done
  echo "╠══════════════════════════════════════╣"

  # Last guardian action
  if [ -f "$STATE_FILE" ]; then
    local last_run last_level last_freed
    last_run=$(awk -F= '/^last_run/ {print $2}' "$STATE_FILE" 2>/dev/null)
    last_level=$(awk -F= '/^last_level/ {print $2}' "$STATE_FILE" 2>/dev/null)
    last_freed=$(awk -F= '/^freed_mb/ {print $2}' "$STATE_FILE" 2>/dev/null)
    printf "║  Last run: %s\n" "${last_run:-never}"
    printf "║  Last level: %s, freed: %s MB\n" "${last_level:-none}" "${last_freed:-0}"
  else
    echo "║  Last run: never"
  fi
  echo "╚══════════════════════════════════════╝"
}

if [ "$STATUS_ONLY" = true ]; then
  show_status
  exit 0
fi

# --- Lock ---
acquire_lock() {
  if [ -f "$LOCK_FILE" ]; then
    local lock_pid
    lock_pid=$(cat "$LOCK_FILE" 2>/dev/null)
    if kill -0 "$lock_pid" 2>/dev/null; then
      log "WARN" "Another instance running (PID: $lock_pid), exiting"
      exit 0
    fi
    rm -f "$LOCK_FILE"
  fi
  echo $$ > "$LOCK_FILE"
}

release_lock() {
  rm -f "$LOCK_FILE"
}

trap release_lock EXIT

# --- Interval Guard ---
check_interval() {
  if [ "$FORCE" = true ]; then return 0; fi
  if [ -f "$STATE_FILE" ]; then
    local last_ts
    last_ts=$(awk -F= '/^last_ts/ {print $2}' "$STATE_FILE" 2>/dev/null || echo 0)
    local now
    now=$(date +%s)
    local diff=$(( now - ${last_ts:-0} ))
    if [ "$diff" -lt "$INTERVAL_GUARD" ]; then
      log "INFO" "Skipping: last run ${diff}s ago (guard: ${INTERVAL_GUARD}s)"
      exit 0
    fi
  fi
}

# --- Actions ---

# Level 1: 予防的クリーンアップ
action_level1() {
  log "ACTION" "=== Level 1: Prevention ==="

  # 1. purge (macOS memory compression flush)
  if [ "$DRY_RUN" = false ]; then
    if sudo -n purge 2>/dev/null; then
      log "ACTION" "purge executed (sudo)"
    elif purge 2>/dev/null; then
      log "ACTION" "purge executed (no sudo)"
    else
      log "WARN" "purge failed (needs sudo?)"
    fi
  else
    log "DRY-RUN" "Would execute: purge"
  fi

  # 2. Antigravity browser_recordings (48h+)
  local recordings_dir="$HOME/.gemini/antigravity/browser_recordings"
  if [ -d "$recordings_dir" ]; then
    if [ "$DRY_RUN" = false ]; then
      local count
      count=$(find "$recordings_dir" -type f -mtime +2 2>/dev/null | wc -l | tr -d ' ')
      find "$recordings_dir" -type f -mtime +2 -delete 2>/dev/null
      find "$recordings_dir" -type d -empty -delete 2>/dev/null
      log "ACTION" "browser_recordings: ${count} old files removed"
    else
      local count
      count=$(find "$recordings_dir" -type f -mtime +2 2>/dev/null | wc -l | tr -d ' ')
      log "DRY-RUN" "Would remove ${count} old browser_recordings"
    fi
  fi

  # 3. Chrome Service Worker
  local chrome_sw="$HOME/Library/Application Support/Google/Chrome/Default/Service Worker"
  if [ -d "$chrome_sw" ]; then
    if [ "$DRY_RUN" = false ]; then
      local sw_size
      sw_size=$(du -sh "$chrome_sw" 2>/dev/null | cut -f1)
      rm -rf "$chrome_sw"
      log "ACTION" "Chrome Service Worker removed (${sw_size})"
    else
      local sw_size
      sw_size=$(du -sh "$chrome_sw" 2>/dev/null | cut -f1)
      log "DRY-RUN" "Would remove Chrome Service Worker (${sw_size})"
    fi
  fi
}

# Level 2: 積極的回復
action_level2() {
  log "ACTION" "=== Level 2: Recovery ==="
  action_level1

  # 4. Adobe CoreSync
  local adobe_cache="$HOME/Library/Application Support/Adobe/CoreSync"
  if [ -d "$adobe_cache" ]; then
    if [ "$DRY_RUN" = false ]; then
      local size
      size=$(du -sh "$adobe_cache" 2>/dev/null | cut -f1)
      rm -rf "$adobe_cache"
      log "ACTION" "Adobe CoreSync removed (${size})"
    else
      log "DRY-RUN" "Would remove Adobe CoreSync"
    fi
  fi

  # 5. Notion Partitions
  local notion_cache="$HOME/Library/Application Support/Notion/Partitions"
  if [ -d "$notion_cache" ]; then
    if [ "$DRY_RUN" = false ]; then
      local size
      size=$(du -sh "$notion_cache" 2>/dev/null | cut -f1)
      rm -rf "$notion_cache"
      log "ACTION" "Notion Partitions removed (${size})"
    else
      log "DRY-RUN" "Would remove Notion Partitions"
    fi
  fi

  # 6. npm cache
  if [ "$DRY_RUN" = false ]; then
    rm -rf "$HOME/.npm/_npx" "$HOME/.npm/_logs" "$HOME/.npm/_prebuilds" "$HOME/.npm/_cacache" 2>/dev/null
    log "ACTION" "npm cache cleared"
  else
    log "DRY-RUN" "Would clear npm cache"
  fi

  # 7. Build caches on SSD (if connected)
  if [ -d "$DEV_DIR" ]; then
    if [ "$DRY_RUN" = false ]; then
      local freed=0
      # __pycache__
      while IFS= read -r cache_dir; do
        rm -rf "$cache_dir" 2>/dev/null && freed=$((freed + 1))
      done < <(find "$DEV_DIR" -maxdepth 6 -name "__pycache__" -type d 2>/dev/null)

      # .next build cache
      while IFS= read -r next_dir; do
        rm -rf "$next_dir" 2>/dev/null && freed=$((freed + 1))
      done < <(find "$DEV_DIR" -maxdepth 5 -name ".next" -type d 2>/dev/null)

      # .turbo cache
      while IFS= read -r turbo_dir; do
        rm -rf "$turbo_dir" 2>/dev/null && freed=$((freed + 1))
      done < <(find "$DEV_DIR" -maxdepth 5 -name ".turbo" -type d 2>/dev/null)

      log "ACTION" "Build caches removed: ${freed} directories"
    else
      local count
      count=$(find "$DEV_DIR" -maxdepth 6 \( -name "__pycache__" -o -name ".next" -o -name ".turbo" \) -type d 2>/dev/null | wc -l | tr -d ' ')
      log "DRY-RUN" "Would remove ${count} build cache directories"
    fi
  fi
}

# Level 3: 緊急対応
action_level3() {
  log "ACTION" "=== Level 3: CRITICAL ==="
  action_level2

  # 8. Implicit/conversations cache
  if [ "$DRY_RUN" = false ]; then
    rm -rf "$HOME/.gemini/antigravity/implicit/"* 2>/dev/null
    find "$HOME/.gemini/antigravity/conversations" -name "*.pb" -mtime +1 -delete 2>/dev/null
    log "ACTION" "Antigravity implicit + old conversations cleared"
  else
    log "DRY-RUN" "Would clear Antigravity implicit + old conversations"
  fi

  # 9. Spotlight temporary pause (helps free CPU + memory)
  if [ "$DRY_RUN" = false ]; then
    if sudo -n mdutil -i off / 2>/dev/null; then
      log "ACTION" "Spotlight indexing paused"
      # Re-enable after 10 minutes via background job
      (sleep 600 && sudo -n mdutil -i on / 2>/dev/null && log "ACTION" "Spotlight indexing re-enabled") &
    else
      log "WARN" "Cannot pause Spotlight (needs sudo)"
    fi
  else
    log "DRY-RUN" "Would pause Spotlight indexing for 10 min"
  fi

  # 10. macOS metadata cleanup on SSD
  if [ -d "$DEV_DIR" ]; then
    if [ "$DRY_RUN" = false ]; then
      find "$DEV_DIR" -name ".DS_Store" -type f -delete 2>/dev/null
      find "$DEV_DIR" -name "._*" -type f -not -path "*/.git/*" -delete 2>/dev/null
      log "ACTION" "macOS metadata files cleaned from SSD"
    else
      local ds_count
      ds_count=$(find "$DEV_DIR" -name ".DS_Store" -type f 2>/dev/null | wc -l | tr -d ' ')
      local apple_count
      apple_count=$(find "$DEV_DIR" -name "._*" -type f -not -path "*/.git/*" 2>/dev/null | wc -l | tr -d ' ')
      log "DRY-RUN" "Would remove ${ds_count} .DS_Store + ${apple_count} ._ files"
    fi
  fi

  log "ALERT" "⚠️ CRITICAL memory state detected. Consider closing unused apps."
}

# --- Main ---
main() {
  rotate_log
  acquire_lock
  check_interval

  log "INFO" "Memory Guardian started (PID: $$)"

  # Get current memory state
  get_memory_info
  local before_free="$FREE_PERCENT"
  local before_swap="$SWAP_USED_MB"

  log "INFO" "Memory: ${FREE_PERCENT}% free (${FREE_MB} MB), SWAP: ${SWAP_USED_MB} MB, Compressor: ${COMPRESSOR_MB} MB"

  # Determine action level
  local action_level=0

  if [ "$FORCE" = true ]; then
    action_level=2
    log "INFO" "Force mode: executing Level 2"
  elif [ "$FREE_PERCENT" -lt "$THRESHOLD_L3" ] || [ "$SWAP_USED_MB" -gt "$SWAP_CRITICAL" ]; then
    action_level=3
  elif [ "$FREE_PERCENT" -lt "$THRESHOLD_L2" ]; then
    action_level=2
  elif [ "$FREE_PERCENT" -lt "$THRESHOLD_L1" ]; then
    action_level=1
  fi

  if [ "$action_level" -eq 0 ]; then
    log "INFO" "Memory OK (${FREE_PERCENT}% free). No action needed."
    # Save state
    cat > "$STATE_FILE" << EOF
last_ts=$(date +%s)
last_run=$(date '+%Y-%m-%d %H:%M:%S')
last_level=0
freed_mb=0
before_free=${before_free}
status=OK
EOF
    exit 0
  fi

  # Execute appropriate level
  case "$action_level" in
    1) action_level1 ;;
    2) action_level2 ;;
    3) action_level3 ;;
  esac

  # Re-check memory after actions
  if [ "$DRY_RUN" = false ]; then
    sleep 2  # Let OS settle
    get_memory_info
    local freed_mb=$(( FREE_MB - (before_free * $(sysctl -n hw.memsize) / 100 / 1024 / 1024) ))
    freed_mb=${freed_mb#-}  # abs value

    log "RESULT" "After: ${FREE_PERCENT}% free (${FREE_MB} MB), SWAP: ${SWAP_USED_MB} MB"
    log "RESULT" "Level ${action_level} completed"

    # Save state
    cat > "$STATE_FILE" << EOF
last_ts=$(date +%s)
last_run=$(date '+%Y-%m-%d %H:%M:%S')
last_level=${action_level}
freed_mb=${freed_mb}
before_free=${before_free}
after_free=${FREE_PERCENT}
swap_before=${before_swap}
swap_after=${SWAP_USED_MB}
status=ACTED
EOF
  else
    log "DRY-RUN" "Dry run complete. No changes made."
  fi
}

main
