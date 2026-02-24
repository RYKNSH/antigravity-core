#!/bin/bash
# RYKNSH Life-OS — Daily Automation Cron
# Run daily (e.g., 06:00 AM via launchd or cron)
# Usage: bash lifeos_cron.sh
# Install: crontab -e → 0 6 * * * /bin/bash ~/.antigravity/agent/scripts/lifeos_cron.sh

set -euo pipefail

SCRIPTS_DIR="$HOME/.antigravity/agent/scripts"
LOG_FILE="$HOME/.antigravity/logs/lifeos_$(date +%Y-%m-%d).log"
mkdir -p "$HOME/.antigravity/logs"

echo "[$(date +%Y-%m-%dT%H:%M:%S)] 🚀 Life-OS Daily Cron Started" | tee -a "$LOG_FILE"

# ── Phase 1: Collect Life Logs ──────────────────────────────────────────────
echo "[$(date)] 📡 Collecting Discord logs..." | tee -a "$LOG_FILE"
node "$SCRIPTS_DIR/discord_log_collector.js" >> "$LOG_FILE" 2>&1

echo "[$(date)] 🐙 Collecting GitHub commits..." | tee -a "$LOG_FILE"
node "$SCRIPTS_DIR/github_log_collector.js" >> "$LOG_FILE" 2>&1

# ── Phase 2: Generate Content (Ada → Cyrus) ─────────────────────────────────
echo "[$(date)] 🧠 Ada is generating content from logs..." | tee -a "$LOG_FILE"
echo "[$(date)] 🧠 Ada is generating content from logs..." | tee -a "$LOG_FILE"
node "$SCRIPTS_DIR/ada_processor.js" --auto 2>>"$LOG_FILE" | tee \
  >(node "$SCRIPTS_DIR/cyrus_factory.js" >> "$LOG_FILE" 2>&1) \
  >(node "$SCRIPTS_DIR/x_poster.js" >> "$LOG_FILE" 2>&1) \
  > /dev/null


echo "[$(date)] ✅ Life-OS Cron Complete!" | tee -a "$LOG_FILE"
