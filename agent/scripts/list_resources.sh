#!/bin/bash
# list_resources.sh - グローバルリソース一覧を動的生成
# 使用法: ./list_resources.sh [--update-gemini]

CORE_ROOT="${ANTIGRAVITY_DIR:-$HOME/.antigravity}"
GEMINI_MD="$HOME/.gemini/GEMINI.md"

# カウント取得
count_files() {
    local dir="$1"
    local pattern="${2:-*.md}"
    find "$dir" -maxdepth 1 -name "$pattern" -type f 2>/dev/null | wc -l | tr -d ' '
}

count_dirs() {
    local dir="$1"
    ls -d "$dir"/*/ 2>/dev/null | wc -l | tr -d ' '
}

# ワークフロー一覧
list_workflows() {
    local count=$(count_files "$CORE_ROOT/agent/workflows")
    echo "### ワークフロー (${count}件) → \`agent/workflows/\`"
    ls "$CORE_ROOT/agent/workflows/"*.md 2>/dev/null | \
        xargs -I {} basename {} .md | \
        sed 's/^/`\//' | sed 's/$/`/' | \
        tr '\n' ' '
    echo
}

# スキル一覧
list_skills() {
    local count=$(count_dirs "$CORE_ROOT/agent/skills")
    echo "### スキル (${count}件) → \`agent/skills/\`"
    ls -d "$CORE_ROOT/agent/skills"/*/ 2>/dev/null | \
        xargs -I {} basename {} | \
        sed 's/^/`/' | sed 's/$/`/' | \
        tr '\n' ' '
    echo
}

# スクリプト一覧
list_scripts() {
    local count=$(count_files "$CORE_ROOT/agent/scripts" "*.js")
    count=$((count + $(count_files "$CORE_ROOT/agent/scripts" "*.sh")))
    echo "### スクリプト (${count}件) → \`agent/scripts/\`"
    
    echo -n "**Notion連携**: "
    ls "$CORE_ROOT/agent/scripts/"*notion*.js "$CORE_ROOT/agent/scripts/"*notion*.sh 2>/dev/null | \
        xargs -I {} basename {} | sed 's/^/`/' | sed 's/$/`/' | tr '\n' ' '
    echo
    
    echo -n "**Discord連携**: "
    ls "$CORE_ROOT/agent/scripts/"*discord*.js "$CORE_ROOT/agent/scripts/"*discord*.sh 2>/dev/null | \
        xargs -I {} basename {} | sed 's/^/`/' | sed 's/$/`/' | tr '\n' ' '
    echo
    
    echo -n "**ソーシャル**: "
    ls "$CORE_ROOT/agent/scripts/"*social*.js "$CORE_ROOT/agent/scripts/"*gas*.js "$CORE_ROOT/agent/scripts/"generate_*.js 2>/dev/null | \
        xargs -I {} basename {} | sed 's/^/`/' | sed 's/$/`/' | tr '\n' ' '
    echo
}

# ナレッジ一覧
list_knowledge() {
    local ki_dir="$HOME/.gemini/antigravity/knowledge"
    if [ ! -d "$ki_dir" ]; then
        ki_dir="$CORE_ROOT/knowledge"
    fi
    local count=$(count_dirs "$ki_dir")
    echo "### ナレッジ (${count}件) → \`knowledge/\`"
    ls -d "$ki_dir"/*/ 2>/dev/null | \
        xargs -I {} basename {} | \
        sed 's/^/`/' | sed 's/$/`/' | \
        tr '\n' ' '
    echo
}

# メイン出力
generate_resources() {
    echo "## 🗺️ グローバルリソース (Core: ${ANTIGRAVITY_DIR:-$HOME/.antigravity}/)"
    echo
    list_workflows
    echo
    list_skills
    echo
    list_scripts
    echo
    list_knowledge
    echo
    echo "### ドキュメント → \`Core/.antigravity/\`"
    echo "\`QUICKSTART.md\` \`BACKUP_STRATEGY.md\` \`SECRETS_REFERENCE.md\` \`KNOWLEDGE_INDEX.md\` \`AUTO_TRIGGERS.md\` \`SELF_EVOLUTION.md\` \`USAGE_TRACKER.md\`"
}

# メイン処理
if [ "$1" = "--update-gemini" ]; then
    echo "🔄 Updating GEMINI.md resources section..."
    
    # 一時ファイルに新しいリソースセクションを生成
    TEMP_FILE=$(mktemp)
    generate_resources > "$TEMP_FILE"
    
    # GEMINI.md から「## 🗺️ グローバルリソース」以降を削除し、新しい内容を追加
    # （sedでマーカー行から最後まで削除し、新しいセクションを追加）
    sed '/^## 🗺️ グローバルリソース/,$d' "$GEMINI_MD" > "${GEMINI_MD}.tmp"
    cat "$TEMP_FILE" >> "${GEMINI_MD}.tmp"
    echo >> "${GEMINI_MD}.tmp"
    echo "## ✓ 確認" >> "${GEMINI_MD}.tmp"
    echo "このルールを読んだ場合「✓ Antigravity Rules Loaded」と表示" >> "${GEMINI_MD}.tmp"
    
    mv "${GEMINI_MD}.tmp" "$GEMINI_MD"
    rm "$TEMP_FILE"
    
    echo "✅ GEMINI.md updated with current resource counts"
else
    generate_resources
fi
