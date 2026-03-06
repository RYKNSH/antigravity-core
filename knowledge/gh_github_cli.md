# gh — GitHub CLI

> **バージョン**: v2.87.3
> **インストール済み**: /opt/homebrew/bin/gh
> **公式**: https://cli.github.com/

## 概要

GitHubの公式CLI。Issues, PRs, Repos, Actions等、GitHub全機能を操作できる。

> **運用方針**: Antigravityでは**CLI直打ちが主運用**。`run_command` で `gh <command>` を直接実行する。`@modelcontextprotocol/server-github` MCP は削除済み（2026-03-06）。

## 認証

```bash
gh auth login   # ブラウザ or PAT で認証（初回のみ）
gh auth status  # 認証状態確認
```

## 主要コマンド

### リポジトリ
```bash
gh repo list --limit 10          # リポジトリ一覧
gh repo view <owner>/<repo>      # リポジトリ詳細
gh repo create <name> --public   # 新規作成
gh repo clone <owner>/<repo>     # クローン
```

### Issues
```bash
gh issue list --repo <owner>/<repo>         # 一覧
gh issue create --title "..." --body "..."  # 作成
gh issue view <number>                      # 詳細
gh issue close <number>                     # クローズ
```

### Pull Requests
```bash
gh pr list --repo <owner>/<repo>            # 一覧
gh pr create --title "..." --body "..."     # 作成
gh pr view <number>                         # 詳細
gh pr merge <number> --squash               # マージ
gh pr review <number> --approve             # 承認
```

### Actions / Workflows
```bash
gh run list --repo <owner>/<repo>           # 実行一覧
gh run view <run-id>                        # 詳細
gh workflow list                            # ワークフロー一覧
```

### その他
```bash
gh search repos <query>          # リポジトリ検索
gh gist create <file>            # Gist作成
gh release list                  # リリース一覧
gh release create <tag>          # リリース作成
```

## Antigravity内での使い方

AIエージェントが `run_command` で直接実行できる：

```bash
# 例: RYKNSH/antigravity-core の最新コミット確認
gh repo view RYKNSH/antigravity-core
gh issue list --repo RYKNSH/antigravity-core --state open
```

## 参考

- Manual: `gh help`
- Web: https://cli.github.com/manual/
