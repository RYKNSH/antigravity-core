#!/bin/bash
# update_usage_tracker.sh - USAGE_TRACKER.md のワークフロー使用記録を更新
# 使用法: ./update_usage_tracker.sh <workflow_name>
# 例: ./update_usage_tracker.sh /checkin

set -euo pipefail  # BP-01: エラー即終了 + 未定義変数エラー + パイプ失敗伝播

ANTIGRAVITY_DIR="${ANTIGRAVITY_DIR:-$HOME/.antigravity}"
TRACKER_FILE="$ANTIGRAVITY_DIR/USAGE_TRACKER.md"
WORKFLOW="${1:-unknown}"
TODAY=$(date +"%Y-%m-%d")

if [ ! -f "$TRACKER_FILE" ]; then
    echo "❌ USAGE_TRACKER.md not found at $TRACKER_FILE" >&2
    exit 1
fi

# ワークフロー名から先頭の / を除去（ファイル内のフォーマットに合わせる）
WORKFLOW_NAME=$(echo "$WORKFLOW" | sed 's/^\///')

# ワークフローの実在チェック
WORKFLOW_FILE="$ANTIGRAVITY_DIR/agent/workflows/${WORKFLOW_NAME}.md"

if [ ! -f "$WORKFLOW_FILE" ]; then
    echo "⚠️ Workflow file not found: $WORKFLOW_FILE. Skipping tracking." >&2
    exit 0
fi

# BP-03: flock で排他ロック（並列書き込み競合防止）
# TRACKER_FILE に対して排他ロックを取得し、スクリプト終了時に自動解放
LOCK_FILE="${TRACKER_FILE}.lock"

(
  flock -w 10 200 || {
    echo "⚠️ Could not acquire lock on $TRACKER_FILE (timeout 10s). Skipping." >&2
    exit 1
  }

  # 現在のカウントを取得
  CURRENT_LINE=$(grep "| /${WORKFLOW_NAME} |" "$TRACKER_FILE" || true)

  if [ -z "$CURRENT_LINE" ]; then
    echo "⚠️ Workflow /$WORKFLOW_NAME not found in tracker. Adding new entry." >&2

    LAST_TABLE_ROW=$(grep -n "^| /" "$TRACKER_FILE" | tail -1 | cut -d: -f1)

    if [ -n "$LAST_TABLE_ROW" ]; then
        sed -i '' "${LAST_TABLE_ROW}a\\
| /${WORKFLOW_NAME} | 1 | ${TODAY} |
" "$TRACKER_FILE"
        echo "✅ Added /$WORKFLOW_NAME: 1 (Last: $TODAY)"
    else
         echo "| /$WORKFLOW_NAME | 1 | $TODAY |" >> "$TRACKER_FILE"
         echo "✅ Added /$WORKFLOW_NAME (new table): 1 (Last: $TODAY)"
    fi

  else
    CURRENT_COUNT=$(echo "$CURRENT_LINE" | awk -F'|' '{print $3}' | tr -d ' ')
    NEW_COUNT=$((CURRENT_COUNT + 1))

    ESCAPED_WF=$(echo "$WORKFLOW_NAME" | sed 's/\//\\\//g')

    sed -i '' "s/| \/${ESCAPED_WF} | [0-9]* | .* |/| \/${ESCAPED_WF} | ${NEW_COUNT} | ${TODAY} |/" "$TRACKER_FILE"

    echo "✅ Updated /$WORKFLOW_NAME: $CURRENT_COUNT → $NEW_COUNT (Last: $TODAY)"
  fi
) 200>"$LOCK_FILE"
