---
description: 広報フェーズ (Blog) - プロジェクトの動きを把握し、高品質な記事・レポートを作成する
---

# /blog - Spokesperson Mode

**役割**: プロジェクトの専属広報官。`PROJECT_STATE.md` や Gitログを分析し、「働いた証」を「価値ある資産」に変える。

> [!IMPORTANT]
> **Quality Standard**: `checkpoint_to_blog` から継承された以下の厳格な基準を遵守すること。
> 1. **Universal Value**: 個人的体験を普遍的な知恵に昇華する。
> 2. **Narrative**: 読者の感情を動かす物語構成にする。
> 3. **Brand Aligned**: ブランドコンセプトに合致させる。

## 動作フロー

```bash
ANTIGRAVITY_DIR="${ANTIGRAVITY_DIR:-$HOME/.antigravity}"
BLOGS_DIR="$ANTIGRAVITY_DIR/blogs"

# Session State
node "$ANTIGRAVITY_DIR/agent/scripts/session_state.js" set-workflow "/blog" "reporting"

echo "📢 Spokesperson Mode Started"

# === 0. Setup Check (Personalization) ===
BRAND_FILE="$ANTIGRAVITY_DIR/brand_concept.md"
ENV_FILE="$ANTIGRAVITY_DIR/.env"

# A. Brand Concept Check
if [ ! -f "$BRAND_FILE" ]; then
    echo "⚠️  Brand Concept not found!"
    echo "    To use /blog, you need to define your 'Persona'."
    echo "    Creating a template for you..."
    cp "$ANTIGRAVITY_DIR/brand_concept.template.md" "$BRAND_FILE"
    open "$BRAND_FILE"
    echo "👉 Please edit '$BRAND_FILE' to define your style (e.g., 'Solo Production')."
    read -p "Press Enter when you are done editing..."
fi

# B. Notion Integration Check
if ! grep -q "NOTION_API_KEY=" "$ENV_FILE" 2>/dev/null; then
    echo "⚠️  Notion Integration not configured!"
    echo "    Starting Notion Setup Wizard..."
    node "$ANTIGRAVITY_DIR/agent/scripts/auth_notion.js"
    echo "✅ Setup complete. proceeding..."
fi

echo "   Quality Standards: Loading from legacy checkpoint_to_blog..."


# 1. Context Gathering
# - PROJECT_STATE.md
# - Recent Git Logs
# - brand_concept.md (if exists)

# 2. Content Type Selection
echo ""
echo "📝 Select Content Type:"
echo "  [A] Daily Log (Discord用, 3-5行)"
echo "  [B] Evergreen Article (Notion用, 1500字+, Deep QA必須)"
# (Agent should decide or ask user based on context)

echo ""
echo "🤖 SPOKESPERSON INSTRUCTIONS:"
echo "1. Read 'PROJECT_STATE.md' & Git Log."
echo "2. IF Daily Log:"
echo "   - Create short summary."
echo "   - Post to Discord (simulation)."
echo "3. IF Evergreen Article:"
echo "   - **Load Template**: $BLOGS_DIR/article_template.md"
echo "   - **Load Brand**: $ANTIGRAVITY_DIR/brand_concept.md"
echo "   - Draft the article in 'blogs/'."
echo "   - **Run QA**: /debate deep --preset=social-knowledge (Self-Critique)"
echo "   - **Check NG Words**: 'でもね、' -> 'ただ、'"
echo "   - Ask user for review."
```

## 🔍 Deep QA Checklist (For Evergreen)

- [ ] **Universal Value**: 個人的な体験が普遍的な知恵に昇華されているか？
- [ ] **Physical Metaphor**: 物理的・数学的なメタファーで本質を突いているか？
- [ ] **Narrative Arc**: 問いかけ → 体験 → 洞察 → 解決 → 余韻 の構成になっているか？
