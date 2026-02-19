---
description: Git Worktree 管理 - 並行作業環境を構築・移動する
---

# /worktree

**役割**: Git Worktree を使用して、物理的に分離された並行作業環境を作成・管理する。

## Usage
`git worktree` は `../` (親ディレクトリ) に作成することを推奨する（プロジェクトルートを汚さないため）。

```bash
# 1. Create new worktree
# /worktree add feature-X
# -> ../worktrees/feature-X created with branch feature-X

# 2. List worktrees
# /worktree list

# 3. Remove worktree
# /worktree remove feature-X
```

## Agent Guideline

- 新しい Worktree を作る際は `../worktrees/` 配下に作成すること。
- 作成後は `cd ../worktrees/<name>` して作業を開始すること。
- メインリポジトリ（Bare repoでない場合）とブランチが競合しないように注意すること。
