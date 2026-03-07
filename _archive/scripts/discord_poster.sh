#!/bin/bash
set -euo pipefail

# 1. Global Env Retrieval
ENV_PATH=".env"
[ ! -f "$ENV_PATH" ] && ENV_PATH="${ANTIGRAVITY_DIR:-$HOME/.antigravity}/.env"
[ ! -f "$ENV_PATH" ] && ENV_PATH="$HOME/.env"

if [ -f "$ENV_PATH" ]; then
  # Load env vars safely (ignoring comments)
  set -a
  source <(grep -v '^#' "$ENV_PATH" | sed -E 's/(.*)=(".*"|'"'.*'"'|.*)/\1=\2/')
  set +a
fi

WEBHOOK_URL="${DISCORD_WEBHOOK_URL:-}"
NOTION_API_KEY="${NOTION_API_KEY:-}"

if [ -z "$WEBHOOK_URL" ]; then
    echo "ERROR: DISCORD_WEBHOOK_URL not found." >&2
    exit 1
fi
if [ -z "$NOTION_API_KEY" ]; then
    echo "ERROR: NOTION_API_KEY not found." >&2
    exit 1
fi

PAGE_ID="${1:-}"
if [ -z "$PAGE_ID" ]; then
    echo "Usage: bash discord_poster.sh <Notion_Page_ID>" >&2
    exit 1
fi

echo "Fetching Notion Page: $PAGE_ID..."

# 2. Extract Title from Notion Page
PAGE_JSON=$(curl -s --max-time 15 -X GET "https://api.notion.com/v1/pages/$PAGE_ID" \
  -H "Authorization: Bearer $NOTION_API_KEY" \
  -H "Notion-Version: 2022-06-28")

# Extract title using rudimentary grep/awk (since jq might not be guaranteed, or we use perl/ruby/python built-in)
# To be robust without jq, we can use node just for extracting JSON, or standard python json.tool
TITLE=$(echo "$PAGE_JSON" | python3 -c "
import sys, json
try:
  d = json.load(sys.stdin)
  props = d.get('properties', {})
  title_prop = props.get('ドキュメント名', {}).get('title', [])
  print(title_prop[0]['plain_text'] if title_prop else 'Untitled')
except:
  print('Untitled')
")

# 3. Extract Blocks (Content)
BLOCKS_JSON=$(curl -s --max-time 15 -X GET "https://api.notion.com/v1/blocks/$PAGE_ID/children?page_size=100" \
  -H "Authorization: Bearer $NOTION_API_KEY" \
  -H "Notion-Version: 2022-06-28")

EXCERPT=$(echo "$BLOCKS_JSON" | python3 -c "
import sys, json
try:
  d = json.load(sys.stdin)
  excerpt = ''
  for b in d.get('results', []):
    t = b.get('type')
    if not t: continue
    obj = b.get(t, {})
    rich_text = obj.get('rich_text', [])
    text = ''.join([rt.get('plain_text', '') for rt in rich_text])
    if not text: continue
    
    if t == 'heading_1': excerpt += '# ' + text + '\n\n'
    elif t == 'heading_2': excerpt += '## ' + text + '\n\n'
    elif t == 'heading_3': excerpt += '### ' + text + '\n\n'
    elif t == 'bulleted_list_item': excerpt += '- ' + text + '\n'
    elif t == 'numbered_list_item': excerpt += '1. ' + text + '\n'
    elif t == 'paragraph': excerpt += text + '\n\n'
    else: excerpt += text + '\n'
  
  # Max 1900 chars for Discord
  print(excerpt.strip()[:1900])
except Exception as e:
  pass
")

# 4. Post to Discord Webhook
echo "Posting to Discord..."

# Construct JSON payload safely
PAYLOAD=$(python3 -c "
import json, sys
print(json.dumps({
  'content': sys.argv[1],
  'thread_name': sys.argv[2]
}))
" "$EXCERPT" "$TITLE")

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 --retry 3 -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

if [[ "$HTTP_CODE" =~ ^2 ]]; then
  echo "✅ Posted to Discord. (HTTP $HTTP_CODE)"
else
  echo "❌ Error posting to Discord. (HTTP $HTTP_CODE)" >&2
  exit 1
fi
