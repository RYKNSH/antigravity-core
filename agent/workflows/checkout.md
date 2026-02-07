---
description: セッション終了時にデータを整理し、自己評価・改善提案を行いクリーンな状態で終了
---
# Check-out (セッション終了)

作業終了時に実行。クリーンアップ＋**自己評価フィードバックループ**。

## 実行タイミング

- 1日の作業終了時
- PC再起動/シャットダウン前
- SSD取り外し前

---

## Phase 0: Social Knowledge (Optional)

1. ユーザーに確認: 「今回の作業を『Social Knowledge』としてブログ記事 (Notion) にしますか？ (y/N)」
2. Yesの場合:
   - `/Volumes/PortableSSD/.antigravity/agent/workflows/checkpoint_to_blog.md` のステップを実行（または `/checkpoint_to_blog` を呼び出し）。
   - 技術的な成果を社会的価値に変換し、Notionへ保存する。

---

## Phase 0.5: Git Save & PR (Auto-Commit)

1.  **Check for Changes**
    -   Run `git status --porcelain 2>/dev/null`
    -   If the output is empty or fails (not a repo), skip to "PR Link Generation" (Assume changes were already committed or not in a repo).

2.  **Input & Commit (If changes exist)**
    -   Ask the user: "Session Summary (for commit message)?"
        -   *Default if empty*: "checkout: session end"
    -   Run:
        ```bash
        git add . && git commit -m "checkout: [User Input]" && git push
        ```

3.  **PR Link Generation**
    -   Get remote URL and branch name.
    -   Display the clickable Pull Request URL: `https://github.com/[owner]/[repo]/compare/[branch]?expand=1`

---

## Phase 1: クリーンアップ

// turbo-all

0. USAGE_TRACKER更新 & GEMINI.md同期チェック
```bash
# Usage tracking
/Volumes/PortableSSD/.antigravity/agent/scripts/update_usage_tracker.sh checkout

# GEMINI.md master diff warning
GEMINI_LOCAL="$HOME/.gemini/GEMINI.md"
GEMINI_MASTER="/Volumes/PortableSSD/.antigravity/agent/rules/GEMINI.md.master"
if [ -f "$GEMINI_MASTER" ]; then
    if ! diff -q "$GEMINI_LOCAL" "$GEMINI_MASTER" > /dev/null 2>&1; then
        echo "⚠️  WARNING: GEMINI.md differs from SSD master!"
        echo "    Run: cp ~/.gemini/GEMINI.md /Volumes/PortableSSD/.antigravity/agent/rules/GEMINI.md.master"
        echo "    Or review diff with: diff ~/.gemini/GEMINI.md $GEMINI_MASTER"
    else
        echo "✅ GEMINI.md is in sync with SSD master"
    fi
else
    echo "📝 GEMINI.md.master not found, creating initial copy..."
    cp "$GEMINI_LOCAL" "$GEMINI_MASTER" 2>/dev/null && echo "✅ Created GEMINI.md.master"
fi
```

1. 現在のストレージ確認
```bash
echo "=== Before ===" && df -h / | tail -1
```

2. browser_recordings全削除
```bash
rm -rf ~/.gemini/antigravity/browser_recordings && mkdir -p ~/.gemini/antigravity/browser_recordings && echo "browser_recordings cleared"
```

3. implicit全削除
```bash
rm -rf ~/.gemini/antigravity/implicit && mkdir -p ~/.gemini/antigravity/implicit && echo "implicit cache cleared"
```

4. システムキャッシュ削除
```bash
rm -rf ~/Library/Application\ Support/Google/Chrome/Default/Service\ Worker 2>/dev/null
rm -rf ~/Library/Application\ Support/Adobe/CoreSync 2>/dev/null
rm -rf ~/Library/Application\ Support/Notion/Partitions 2>/dev/null
rm -rf ~/.npm/_npx ~/.npm/_logs ~/.npm/_prebuilds ~/.npm/_cacache 2>/dev/null
echo "system caches cleared"
```


5. ゴミ箱を空にする
```bash
find ~/.Trash -mindepth 1 -delete 2>/dev/null && echo "Trash emptied"
```

6. 最終確認
```bash
echo "=== After ===" && df -h / | tail -1
```

---

## Phase 2: 自己評価フィードバックループ

このセッションでの自分のパフォーマンスを厳しく評価し、改善点を洗い出す。

### 評価項目（5段階）

1. **効率性** (1-5): 無駄なツール呼び出しはなかったか？最短経路で解決できたか？

2. **正確性** (1-5): 初回で正しい解を提示できたか？バックトラックはなかったか？

3. **コミュニケーション** (1-5): ユーザーの意図を正確に理解できたか？不要な確認はなかったか？

4. **自律性** (1-5): 適切な判断を自分で行えたか？過度な依存はなかったか？

5. **品質** (1-5): 出力物の品質は高かったか？ベストプラクティスに従っていたか？

### 評価フォーマット

```markdown
## 🔍 セッション自己評価

| 評価項目 | スコア | 問題点 |
|---------|--------|--------|
| 効率性 | X/5 | [具体的な問題] |
| 正確性 | X/5 | [具体的な問題] |
| コミュニケーション | X/5 | [具体的な問題] |
| 自律性 | X/5 | [具体的な問題] |
| 品質 | X/5 | [具体的な問題] |
| **総合** | XX/25 | |

### 最大の課題
[このセッションで最も改善が必要だった点]

### 再発防止ソリューション
[具体的な改善策。ワークフロー/スキル/ルールへの反映案]
```

---

## Phase 3: 改善提案と実装 (Mandatory)

評価で洗い出した課題に対するソリューションを**その場で実装する**。

1. **提案**: 課題解決のためのコード変更やルール更新を提案。
2. **実装**: ユーザー承認後、即座に実装・適用する。
    - ワークフロー更新
    - スキル更新
    - ルール更新
3. **検証**: 実装内容が正しいか確認。

**フィードバックループ:**
```
チェックアウト自己評価 → 課題特定 → ソリューション実装(必須) 
    → チェックアウト完了
```

---

## Phase 4: 次回セッション引き継ぎ

次回の自分への引き継ぎメモを生成する。

```markdown
## NEXT_SESSION.md 生成フォーマット

# 次回セッション引き継ぎメモ
Generated: [日時]

## すぐやること
1. [最優先タスク]
2. [次に重要なタスク]

## 未完了のタスク
- [ ] [タスク1]
- [ ] [タスク2]

## 注意点
- [今回発生した問題や、次回気をつけること]

## 関連ファイル
- [変更したファイルへのパス]
```

**出力先**: プロジェクトルートに `NEXT_SESSION.md` を生成

---

## Phase 5: 完了

✅ チェックアウト完了
- クリーンアップ実行済み
- 自己評価完了
- **改善提案の実装完了 (Kaizen Implemented)**
- **NEXT_SESSION.md 生成済み**

Safe to shutdown.

> [!IMPORTANT]
> **Final Action**: Please manually delete this chat session history to keep the environment pristine for the next run.

---

## checkin vs checkout

| コマンド | タイミング | 削除対象 | 特別機能 |
|----------|------------|----------|----------|
| `/checkin` | 開始時 | 全データ + 24h+ conversations | 環境最新化 |
| `/checkout` | 終了時 | キャッシュのみ（conversationsは保持） | 自己評価＋改善提案 |
