#!/bin/bash
# memory_guardian_lib.sh — ヘルパー関数集
# memory_guardian.sh から source される

# --- Configuration ---
CMD_TIMEOUT=${CMD_TIMEOUT:-15}
FIND_TIMEOUT=${FIND_TIMEOUT:-20}

# --- Safe Command Execution (with timeout) ---
run_with_timeout() {
  local timeout_sec="$1"; shift
  local label="$1"; shift
  if command -v gtimeout &>/dev/null; then
    gtimeout "${timeout_sec}s" "$@" 2>/dev/null
  elif command -v timeout &>/dev/null; then
    timeout "${timeout_sec}s" "$@" 2>/dev/null
  else
    "$@" &
    local cmd_pid=$!
    local elapsed=0
    while kill -0 "$cmd_pid" 2>/dev/null; do
      sleep 1
      elapsed=$((elapsed + 1))
      if [ "$elapsed" -ge "$timeout_sec" ]; then
        kill -9 "$cmd_pid" 2>/dev/null || true
        wait "$cmd_pid" 2>/dev/null || true
        log "TIMEOUT" "$label timed out after ${timeout_sec}s — killed"
        return 124
      fi
    done
    wait "$cmd_pid" 2>/dev/null
    return $?
  fi
  local rc=$?
  [ "$rc" -eq 124 ] && log "TIMEOUT" "$label timed out after ${timeout_sec}s"
  return $rc
}

safe_find() { run_with_timeout "$FIND_TIMEOUT" "find" find "$@"; }
safe_rm()   { run_with_timeout "$CMD_TIMEOUT" "rm" rm "$@"; }
safe_du()   { run_with_timeout "$CMD_TIMEOUT" "du" du "$@"; }

# --- Memory Info ---
get_memory_info() {
  local page_size
  page_size=$(run_with_timeout "$CMD_TIMEOUT" "sysctl-pagesize" sysctl -n hw.pagesize 2>/dev/null) || page_size=16384
  page_size=${page_size:-16384}

  local vm_output
  vm_output=$(run_with_timeout "$CMD_TIMEOUT" "vm_stat" vm_stat 2>/dev/null) || vm_output=""
  if [ -z "$vm_output" ]; then
    log "WARN" "vm_stat timed out or failed, using safe defaults"
    FREE_PERCENT=50; FREE_MB=4096; SWAP_USED_MB=0; COMPRESSOR_MB=0
    return
  fi

  local free_pages speculative_pages inactive_pages
  free_pages=$(echo "$vm_output" | awk '/Pages free/ {gsub(/\./,"",$3); print $3}')
  speculative_pages=$(echo "$vm_output" | awk '/Pages speculative/ {gsub(/\./,"",$3); print $3}')
  inactive_pages=$(echo "$vm_output" | awk '/Pages inactive/ {gsub(/\./,"",$3); print $3}')
  local memsize
  memsize=$(run_with_timeout "$CMD_TIMEOUT" "sysctl-memsize" sysctl -n hw.memsize 2>/dev/null) || memsize=8589934592
  memsize=${memsize:-8589934592}
  local total_pages=$((memsize / page_size))
  local available_pages=$(( ${free_pages:-0} + ${speculative_pages:-0} + ${inactive_pages:-0} ))

  FREE_PERCENT=$(( available_pages * 100 / total_pages ))
  FREE_MB=$(( available_pages * page_size / 1024 / 1024 ))

  local swap_info
  swap_info=$(run_with_timeout "$CMD_TIMEOUT" "sysctl-swap" sysctl vm.swapusage 2>/dev/null) || swap_info=""
  SWAP_USED_MB=$(echo "$swap_info" | awk '{for(i=1;i<=NF;i++) if($i=="used") {gsub(/M/,"",$(i+2)); printf "%.0f", $(i+2)}}')
  SWAP_USED_MB=${SWAP_USED_MB:-0}

  COMPRESSOR_PAGES=$(echo "$vm_output" | awk '/Pages stored in compressor/ {gsub(/\./,"",$NF); print $NF}')
  COMPRESSOR_PAGES=${COMPRESSOR_PAGES:-0}
  COMPRESSOR_MB=$(( COMPRESSOR_PAGES * page_size / 1024 / 1024 ))
}

# --- Active Project Detection ---
get_active_project_dirs() {
  ACTIVE_DIRS=()
  _safe_lsof_cwd() {
    local result
    result=$(run_with_timeout 5 "lsof-$1" lsof -p "$1" 2>/dev/null | awk '/cwd/ {print $NF}' | head -1) || true
    echo "$result"
  }
  local pids
  pids=$(run_with_timeout 5 "pgrep-devservers" pgrep -f "next dev|next start|vite|nuxt|uvicorn|flask|gunicorn" 2>/dev/null) || true
  for pid in $pids; do
    local cwd=$(_safe_lsof_cwd "$pid")
    [ -n "$cwd" ] && [[ "$cwd" == "${DEV_DIR:-$HOME/Desktop}"* ]] && ACTIVE_DIRS+=("$cwd")
  done
  local node_pids
  node_pids=$(run_with_timeout 5 "pgrep-node" pgrep -x "node" 2>/dev/null) || true
  for pid in $node_pids; do
    local cwd=$(_safe_lsof_cwd "$pid")
    [ -n "$cwd" ] && [[ "$cwd" == "${DEV_DIR:-$HOME/Desktop}"* ]] && ACTIVE_DIRS+=("$cwd")
  done
  # 重複除去
  if [ ${#ACTIVE_DIRS[@]} -gt 0 ]; then
    local unique=() seen=""
    for d in "${ACTIVE_DIRS[@]}"; do
      [[ "$seen" != *"$d"* ]] && unique+=("$d") && seen="$seen|$d"
    done
    ACTIVE_DIRS=("${unique[@]}")
    log "INFO" "Active projects detected: ${ACTIVE_DIRS[*]}"
  fi
}

is_active_project() {
  local target_dir="$1"
  [ ${#ACTIVE_DIRS[@]} -eq 0 ] && return 1
  for active in "${ACTIVE_DIRS[@]}"; do
    [[ "$target_dir" == "$active"* ]] || [[ "$active" == "$target_dir"* ]] && return 0
  done
  return 1
}
