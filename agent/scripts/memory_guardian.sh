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
#   memory_guardian.sh --force      閾値無視でL2実行
#   memory_guardian.sh --force-level 3  閾値無視で指定レベル実行
#   memory_guardian.sh --status     現在の状態を表示
# ============================================================

set -uo pipefail
# NOTE: set -e を外してタイムアウトによる非ゼロ終了をハンドリング可能に

# --- Configuration (Dynamic Thresholds) ---
# RAM量に応じて閾値を動的に決定
RAM_BYTES=$(sysctl -n hw.memsize 2>/dev/null || awk '/MemTotal/ {print $2 * 1024}' /proc/meminfo 2>/dev/null || echo 8589934592)
RAM_GB=$((RAM_BYTES / 1024 / 1024 / 1024))

if [ "$RAM_GB" -le 8 ]; then
  # 8GB以下: 早期介入の閾値（2026-02-28 引上げ: I/Oハング連発対策）
  THRESHOLD_L1=40
  THRESHOLD_L2=30
  THRESHOLD_L3=20
  SWAP_CRITICAL=1024
elif [ "$RAM_GB" -le 16 ]; then
  # 16GB: 標準
  THRESHOLD_L1=30
  THRESHOLD_L2=20
  THRESHOLD_L3=10
  SWAP_CRITICAL=2048
else
  # 32GB+: 余裕あり
  THRESHOLD_L1=25
  THRESHOLD_L2=15
  THRESHOLD_L3=8
  SWAP_CRITICAL=4096
fi

INTERVAL_GUARD=240 # 最低実行間隔 (秒) — 連続実行防止

# --- Timeout Configuration ---
GLOBAL_TIMEOUT=120   # スクリプト全体の最大実行時間 (秒)
CMD_TIMEOUT=15       # 個別コマンドのタイムアウト (秒)
FIND_TIMEOUT=20      # find コマンドのタイムアウト (秒)
LOCK_STALE=600       # 古いロックファイルの判定閾値 (秒=10分)

LOG_FILE="/tmp/memory_guardian.log"
LOCK_DIR="${ANTIGRAVITY_DIR:-$HOME/.antigravity}/.locks/memory_guardian.lock"
STATE_FILE="/tmp/memory_guardian.state"
MAX_LOG_SIZE=1048576  # 1MB log rotation

# ローカルのプロジェクトディレクトリを対象とする
ANTIGRAVITY_DIR="${ANTIGRAVITY_DIR:-$HOME/.antigravity}"
DEV_DIR="$HOME/Desktop"

# --- ヘルパー関数のロード ---
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/memory_guardian_lib.sh"

# --- Flags ---
DRY_RUN=false
FORCE=false
FORCE_LEVEL=2  # --force 単体のデフォルト
STATUS_ONLY=false

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=true ;;
    --force)   FORCE=true ;;
    --force-level)
      FORCE=true
      shift
      FORCE_LEVEL="${1:-2}"
      ;;
    --status)  STATUS_ONLY=true ;;
  esac
  shift
done

# --- Logging ---
log() {
  local level="$1"; shift
  local msg="$*"
  local timestamp
  timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  echo "[$timestamp] [$level] $msg" >> "$LOG_FILE" 2>/dev/null || true
  if [ "$DRY_RUN" = true ] || [ "$STATUS_ONLY" = true ]; then
    echo "[$level] $msg"
  fi
}

# (ヘルパー関数は memory_guardian_lib.sh に分離済み)

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

