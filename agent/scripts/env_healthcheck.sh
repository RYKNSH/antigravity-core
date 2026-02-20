#!/bin/bash
# env_healthcheck.sh — 環境ヘルスチェック & 自動修復
#
# /checkin から自動実行。環境問題を検出し、修正可能なものは即座に自動修復する。
# 全チェック合計 10秒以内（各チェックにタイムアウト付き）。
#
# Usage:
#   env_healthcheck.sh          # フルチェック（/checkin 組み込み用）
#   env_healthcheck.sh --fix    # 問題があれば修正のみ（サイレント）
#   env_healthcheck.sh --check  # チェックのみ（修正しない）

set -uo pipefail

ANTIGRAVITY_DIR="${ANTIGRAVITY_DIR:-$HOME/.antigravity}"
FIXED=0
WARNINGS=0
MODE="${1:---full}"

# macOS互換タイムアウト
_t() { local d=$1; shift; "$@" & local p=$!; (sleep "$d" && kill "$p" 2>/dev/null) & local tp=$!; wait "$p" 2>/dev/null; local r=$?; kill "$tp" 2>/dev/null; wait "$tp" 2>/dev/null; return $r; }

log_fix()  { FIXED=$((FIXED + 1));    echo "  ✅ Auto-fixed: $1"; }
log_warn() { WARNINGS=$((WARNINGS + 1)); echo "  ⚠️  Action needed: $1"; }
log_ok()   { [ "$MODE" != "--fix" ] && echo "  ✓ $1"; }

# ═══════════════════════════════════════════════════════
# 1. Git Global Config
# ═══════════════════════════════════════════════════════
check_git_config() {
  local needs_fix=0

  # .gitconfig 存在確認
  if [ ! -f "$HOME/.gitconfig" ]; then
    needs_fix=1
  fi

  # http.postBuffer（デフォルト1MBでは大きなpushでタイムアウトする）
  local post_buffer
  post_buffer=$(git config --global http.postBuffer 2>/dev/null || echo "")
  if [ -z "$post_buffer" ] || [ "$post_buffer" -lt 524288000 ] 2>/dev/null; then
    if [ "$MODE" != "--check" ]; then
      git config --global http.postBuffer 524288000
      log_fix "http.postBuffer = 500MB"
    else
      log_warn "http.postBuffer 未設定 or 不足"
    fi
  else
    log_ok "http.postBuffer = $post_buffer"
  fi

  # http.lowSpeedLimit / lowSpeedTime（低速接続でのタイムアウト防止）
  local low_limit low_time
  low_limit=$(git config --global http.lowSpeedLimit 2>/dev/null || echo "")
  low_time=$(git config --global http.lowSpeedTime 2>/dev/null || echo "")
  if [ -z "$low_limit" ] || [ -z "$low_time" ]; then
    if [ "$MODE" != "--check" ]; then
      git config --global http.lowSpeedLimit 1000
      git config --global http.lowSpeedTime 300
      log_fix "http.lowSpeedLimit=1000, lowSpeedTime=300"
    else
      log_warn "http.lowSpeed* 未設定"
    fi
  else
    log_ok "http.lowSpeedLimit=$low_limit, lowSpeedTime=$low_time"
  fi

  # credential.helper（macOS Keychain）
  local cred_helper
  cred_helper=$(git config --global credential.helper 2>/dev/null || echo "")
  if [ -z "$cred_helper" ]; then
    if [ "$MODE" != "--check" ]; then
      git config --global credential.helper osxkeychain
      log_fix "credential.helper = osxkeychain"
    else
      log_warn "credential.helper 未設定"
    fi
  else
    log_ok "credential.helper = $cred_helper"
  fi

  # pack settings（大きなリポジトリのパフォーマンス）
  local pack_wm
  pack_wm=$(git config --global pack.windowMemory 2>/dev/null || echo "")
  if [ -z "$pack_wm" ]; then
    if [ "$MODE" != "--check" ]; then
      git config --global pack.windowMemory 256m
      git config --global pack.packSizeLimit 100m
      log_fix "pack.windowMemory=256m, packSizeLimit=100m"
    else
      log_warn "pack.* 未設定"
    fi
  else
    log_ok "pack.windowMemory=$pack_wm"
  fi

  # user.name / user.email
  local uname uemail
  uname=$(git config --global user.name 2>/dev/null || echo "")
  uemail=$(git config --global user.email 2>/dev/null || echo "")
  if [ -z "$uname" ] || [ -z "$uemail" ]; then
    # ローカルリポジトリから補完を試みる
    if [ -z "$uname" ]; then
      local local_name
      local_name=$(find ~/Desktop -name ".git" -type d -maxdepth 4 -exec sh -c 'cd "$(dirname "{}")" && git config user.name 2>/dev/null' \; 2>/dev/null | head -1)
      if [ -n "$local_name" ] && [ "$MODE" != "--check" ]; then
        git config --global user.name "$local_name"
        log_fix "user.name = $local_name (ローカルリポジトリから補完)"
      elif [ -z "$local_name" ]; then
        log_warn "user.name 未設定（手動設定が必要）"
      fi
    fi
    if [ -z "$uemail" ]; then
      local local_email
      local_email=$(find ~/Desktop -name ".git" -type d -maxdepth 4 -exec sh -c 'cd "$(dirname "{}")" && git config user.email 2>/dev/null' \; 2>/dev/null | head -1)
      if [ -n "$local_email" ] && [ "$MODE" != "--check" ]; then
        git config --global user.email "$local_email"
        log_fix "user.email = $local_email (ローカルリポジトリから補完)"
      elif [ -z "$local_email" ]; then
        log_warn "user.email 未設定（手動設定が必要）"
      fi
    fi
  else
    log_ok "user = $uname <$uemail>"
  fi
}

