#!/bin/bash
# update_usage_tracker.sh - USAGE_TRACKER.md のワークフロー使用記録を更新
# 使用法: ./update_usage_tracker.sh <workflow_name>
# 例: ./update_usage_tracker.sh /checkin

ANTIGRAVITY_DIR="${ANTIGRAVITY_DIR:-$HOME/.antigravity}"
TRACKER_FILE="$ANTIGRAVITY_DIR/USAGE_TRACKER.md"
WORKFLOW="${1:-unknown}"
TODAY=$(date +"%Y-%m-%d")

if [ ! -f "$TRACKER_FILE" ]; then
    echo "❌ USAGE_TRACKER.md not found at $TRACKER_FILE"
    exit 1
fi

# ワークフロー名から先頭の / を除去（ファイル内のフォーマットに合わせる）
WORKFLOW_NAME=$(echo "$WORKFLOW" | sed 's/^\///')

# ワークフローの実在チェック (フィードバック対応)
# agent/workflows/WORKFLOW_NAME.md が存在するか確認する
WORKFLOW_FILE="$ANTIGRAVITY_DIR/agent/workflows/${WORKFLOW_NAME}.md"

if [ ! -f "$WORKFLOW_FILE" ]; then
    # 特別なケース: メタワークフローやエイリアスなど、ファイルがなくても追跡したいものがもしあればここで許可する
    # 現状は厳格にファイル存在チェックを行う
    # ただし、/go はワークフローファイル go.md があるのでOK
    echo "⚠️ Workflow file not found: $WORKFLOW_FILE. Skipping tracking to prevent clutter."
    exit 0
fi

# 現在のカウントを取得
CURRENT_LINE=$(grep "| /$WORKFLOW_NAME |" "$TRACKER_FILE")

if [ -z "$CURRENT_LINE" ]; then
    echo "⚠️ Workflow /$WORKFLOW_NAME not found in tracker. Adding new entry."
    
    LAST_TABLE_ROW=$(grep -n "^| /" "$TRACKER_FILE" | tail -1 | cut -d: -f1)
    
    if [ -n "$LAST_TABLE_ROW" ]; then
        sed -i '' "${LAST_TABLE_ROW}a\\
| /$WORKFLOW_NAME | 1 | $TODAY |
" "$TRACKER_FILE"
        echo "✅ Added /$WORKFLOW_NAME: 1 (Last: $TODAY)"
    else
         echo "| /$WORKFLOW_NAME | 1 | $TODAY |" >> "$TRACKER_FILE"
         echo "✅ Added /$WORKFLOW_NAME (new table?): 1 (Last: $TODAY)"
    fi

else
    CURRENT_COUNT=$(echo "$CURRENT_LINE" | awk -F'|' '{print $3}' | tr -d ' ')
    NEW_COUNT=$((CURRENT_COUNT + 1))
    
    ESCAPED_WF=$(echo "$WORKFLOW_NAME" | sed 's/\//\\\//g')
    
    sed -i '' "s/| \/$ESCAPED_WF | [0-9]* | .* |/| \/$ESCAPED_WF | $NEW_COUNT | $TODAY |/" "$TRACKER_FILE"
    
    echo "✅ Updated /$WORKFLOW_NAME: $CURRENT_COUNT → $NEW_COUNT (Last: $TODAY)"
fi
