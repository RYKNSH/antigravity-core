#!/bin/bash
# update_gemini_resources.sh
# GEMINI.mdのリソース一覧を動的に更新するスクリプト

CORE_PATH="${ANTIGRAVITY_DIR:-$HOME/.antigravity}"
GEMINI_PATH="$HOME/.gemini/GEMINI.md"
MASTER_PATH="$CORE_PATH/agent/rules/GEMINI.md.master"

# カウント取得
WORKFLOW_COUNT=$(ls -1 "$CORE_PATH/agent/workflows/"*.md 2>/dev/null | wc -l | tr -d ' ')
SKILL_COUNT=$(ls -d "$CORE_PATH/agent/skills/"*/ 2>/dev/null | wc -l | tr -d ' ')
SCRIPT_COUNT=$(ls -1 "$CORE_PATH/agent/scripts/"*.js 2>/dev/null | wc -l | tr -d ' ')
KNOWLEDGE_COUNT=$(ls -d "$CORE_PATH/knowledge/"*/ 2>/dev/null | wc -l | tr -d ' ')

# ワークフロー一覧生成
WORKFLOWS=$(ls -1 "$CORE_PATH/agent/workflows/"*.md 2>/dev/null | xargs -I {} basename {} .md | sed 's/^/`\//' | sed 's/$/`/' | tr '\n' ' ')

# スキル一覧生成
SKILLS=$(ls -d "$CORE_PATH/agent/skills/"*/ 2>/dev/null | xargs -I {} basename {} | sed 's/^/`/' | sed 's/$/`/' | tr '\n' ' ')

# スクリプト一覧生成（主要なもののみ）
NOTION_SCRIPTS=$(ls -1 "$CORE_PATH/agent/scripts/"*notion*.js 2>/dev/null | xargs -I {} basename {} | sed 's/^/`/' | sed 's/$/`/' | tr '\n' ' ')
DISCORD_SCRIPTS=$(ls -1 "$CORE_PATH/agent/scripts/"*discord*.js 2>/dev/null | xargs -I {} basename {} | sed 's/^/`/' | sed 's/$/`/' | tr '\n' ' ')

# ナレッジ一覧生成
KNOWLEDGE=$(ls -d "$CORE_PATH/knowledge/"*/ 2>/dev/null | xargs -I {} basename {} | sed 's/^/`/' | sed 's/$/`/' | tr '\n' ' ')

echo "=== Resource Counts ==="
echo "Workflows: $WORKFLOW_COUNT"
echo "Skills: $SKILL_COUNT"
echo "Scripts: $SCRIPT_COUNT"
echo "Knowledge: $KNOWLEDGE_COUNT"

echo ""
echo "=== Update Complete ==="
echo "Run this script after adding new workflows/skills to keep GEMINI.md accurate."