# ═══════════════════════════════════════════════════════
# 2. Git接続テスト
# ═══════════════════════════════════════════════════════
check_git_connectivity() {
  # 現在のディレクトリまたはワークスペース内のgitリポジトリで接続テスト
  local test_dir=""
  if git rev-parse --show-toplevel >/dev/null 2>&1; then
    test_dir="."
  else
    test_dir=$(find ~/Desktop -name ".git" -type d -maxdepth 4 2>/dev/null | head -1)
    if [ -n "$test_dir" ]; then
      test_dir=$(dirname "$test_dir")
    fi
  fi

  if [ -n "$test_dir" ]; then
    local remote_url
    remote_url=$(cd "$test_dir" && git remote get-url origin 2>/dev/null || echo "")
    if [ -n "$remote_url" ]; then
      if _t 5 sh -c "cd \"$test_dir\" && GIT_TERMINAL_PROMPT=0 git ls-remote --exit-code origin HEAD >/dev/null 2>&1"; then
        log_ok "Git接続: $remote_url → OK"
      else
        log_warn "Git接続タイムアウト: $remote_url（ネットワーク確認が必要）"
      fi
    fi
  fi
}

# ═══════════════════════════════════════════════════════
# 3. Node環境
# ═══════════════════════════════════════════════════════
check_node_env() {
  if command -v node >/dev/null 2>&1; then
    log_ok "Node: $(node --version)"
  else
    log_warn "Node.js が見つかりません"
  fi

  if command -v pnpm >/dev/null 2>&1; then
    log_ok "pnpm: $(pnpm --version)"
  elif command -v npm >/dev/null 2>&1; then
    log_ok "npm: $(npm --version) (pnpm推奨)"
  else
    log_warn "pnpm/npm が見つかりません"
  fi
}

# ═══════════════════════════════════════════════════════
# 4. ディスク容量
# ═══════════════════════════════════════════════════════
check_disk_space() {
  local avail_kb
  avail_kb=$(df -k . 2>/dev/null | tail -1 | awk '{print $4}')
  if [ -n "$avail_kb" ] && [ "$avail_kb" -lt 5242880 ] 2>/dev/null; then
    local avail_gb=$((avail_kb / 1048576))
    log_warn "ディスク残量: ${avail_gb}GB（5GB未満、/cleanup-48h 推奨）"
  else
    local avail_gb=$((avail_kb / 1048576))
    log_ok "ディスク残量: ${avail_gb}GB"
  fi
}

# ═══════════════════════════════════════════════════════
# 5. ゾンビプロセス
# ═══════════════════════════════════════════════════════
check_zombie_processes() {
  local zombie_count
  zombie_count=$(ps aux | grep -E "node.*--max-old-space|next dev|vite" | grep -v grep | wc -l | tr -d ' ')
  if [ "$zombie_count" -gt 5 ]; then
    log_warn "ゾンビNode候補 ${zombie_count}件（'ps aux | grep node' で確認推奨）"
  else
    log_ok "Node プロセス: ${zombie_count}件"
  fi
}

# ═══════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════
echo "🏥 Environment Health Check..."

check_git_config
check_git_connectivity
check_node_env
check_disk_space
check_zombie_processes

if [ $FIXED -gt 0 ] || [ $WARNINGS -gt 0 ]; then
  echo "🏥 Result: ${FIXED} auto-fixed, ${WARNINGS} warnings"
else
  echo "🏥 All clear ✨"
fi
