---
description: プロジェクトの初期化 - PROJECT_STATE.md 生成とGit環境設定
---

# /setup

**役割**: 新しいプロジェクトを開始するためのセットアップを行う。
`PROJECT_STATE.md` を生成し、Gitリポジトリを初期化する。

```bash
ANTIGRAVITY_DIR="${ANTIGRAVITY_DIR:-$HOME/.antigravity}"

# Run setup script
node "$ANTIGRAVITY_DIR/agent/scripts/setup.js"
```
