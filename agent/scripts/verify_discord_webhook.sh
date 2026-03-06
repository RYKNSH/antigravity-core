#!/bin/bash
set -euo pipefail

# Global Env Retrieval
ENV_PATH=".env"
[ ! -f "$ENV_PATH" ] && ENV_PATH="${ANTIGRAVITY_DIR:-$HOME/.antigravity}/.env"
[ ! -f "$ENV_PATH" ] && ENV_PATH="$HOME/.env"

if [ -f "$ENV_PATH" ]; then
  # Load env vars safely
  set -a
  source <(grep -v '^#' "$ENV_PATH" | sed -E 's/(.*)=(".*"|'"'.*'"'|.*)/\1=\2/')
  set +a
fi

WEBHOOK_URL="${DISCORD_WEBHOOK_URL:-}"

if [ -z "$WEBHOOK_URL" ]; then
    echo "ERROR: DISCORD_WEBHOOK_URL not found." >&2
    exit 1
fi

# Verify Webhook via curl with 10s timeout
echo "Verifying Discord Webhook..."
RESPONSE=$(curl -s --max-time 10 "$WEBHOOK_URL")

if echo "$RESPONSE" | grep -q '"message": "Unknown Webhook"'; then
  echo "❌ Error: Unknown Webhook or Invalid Token." >&2
  exit 1
elif echo "$RESPONSE" | grep -q '"id":'; then
  echo "✅ Webhook Verified!"
  echo "Webhook Details:"
  echo "$RESPONSE" | grep -E '"(channel_id|guild_id|name|avatar)"' | sed 's/[",]//g' | sed 's/^ *//' | sed 's/: /: /'
else
  echo "❌ Error: Unexpected response or Timeout." >&2
  echo "$RESPONSE" >&2
  exit 1
fi
