---
description: server_evolve.js が生成したIssueをPRに変換する承認ゲート運用フロー
---

# /approval-gate — 承認ゲート運用フロー

> [!IMPORTANT]
> **このワークフローはWHITEPAPER設計原則「承認ゲートはIssue→人間レビュー→PR」を実装する。**
> 完全自律mergeは禁止。`bot: evolve-proposal` ラベルのIssueは必ずこのフローを経ること。

---

## 概要

`server_evolve.js` が週次で自動生成する改善提案Issueを、人間がレビューしてPRにマージするまでの運用手順。

```
[GitHub Actions weekly]
  server_evolve.js 実行
      ↓
  bot: evolve-proposal ラベル付きIssue 自動作成
      ↓
  【ここから人間の承認ゲート】
      ↓
  /approval-gate で内容確認
      ↓
  ローカルで修正実装
      ↓
  PR作成 → CI通過 → merge
      ↓
  各ローカルが checkin 時に git pull で取り込む
```

---

## Step 1: Issue確認

// turbo
```bash
# bot: evolve-proposal ラベルのOPEN Issueを一覧表示
ANTIGRAVITY_DIR="${ANTIGRAVITY_DIR:-$HOME/.antigravity}"
REPO_OWNER="${GITHUB_REPO_OWNER:-RYKNSH}"
REPO_NAME="${GITHUB_REPO_NAME:-antigravity-core}"

echo "📋 承認待ちIssue一覧:"
gh issue list \
  --repo "$REPO_OWNER/$REPO_NAME" \
  --label "bot: evolve-proposal" \
  --state open \
  --json number,title,createdAt \
  --jq '.[] | "  #\(.number) [\(.createdAt[:10])] \(.title)"' 2>/dev/null \
  || echo "  ⚠️  gh CLI未インストール → https://github.com/$REPO_OWNER/$REPO_NAME/issues?q=label%3A%22bot%3A+evolve-proposal%22 を直接確認"
```

---

## Step 2: Issue内容評価

各Issueに対して以下の基準で採否を判断:

| 基準 | 採用 | 棄却 |
|------|------|------|
| 対処法が具体的か | ✅ | ❌ → コメントで差し戻し |
| 影響範囲が明確か | ✅ | ❌ → `needs-info` ラベル付与 |
| 既に別の方法で解決済みか | — | ❌ → `wontfix` でclose |
| safe-commands.md で対処可能か | ✅ 小修正で対応 | — |
| スクリプト修正が必要か | ✅ PR必要 | — |

> [!NOTE]
> 「safe-commands.md へのルール追記だけで対処可能」なIssueは、PRを立てずに直接編集→pushで完結させてよい。

---

## Step 3: 実装

採用したIssueの内容に対して実装:

```bash
# 1. 作業ブランチ作成
git -C "$ANTIGRAVITY_DIR" checkout -b "evolve/issue-$ISSUE_NUMBER"

# 2. 対象ファイル修正（safe-commands.md / WF / スクリプト）
# ...

# 3. 確認
node "$ANTIGRAVITY_DIR/agent/scripts/server_evolve.js" --dry-run
```

---

## Step 4: PR作成

// turbo
```bash
# セマンティックコミット + push
GIT_TERMINAL_PROMPT=0 git -C "$ANTIGRAVITY_DIR" add -A
GIT_TERMINAL_PROMPT=0 git -C "$ANTIGRAVITY_DIR" commit -m "fix: Issue#$ISSUE_NUMBER $(gh issue view $ISSUE_NUMBER --repo $REPO_OWNER/$REPO_NAME --json title --jq .title 2>/dev/null || echo '承認ゲート対応')"
GIT_TERMINAL_PROMPT=0 git -C "$ANTIGRAVITY_DIR" push origin "evolve/issue-$ISSUE_NUMBER" --no-verify

# PR作成
gh pr create \
  --repo "$REPO_OWNER/$REPO_NAME" \
  --title "fix: Issue#$ISSUE_NUMBER 承認ゲート対応" \
  --body "Closes #$ISSUE_NUMBER\n\n## 変更内容\n- [変更したファイルと内容]\n\n## CIステータス\nGitHub Actions が自動で dependency_map lint + Chaos CI を実行します。" \
  --label "approved-by-human" 2>/dev/null \
  || echo "⚠️  gh CLI未インストール → GitHub UIからPRを作成してください"
```

---

## Step 5: マージ後のローカル同期

PRがmainにmergeされると、各ローカルの次回 `/checkin` 時に自動で取り込まれる:

```bash
# checkin.md SLOW ZONE で自動実行される
cd ~/.antigravity && GIT_TERMINAL_PROMPT=0 git pull origin main --quiet
```

> [!TIP]
> 緊急の場合は `GIT_TERMINAL_PROMPT=0 git -C ~/.antigravity pull origin main` で即時取り込み可能。

---

## 承認ゲート判定基準（WHITEPAPER設計原則より）

| ゲート | 条件 | アクション |
|--------|------|-----------|
| **Pass** | CI全通過 + 人間がIssue内容を確認済み | merge許可 |
| **Reject** | CI失敗 | 修正後に再push |
| **Defer** | 影響範囲が大きすぎる | Issue に `deferred` ラベル付与 |
| **Wontfix** | 外部要因・OSS化後に対処 | Issue close + `wontfix` ラベル |

> [!CAUTION]
> **完全自律merge（人間レビューなし）は禁止。** `server_evolve.js` のIssueは必ずこのフローを経ること。
> これはWHITEPAPER Round 7で確定した設計原則であり、変更不可。
