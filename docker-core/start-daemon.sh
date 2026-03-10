#!/usr/bin/env bash
# start-daemon.sh — Daemon Core 自動起動スクリプト
# macOSログイン時に LaunchAgent から呼び出される

set -euo pipefail

DOCKER_CORE_DIR="$HOME/.antigravity/docker-core"
LOG_FILE="$HOME/.antigravity/.daemon-autostart.log"
MAX_WAIT=120  # OrbStack起動を最大2分待つ

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log "=== Daemon Core 自動起動開始 ==="

# ─── OrbStack 起動 ──────────────────────────────────────────────────────────
log "OrbStack を起動中..."
open -jg -a OrbStack 2>/dev/null || true   # -j: バックグラウンド -g: 最前面に出さない

# ─── Docker daemon が応答するまで待機 ─────────────────────────────────────
log "Docker daemon の接続を待機中（最大 ${MAX_WAIT}s）..."
elapsed=0
until docker info >/dev/null 2>&1; do
  if [ $elapsed -ge $MAX_WAIT ]; then
    log "ERROR: Docker daemon が ${MAX_WAIT}s 以内に起動しませんでした。中断します。"
    exit 1
  fi
  sleep 3
  elapsed=$((elapsed + 3))
  log "  ... 待機中 ${elapsed}s"
done

log "Docker daemon 接続確認 ✅"

# ─── daemon_core コンテナが既に実行中かチェック ────────────────────────────
if docker ps --filter "name=daemon_core" --filter "status=running" | grep -q daemon_core; then
  log "daemon_core は既に実行中です。スキップします。"
  exit 0
fi

# ─── docker-compose up -d ─────────────────────────────────────────────────
log "docker-compose up -d を実行中..."
cd "$DOCKER_CORE_DIR"
docker-compose up -d --build 2>&1 | tee -a "$LOG_FILE"

# ─── 起動確認 ──────────────────────────────────────────────────────────────
sleep 5
if docker ps --filter "name=daemon_core" --filter "status=running" | grep -q daemon_core; then
  log "daemon_core 起動成功 ✅"
else
  log "WARN: daemon_core の起動が確認できませんでした。"
  docker-compose logs --tail=20 2>&1 | tee -a "$LOG_FILE"
fi

log "=== 完了 ==="
