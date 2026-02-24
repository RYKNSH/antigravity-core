---
description: 広報フェーズ (Blog) - プロジェクトの動きを把握し、高品質な記事・レポートを作成する
---

# /blog - Spokesperson Mode

**役割**: プロジェクトの専属広報官。`PROJECT_STATE.md` や Gitログを分析し、「働いた証」を「価値ある資産」に変える。

> [!IMPORTANT]
> **Quality Standard**: 以下の厳格な基準を遵守すること。
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

echo "   Quality Standards: Loaded"


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

---

## 📝 文体ガイドライン

- **一人称**: 「ぼく」
- **語尾**: 「ね」「んです」「ますよ」など、語りかけるトーン
- **文の長さ**: 短い一文で改行。長くなりそうなら、切る
- **段落**: 段落の間には必ず2行以上の空白
- **禁忌**: 記号（`---` 含む）、テーブル、コマンド、リスト（純粋な散文で構成）
- **クロージング**: 「ソロ・プロダクション」への接続、余韻を残すフレーズ

### 🚫 追加禁止事項（2026-02-24 追記）

- **技術用語をそのまま出さない**: `インシデントログ` `GitHub Issue` `PR` `Chaos テスト` など読者が知らない言葉は、平易な言葉に言い換える
- **自分を下げる文脈にしない**: 「わからなかった」「気づいた」など受け身の語りは禁止。すべてオーナーシップを持った語り口（「設計した」「選んだ」「自動にした」）
- **ブランド用語を統一**: `One-Man Orchestra` ではなく `ソロ・プロダクション` を使う

---

## ✅ 5ブロック構成チェック

- [ ] 第一ブロック「問いかけ」（普遍的な真理や気づきを短く提示）
- [ ] 第二ブロック「体験」（具体的なエピソード、数字があるとなお良い）
- [ ] 第三ブロック「洞察」（視点の転換、できれば名前をつける）
- [ ] 第四ブロック「解決」（どうやって乗り越えたか、文章として流す）
- [ ] 第五ブロック「普遍化と余韻」（One-Man Orchestraへの接続）

---

## 🚫 NGワード自動チェック (Mandatory)

記事ファイルに対して以下を実行し、該当があれば修正してから次へ進む:
```bash
grep -n "でもね、\|でもね　\|でもね " [記事ファイル] && echo "⚠️ NGワード検出: 「でもね、」→「ただ、」「ところが、」「けれど、」に置換せよ" || echo "✅ NGワードなし"
```

---

## Daily Log 自動提案

`/checkout` Phase 0 で Social Knowledge Score が 1-4 の場合、Evergreen Article ではなく Daily Log を提案。
簡潔な活動報告を作成し、Discord に投稿して完了。

---

## 📚 リファレンス記事

文体・構成・トーンの基準として以下を参照すること:

- `blogs/31_sleeping_while_shipping.md` — 体験から洞察への流れの手本
- `blogs/33_self_evolving_ide.md` — 技術テーマを平易な散文で書いた手本（2026-02-24 確定版）
