---
description: 計画フェーズ (Think) - 新しいタスクのためのブランチを作成し、計画を策定する
---

# /think - Planner Mode

**役割**: 実装を行わず、計画と設計に集中するモード。新しいGitブランチを作成し、`PROJECT_STATE.md` を更新する。

## 1. ブランチ作成 & スイッチ

```bash
TASK_NAME="${1:-new-task}"
# Clean task name for branch
BRANCH_KEY=$(echo "$TASK_NAME" | sed 's/ /-/g' | tr '[:upper:]' '[:lower:]' | tr -cd '[:alnum:]-')
BRANCH_NAME="feat/$BRANCH_KEY"

# Update State BEFORE branching (on main/current)
node ~/.antigravity/agent/scripts/project_state.js add "$TASK_NAME" "$BRANCH_NAME" "Think"

# Branching Logic
if git show-ref --verify --quiet "refs/heads/$BRANCH_NAME"; then
    echo "🔄 Switching to existing branch: $BRANCH_NAME"
    git checkout "$BRANCH_NAME"
else
    echo "🌿 Creating new branch: $BRANCH_NAME"
    git checkout -b "$BRANCH_NAME"
fi
```

## 2. 計画テンプレートの準備

```bash
# Create brain dir for this plan
PLAN_DIR="$HOME/.gemini/antigravity/brain/$(uuidgen)"
mkdir -p "$PLAN_DIR"
PLAN_FILE="$PLAN_DIR/implementation_plan.md"

# Template
cat <<EOF > "$PLAN_FILE"
# Implementation Plan: $TASK_NAME

## Goal
$TASK_NAME の実現。

## User Review Required
- [ ] Breaking Changes?

## Proposed Changes
- [ ] ...

## Verification Plan
- [ ] ...
EOF

# Link plan file (Symbolic link in workspace root for easy access?)
# For now, just print path
echo "📝 Planning Phase Started"
echo "   Branch: $BRANCH_NAME"
echo "   Plan: $PLAN_FILE"

# Set Session State
node ~/.antigravity/agent/scripts/session_state.js set-workflow "/think" "planning"
```

> [!TIP]
> **No Implementation**: このモードではコードを書かないでください。設計と調査に集中してください。