# --- Lock (stale lock auto-recovery) ---
acquire_lock() {
  mkdir -p "${ANTIGRAVITY_DIR:-$HOME/.antigravity}/.locks" 2>/dev/null || true
  
  if [ -d "$LOCK_DIR" ]; then
    local lock_pid lock_ts now diff
    lock_pid=$(head -1 "$LOCK_DIR/pid" 2>/dev/null || echo "")
    lock_ts=$(head -1 "$LOCK_DIR/ts" 2>/dev/null || echo "0")
    now=$(date +%s)

    # PID が生きていてもロック取得から LOCK_STALE 秒超なら強制回収
    diff=$(( now - ${lock_ts:-0} ))
    if [ "$diff" -gt "$LOCK_STALE" ]; then
      log "WARN" "Stale lock detected (age: ${diff}s, PID: ${lock_pid}). Force-recovering."
      if [ -n "$lock_pid" ] && kill -0 "$lock_pid" 2>/dev/null; then
        kill -9 "$lock_pid" 2>/dev/null || true
        log "WARN" "Killed stale guardian process PID $lock_pid"
      fi
      rm -rf "$LOCK_DIR"
    elif [ -n "$lock_pid" ] && kill -0 "$lock_pid" 2>/dev/null; then
      log "WARN" "Another instance running (PID: $lock_pid, age: ${diff}s), exiting"
      exit 0
    else
      # PID dead, clean up
      rm -rf "$LOCK_DIR"
    fi
  fi
  
  # Try to create directory atomically
  if mkdir "$LOCK_DIR" 2>/dev/null; then
    echo $$ > "$LOCK_DIR/pid"
    date +%s > "$LOCK_DIR/ts"
  else
    log "WARN" "Failed to acquire lock. Another instance running?"
    exit 0
  fi
}

release_lock() {
  if [ -f "$LOCK_DIR/pid" ]; then
    local pid
    pid=$(cat "$LOCK_DIR/pid" 2>/dev/null || echo "")
    if [ "$pid" = "$$" ]; then
      rm -rf "$LOCK_DIR"
    fi
  fi
}

cleanup_and_exit() {
  local reason="${1:-unknown}"
  log "ABORT" "Guardian aborted: $reason"
  # State ファイルに異常終了を記録
  cat > "$STATE_FILE" << EOF
last_ts=$(date +%s)
last_run=$(date '+%Y-%m-%d %H:%M:%S')
last_level=ABORTED
freed_mb=0
status=TIMEOUT
abort_reason=$reason
EOF
  # Telemetry emission
  mkdir -p "${ANTIGRAVITY_DIR:-$HOME/.antigravity}/state"
  echo "- [$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [System Error] memory_guardian.sh aborted: $reason" >> "${ANTIGRAVITY_DIR:-$HOME/.antigravity}/state/SYSTEM_ALERTS.md"
  release_lock
  exit 1
}

