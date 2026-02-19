#!/bin/bash
# monitor_resources.sh
# Checks for active Node processes consuming excessive CPU (>= 80%)
# Usage: Run in background or via cron/launchd

LOG_FILE="$HOME/.antigravity/logs/resource_monitor.log"
mkdir -p "$(dirname "$LOG_FILE")"

# Thresholds
CPU_LIMIT=80

# Get Node processes with high CPU
HIGH_CPU_PROCESSES=$(ps -eo pid,pcpu,comm | grep -i "node" | awk -v limit="$CPU_LIMIT" '$2 > limit {print $0}')

if [ ! -z "$HIGH_CPU_PROCESSES" ]; then
  TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")
  echo "[$TIMESTAMP] 🚨 High CPU Detect detected:" >> "$LOG_FILE"
  echo "$HIGH_CPU_PROCESSES" >> "$LOG_FILE"
  
  # Notification (macOS)
  osascript -e 'display notification "Node process consuming >80% CPU. Check Monitor." with title "Antigravity Alert" sound name "Basso"'
fi
