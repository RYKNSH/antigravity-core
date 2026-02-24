---
description: server_evolve.js が生成したIssueをPRに変換する承認ゲート運用フロー
---

# /approval-gate — 承認ゲート運用フロー

> [!IMPORTANT]
> **このワークフローはWHITEPAPER設計原則「承認ゲートはIssue→人間レビュー→PR」を実装する。**
> 完全自律はmergeは禁止。`bot: evolve-proposal` ラベルのIssueは必ずこのフローを経ること。

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
| 既に別の方法で解決済か | — | ❌ → `wontfix` でclose |
| safe-commands.md で対処可能か | ✅ 小修正で対応 | — |
| スクリプト修正が必要か | ✅ PR必要 | — |

> [!NOTE]
> 「safe-commands.md へのルール追記だけで対処可能」Issueは、PRを立てずに直接編集→pushで完結させてよい。

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
  || echo "⚠️  gh CLI未インストール → GitHub UIかPRを作成してください"
```

---

## Step 5: マージ後のローカル同期

PRくmainにmergeされると、各ローカルの次回 `/checkin` 時に自動で取り込まれる:

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
| **Reject** | CI失敗 | 修正後に再 push |
| **Defer** | 影響範囲が大きすぎる | Issue に `deferred` ラベル付与 |
| **Wontfix** | 外部要因・OSS化後に対処 | Issue close + `wontfix` ラベル |

> [!CAUTION]
> **完全自律はmerge（人間レビューなし）は禁止。** `server_evolve.js` のIssueは必ずこのフローを経ること。
> これはWHITEPAPER Round 7で確定した設計原則であり、変更不可。

---

## PR ライフサイクル（完全版）

### 通常フロー（承認）

```
PRを作成（Step 4）
    ↓
GitHub Actions CI が自動起動
  - dependency_map lint
  - pipeline_chaos.js（C1～C5）
    ↓
CI結果を確認 ← Step 5-A（以下参照）
    ↓
CI Pass → 人間がPR本文を最終確認
    ↓
GitHub UI で「Merge pull request」
    ↓
PR body の "Closes #N" により Issue が自動close
    ↓
各ローカルの次回 /checkin で git pull が取り込む
```

### Step 5-A: CI結果確認（GitHub MCPで実行）

// turbo
```bash
# PRのCIXuテータスを確認（gh CLI）
gh pr checks $PR_NUMBER \
  --repo "$REPO_OWNER/$REPO_NAME" 2>/dev/null \
  || echo "⚠️  gh CLI未インストール → GitHub UIでCIバッジを確認"
```

または GitHub MCP で確認:
```
mcp_github_get_pull_request_status(owner, repo, pull_number)
```

| CIステータス | アクション |
|----------|---------|
| ✅ 全Pass | merge許可。GitHub UIで「Merge pull request」 |
| ❌ 失敗 | 失敗ジョブのログを確認 → 修正 → git push で自動再実行 |
| ⏳ 実行中 | 待機（通常3～5分） |

### リジェクト・差し戻しフロー

```
CI失敗 or レビューで問題発見
    ↓
原因を特定（ログ確認）
    ↓
ローカルで修正
    ↓
git push origin evolve/issue-$ISSUE_NUMBER
    ↓
CI が自動で再実行（PR更新をトリガー）
    ↓
Pass → merge へ

最別3回試みて解決しない場合:
    → PRをdraft状態に変更
    → Issueに "needs-investigation" ラベル付与
    → server_evolve.js が次週再度分析
```

### GitHub MCPでのmerge実行（gh CLI不使用の場合）

```
mcp_github_merge_pull_request(
  owner="RYKNSH",
  repo="antigravity-core",
  pull_number=PR_NUMBER,
  merge_method="squash"
)
```

> [!NOTE]
> `squash` merge を推奨。コミット履歴がフラットになり、git log でIssue単位の変更が追いやすくなる。

### Issue auto-closeの確認

merge後にIssueが自動closeされているか確認:

```
mcp_github_get_issue(owner, repo, issue_number)
→ state: "closed" であれば正常
```

closeされていない場合（PR body に "Closes #N" が抄けていた場合）:
```
mcp_github_update_issue(owner, repo, issue_number, state="closed")
```

---

## server_evolve.js との連携（重複Issue防止）

`server_evolve.js` は週次実行時に既存のOPEN Issueをチェックし、
同じ `component` + `trigger` のIssueが既に存在する場合は新規作成しない。

closeされたIssueは週次実行の対象外となるため、
merge → Issue close の流れを正確に完了させることが重複防止の鍵。
