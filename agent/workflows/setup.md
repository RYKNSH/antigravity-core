---
description: プロジェクトの初期化 - 環境セットアップ + PROJECT_STATE.md 生成 + Git環境設定
---

# /setup

**役割**: 新しいプロジェクトを開始するためのセットアップを行う。
環境構築 → `PROJECT_STATE.md` 生成 → Gitリポジトリ初期化。

> [!NOTE]
> 旧 `/project-init` の機能はこのワークフローに統合されました。

---

## Phase 0: 環境セットアップ（旧 /project-init）

// turbo-all

### 0-1. .agent ディレクトリの確認・作成
```bash
mkdir -p .agent/{skills,workflows,mcp,plugins}
```

### 0-2. グローバルスキル・WFの同期
```bash
ANTIGRAVITY_DIR="${ANTIGRAVITY_DIR:-$HOME/.antigravity}"
cp -R $ANTIGRAVITY_DIR/agent/skills/* .agent/skills/ 2>/dev/null || echo "No skills to copy"
cp $ANTIGRAVITY_DIR/agent/workflows/*.md .agent/workflows/ 2>/dev/null || echo "No workflows to copy"
```

### 0-3. docs/ ディレクトリの初期化（未存在時のみ）
```bash
if [ ! -d "docs" ]; then
  mkdir -p docs
  cp $ANTIGRAVITY_DIR/project-templates/docs/*.md docs/ 2>/dev/null || true
  echo "docs/ initialized from templates"
else
  echo "docs/ already exists, skipping"
fi
```

---

## Phase 1: PROJECT_STATE.md 生成

```bash
ANTIGRAVITY_DIR="${ANTIGRAVITY_DIR:-$HOME/.antigravity}"

# Run setup script
node "$ANTIGRAVITY_DIR/agent/scripts/setup.js"
```

