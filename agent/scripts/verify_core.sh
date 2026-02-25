#!/bin/bash
set -e

# verify_core.sh
# Antigravity Coreのメタ検証スクリプト（痛覚センサー）
# /core-ci-dev での改修完了時や、コミット前に必ずパスする必要がある絶対品質基準

CORE_DIR="$HOME/.antigravity"
echo "🔍 Starting Core Meta-Verification..."

# 1. 必須ドキュメントの存在確認
echo "Checking core documents..."
REQUIRED_DOCS=(
    "docs/WHITEPAPER.md"
    "docs/ROADMAP.md"
    "docs/MILESTONES.md"
    "DECISION_USECASES.md"
    "AUTO_TRIGGERS.md"
    "agent/workflows/WORKFLOW_ROUTER.md"
    "agent/workflows/WORKFLOW_CONTRACTS.md"
)

for doc in "${REQUIRED_DOCS[@]}"; do
    if [ ! -f "$CORE_DIR/$doc" ]; then
        echo "❌ ERROR: Required document missing: $doc"
        exit 1
    fi
done

# 2. JSONの整合性確認 
echo "Checking JSON validity..."
if command -v jq &> /dev/null; then
    if [ -f "$CORE_DIR/dependency_map.json" ]; then
        if ! jq . "$CORE_DIR/dependency_map.json" >/dev/null 2>&1; then
            echo "❌ ERROR: dependency_map.json is not valid JSON!"
            exit 1
        fi
    fi
else
    echo "⚠️ Warning: 'jq' command not found, skipping strictly JSON validity check."
fi

# 3. ワークフローファイルの基本構成チェック
echo "Checking workflows basic syntax..."
WF_DIR="$CORE_DIR/agent/workflows"
for wf in "$WF_DIR"/*.md; do
    if [ -f "$wf" ]; then
        # 少なくとも h1 (# ) が存在するか確認（タスク名の起点として重要）
        if ! grep -q "^# " "$wf"; then
            filename=$(basename "$wf")
            # gen-dev など一部の特別なものを除外する場合はここで記述
            echo "❌ ERROR: Workflow file missing H1 title: $(basename "$wf")"
            exit 1
        fi
    fi
done

echo "✅ Core Meta-Verification PASSED. Quality standards met."
exit 0