trap release_lock EXIT
trap 'cleanup_and_exit "SIGTERM received"' TERM
trap 'cleanup_and_exit "SIGINT received"' INT

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

  # 1. purge (macOS) / drop_caches (Linux) — タイムアウト付き
  if [ "$DRY_RUN" = false ]; then
    if [ "$(uname)" = "Darwin" ]; then
      if run_with_timeout "$CMD_TIMEOUT" "purge(sudo)" sudo -n purge; then
        log "ACTION" "purge executed (sudo)"
      elif run_with_timeout "$CMD_TIMEOUT" "purge" purge; then
        log "ACTION" "purge executed (no sudo)"
      else
        log "WARN" "purge failed or timed out"
      fi
    else
      if run_with_timeout "$CMD_TIMEOUT" "drop_caches(sudo)" sudo -n sh -c 'sync; echo 3 > /proc/sys/vm/drop_caches'; then
        log "ACTION" "drop_caches executed (sudo)"
      else
        log "WARN" "drop_caches failed or timed out"
      fi
    fi
  else
    log "DRY-RUN" "Would execute: purge / drop_caches"
  fi

  # 2. Antigravity browser_recordings (48h+)
  local recordings_dir="$HOME/.gemini/antigravity/browser_recordings"
  if [ -d "$recordings_dir" ]; then
    if [ "$DRY_RUN" = false ]; then
      local count
      count=$(safe_find "$recordings_dir" -type f -mtime +2 2>/dev/null | wc -l | tr -d ' ')
      safe_find "$recordings_dir" -type f -mtime +2 -delete 2>/dev/null || true
      safe_find "$recordings_dir" -type d -empty -delete 2>/dev/null || true
      log "ACTION" "browser_recordings: ${count} old files removed"
    else
      local count
      count=$(safe_find "$recordings_dir" -type f -mtime +2 2>/dev/null | wc -l | tr -d ' ')
      log "DRY-RUN" "Would remove ${count} old browser_recordings"
    fi
  fi

  # 3. Chrome Service Worker (Chrome未起動時のみ)
  local chrome_sw="$HOME/Library/Application Support/Google/Chrome/Default/Service Worker"
  if [ -d "$chrome_sw" ]; then
    if pgrep -q "Google Chrome" 2>/dev/null; then
      log "SKIP" "Chrome SW: Chrome is running, skipping (safe at L2+)"
    elif [ "$DRY_RUN" = false ]; then
      local sw_size
      sw_size=$(safe_du -sh "$chrome_sw" 2>/dev/null | cut -f1) || sw_size="?"
      safe_rm -rf "$chrome_sw" || true
      log "ACTION" "Chrome Service Worker removed (${sw_size})"
    else
      local sw_size
      sw_size=$(safe_du -sh "$chrome_sw" 2>/dev/null | cut -f1) || sw_size="?"
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
      size=$(safe_du -sh "$adobe_cache" 2>/dev/null | cut -f1) || size="?"
      safe_rm -rf "$adobe_cache" || true
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
      size=$(safe_du -sh "$notion_cache" 2>/dev/null | cut -f1) || size="?"
      safe_rm -rf "$notion_cache" || true
      log "ACTION" "Notion Partitions removed (${size})"
    else
      log "DRY-RUN" "Would remove Notion Partitions"
    fi
  fi

  # 6. npm cache
  if [ "$DRY_RUN" = false ]; then
    safe_rm -rf "$HOME/.npm/_npx" "$HOME/.npm/_logs" "$HOME/.npm/_prebuilds" "$HOME/.npm/_cacache" || true
    log "ACTION" "npm cache cleared"
  else
    log "DRY-RUN" "Would clear npm cache"
  fi

  # 7. Build caches (dev projects) — 実行中プロジェクト保護
  if [ -d "$DEV_DIR" ]; then
    get_active_project_dirs
    if [ "$DRY_RUN" = false ]; then
      local freed=0
      local skipped=0
      # 1回の find で __pycache__ / .next / .turbo を全取得（タイムアウト付き）
      local find_result
      find_result=$(safe_find "$DEV_DIR" -maxdepth 6 \( -name "__pycache__" -o -name ".next" -o -name ".turbo" \) -type d 2>/dev/null) || true
      if [ -n "$find_result" ]; then
        while IFS= read -r cache_dir; do
          [ -z "$cache_dir" ] && continue
          if is_active_project "$cache_dir"; then
            skipped=$((skipped + 1))
            local bname
            bname=$(basename "$cache_dir")
            [ "$bname" = ".next" ] || [ "$bname" = ".turbo" ] && log "PROTECT" "Skipping active: $cache_dir"
          else
            safe_rm -rf "$cache_dir" && freed=$((freed + 1))
          fi
        done <<< "$find_result"
      fi

      log "ACTION" "Build caches: ${freed} removed, ${skipped} protected (active)"
    else
      local count
      count=$(safe_find "$DEV_DIR" -maxdepth 6 \( -name "__pycache__" -o -name ".next" -o -name ".turbo" \) -type d 2>/dev/null | wc -l | tr -d ' ') || true
      log "DRY-RUN" "Would remove up to ${count} build cache directories (active projects protected)"
    fi
  fi
}

