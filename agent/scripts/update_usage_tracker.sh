#!/bin/bash
# update_usage_tracker.sh - USAGE_TRACKER.md のワークフロー使用記録を更新
# 使用法: ./update_usage_tracker.sh <workflow_name>
# 例: ./update_usage_tracker.sh /checkin

TRACKER_FILE="/Volumes/PortableSSD/.antigravity/USAGE_TRACKER.md"
WORKFLOW="${1:-unknown}"
TODAY=$(date +"%Y-%m-%d")

if [ ! -f "$TRACKER_FILE" ]; then
    echo "❌ USAGE_TRACKER.md not found at $TRACKER_FILE"
    exit 1
fi

# ワークフロー名から先頭の / を除去（ファイル内のフォーマットに合わせる）
WORKFLOW_NAME=$(echo "$WORKFLOW" | sed 's/^\///')

# 現在のカウントを取得し +1
CURRENT_LINE=$(grep "| /$WORKFLOW_NAME |" "$TRACKER_FILE")
if [ -z "$CURRENT_LINE" ]; then
    echo "⚠️ Workflow /$WORKFLOW_NAME not found in tracker"
    exit 1
fi

CURRENT_COUNT=$(echo "$CURRENT_LINE" | awk -F'|' '{print $3}' | tr -d ' ')
NEW_COUNT=$((CURRENT_COUNT + 1))

# sedで該当行を更新
sed -i '' "s/| \/$WORKFLOW_NAME | [0-9]* | .* |/| \/$WORKFLOW_NAME | $NEW_COUNT | $TODAY |/" "$TRACKER_FILE"

echo "✅ Updated /$WORKFLOW_NAME: $CURRENT_COUNT → $NEW_COUNT (Last: $TODAY)"
