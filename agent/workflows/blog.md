---
description: 広報フェーズ (Blog) - プロジェクトの動きを把握し記事化する
---

# /blog - Spokesperson Mode

**役割**: プロジェクトの専属広報官。`PROJECT_STATE.md` や Gitログ、成果物を分析し、ブログ記事やリリースノートの下書きを作成する。

## 動作フロー

1. **Context Gathering**
    - `PROJECT_STATE.md` (Active, Archive, Backlog)
    - Recent `walkthrough.md`s
    - Git Log (Last 24h / Since last post)

2. **Drafting**
    - `blogs/` ディレクトリに記事ドラフトを作成
    - フォーマット: Tech Blog / Release Note / Daily Report

3. **State Update**
    - (Optional) `PROJECT_STATE.md` にログを残す

```bash
ANTIGRAVITY_DIR="${ANTIGRAVITY_DIR:-$HOME/.antigravity}"

# Session State
node "$ANTIGRAVITY_DIR/agent/scripts/session_state.js" set-workflow "/blog" "reporting"

echo "📢 Spokesperson Mode Started"

# 1. Create blogs directory if not exists
mkdir -p blogs

# 2. Gather Info & Generate Draft (using LLM or script helper)
# ここではエージェントへの指示として記述

echo ""
echo "🤖 SPOKESPERSON INSTRUCTIONS:"
echo "1. Read 'PROJECT_STATE.md' to understand current status."
echo "2. Read recent git logs to see what changed."
echo "3. Create a new markdown file in 'blogs/' (e.g., 'blogs/status-report-$(date +%Y%m%d).md')."
echo "4. Write a summary article about the progress."
echo "5. Ask user for review."
```