# Level 3: 緊急対応
action_level3() {
  log "ACTION" "=== Level 3: CRITICAL ==="
  action_level2

  # 8. Implicit/conversations cache (古いもののみ — 現在のセッション保護)
  if [ "$DRY_RUN" = false ]; then
    # implicit: 2時間以上前のファイルのみ削除（現在のセッションを保護）
    safe_find "$HOME/.gemini/antigravity/implicit" -type f -mmin +120 -delete 2>/dev/null || true
    # conversations: 24時間以上前のみ削除
    safe_find "$HOME/.gemini/antigravity/conversations" -name "*.pb" -mtime +1 -delete 2>/dev/null || true
    log "ACTION" "Antigravity old implicit (2h+) + old conversations (24h+) cleared"
  else
    log "DRY-RUN" "Would clear old Antigravity implicit + conversations"
  fi

  # 9. Spotlight temporary pause (helps free CPU + memory) — タイムアウト付き
  if [ "$DRY_RUN" = false ]; then
    if run_with_timeout "$CMD_TIMEOUT" "mdutil-off" sudo -n mdutil -i off / 2>/dev/null; then
      log "ACTION" "Spotlight indexing paused"
      # Re-enable after 10 minutes via background job
      (sleep 600 && sudo -n mdutil -i on / 2>/dev/null && log "ACTION" "Spotlight indexing re-enabled") &
    else
      log "WARN" "Cannot pause Spotlight (needs sudo or timed out)"
    fi
  else
    log "DRY-RUN" "Would pause Spotlight indexing for 10 min"
  fi

  # 10. macOS metadata cleanup — タイムアウト付き
  if [ -d "$DEV_DIR" ]; then
    if [ "$DRY_RUN" = false ]; then
      safe_find "$DEV_DIR" -name ".DS_Store" -type f -delete 2>/dev/null || true
      safe_find "$DEV_DIR" -name "._*" -type f -not -path "*/.git/*" -delete 2>/dev/null || true
      log "ACTION" "macOS metadata files cleaned"
    else
      local ds_count
      ds_count=$(safe_find "$DEV_DIR" -name ".DS_Store" -type f 2>/dev/null | wc -l | tr -d ' ') || true
      local apple_count
      apple_count=$(safe_find "$DEV_DIR" -name "._*" -type f -not -path "*/.git/*" 2>/dev/null | wc -l | tr -d ' ') || true
      log "DRY-RUN" "Would remove ${ds_count} .DS_Store + ${apple_count} ._ files"
    fi
  fi

  log "ALERT" "⚠️ CRITICAL memory state detected. Consider closing unused apps."
}

# --- Watchdog ---
# スクリプト全体に制限時間を設け、ハングを防止
start_watchdog() {
  if [ "$DRY_RUN" = true ] || [ "$STATUS_ONLY" = true ]; then
    return  # dry-run/status には watchdog 不要
  fi
  (
    sleep "$GLOBAL_TIMEOUT"
    # 親プロセスがまだ生きていたら強制終了
    if kill -0 $$ 2>/dev/null; then
      echo "[$(date '+%Y-%m-%d %H:%M:%S')] [WATCHDOG] Guardian PID $$ exceeded ${GLOBAL_TIMEOUT}s — killing" >> "$LOG_FILE"
      kill -TERM $$ 2>/dev/null
      sleep 2
      kill -9 $$ 2>/dev/null || true
    fi
  ) &
  WATCHDOG_PID=$!
  # watchdog 自体はスクリプト終了時に kill
  trap 'kill $WATCHDOG_PID 2>/dev/null; release_lock' EXIT
}

# --- Main ---
main() {
  rotate_log
  acquire_lock
  check_interval
  start_watchdog

  log "INFO" "Memory Guardian started (PID: $$, watchdog: ${GLOBAL_TIMEOUT}s)"

  # Get current memory state
  get_memory_info
  local before_free="$FREE_PERCENT"
  local before_swap="$SWAP_USED_MB"

  log "INFO" "Memory: ${FREE_PERCENT}% free (${FREE_MB} MB), SWAP: ${SWAP_USED_MB} MB, Compressor: ${COMPRESSOR_MB} MB"

  # Determine action level
  local action_level=0

  if [ "$FORCE" = true ]; then
    action_level=$FORCE_LEVEL
    log "INFO" "Force mode: executing Level ${FORCE_LEVEL}"
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
    sleep 1  # Let OS settle
    get_memory_info
    local freed_mb=$(( FREE_MB - (before_free * $(sysctl -n hw.memsize) / 100 / 1024 / 1024) ))
    freed_mb=${freed_mb#-}  # abs value

    log "RESULT" "After: ${FREE_PERCENT}% free (${FREE_MB} MB), SWAP: ${SWAP_USED_MB} MB"
    log "RESULT" "Level ${action_level} completed within ${GLOBAL_TIMEOUT}s limit"

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
