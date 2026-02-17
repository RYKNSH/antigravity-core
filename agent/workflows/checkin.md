---
description: セッション開始時に不要データを削除し、環境を最新化して軽量状態で開始
---
# Check-in (セッション開始)

作業開始時に実行。クリーンアップ＋環境の最新化＋前回セッション引き継ぎ。

> [!NOTE]
> **エージェント向け**: `.session_state` が存在する場合、前回のCompaction前コンテキストを復元可能。
> ルーティング判断は [`WORKFLOW_ROUTER.md`](file://WORKFLOW_ROUTER.md)、契約は [`WORKFLOW_CONTRACTS.md`](file://WORKFLOW_CONTRACTS.md) を参照。

## Cross-Reference

```
/go → /checkin（自動呼び出し）→ /work or /vision-os
                                    ↑
              NEXT_SESSION.md を自動読み込み
```

// turbo-all

---

## Phase 1: GitHub Sync + クリーンアップ（統合ブロック）

1つのコマンドで全クリーンアップを並列実行し、I/Oバーストを最小化する。

```bash
ANTIGRAVITY_DIR="${ANTIGRAVITY_DIR:-$HOME/.antigravity}"

# --- GitHub Sync ---
if [ -d "$ANTIGRAVITY_DIR/.git" ]; then
  cd "$ANTIGRAVITY_DIR"
  git pull origin main 2>/dev/null && echo "✅ GitHub synced" || echo "⚠️ GitHub pull failed (offline?)"
fi

# --- クリーンアップ（並列実行） ---
rm -rf ~/.gemini/antigravity/browser_recordings/* \
       ~/.gemini/antigravity/implicit/* \
       ~/Library/Application\ Support/Google/Chrome/Default/Service\ Worker \
       ~/Library/Application\ Support/Adobe/CoreSync \
       ~/Library/Application\ Support/Notion/Partitions \
       ~/.npm/_npx ~/.npm/_logs ~/.npm/_prebuilds ~/.npm/_cacache 2>/dev/null &

find ~/.gemini/antigravity/conversations -name "*.pb" -mtime +1 -delete 2>/dev/null &
find ~/.gemini/antigravity/brain -mindepth 1 -maxdepth 1 -type d -mtime +1 -exec rm -rf {} + 2>/dev/null &

wait
echo "✅ cleanup done"
df -h . | tail -1
```

### 保持するもの

- `knowledge/` - ナレッジベース
- `user_settings.pb` - ユーザー設定
- `mcp_config.json` - MCP設定
- `browserAllowlist.txt` - ブラウザ許可リスト

---

## Phase 2: 環境同期（統合ブロック）

ワークフロー/スキル/MCP/GEMINI.mdを1コマンドで同期。rsyncは `--checksum --quiet` でI/O最小化。

```bash
ANTIGRAVITY_DIR="${ANTIGRAVITY_DIR:-$HOME/.antigravity}"

# --- ワークスペース .agent 準備 ---
mkdir -p .agent/{skills,workflows}

# --- ワークフロー・スキル同期（並列 + checksumで差分のみ） ---
rsync -a --update --checksum --quiet "$ANTIGRAVITY_DIR/agent/workflows/"*.md .agent/workflows/ 2>/dev/null && echo "✅ workflows synced" &
rsync -a --update --checksum --quiet "$ANTIGRAVITY_DIR/agent/skills/" .agent/skills/ 2>/dev/null && echo "✅ skills synced" &
wait

# --- MCP設定 ---
cp "$ANTIGRAVITY_DIR/mcp_config.json" ~/.gemini/antigravity/mcp_config.json 2>/dev/null && \
  sed -i '' "s|~/|$HOME/|g" ~/.gemini/antigravity/mcp_config.json && \
  echo "✅ mcp_config synced" || echo "⚠️ MCP config sync skipped"

# --- gdrive credentials ---
mkdir -p ~/.secrets/antigravity/gdrive
cp "$ANTIGRAVITY_DIR/credentials/credentials.json" ~/.secrets/antigravity/gdrive/gcp-oauth.keys.json 2>/dev/null
cp "$ANTIGRAVITY_DIR/credentials/.gdrive-server-credentials.json" ~/.secrets/antigravity/gdrive/.gdrive-server-credentials.json 2>/dev/null

# --- GEMINI.md master sync ---
GEMINI_MASTER="$ANTIGRAVITY_DIR/agent/rules/GEMINI.md.master"
if [ -f "$GEMINI_MASTER" ]; then
  cp "$GEMINI_MASTER" "$HOME/.gemini/GEMINI.md" && echo "✅ GEMINI.md synced"
else
  echo "⚠️ GEMINI.md.master not found"
fi
```

---

## Phase 3: セッション引き継ぎ + 学習データ + プロジェクト環境（統合ブロック）

前回セッション情報の読み込み、学習データの読み込み、プロジェクト環境の自動復元を1つのブロックで実行。

**プロジェクト検出ロジック**: ワークスペースルートの `package.json` / `pyproject.toml` を自動検出。質問不要。

```bash
ANTIGRAVITY_DIR="${ANTIGRAVITY_DIR:-$HOME/.antigravity}"

# --- 前回セッション引き継ぎ ---
NEXT_SESSION=$(find . "$ANTIGRAVITY_DIR" -maxdepth 3 -name "NEXT_SESSION.md" -mtime -7 2>/dev/null | head -1)
if [ -n "$NEXT_SESSION" ]; then
  echo "📋 前回セッション引き継ぎ: $NEXT_SESSION"
  cat "$NEXT_SESSION"
else
  echo "ℹ️  NEXT_SESSION.md なし（新規セッション）"
fi

echo "---"

# --- 学習データ読み込み ---
for f in .sweep_patterns.md .debug_learnings.md; do
  [ -f "$f" ] && echo "📚 学習データ: $f" && cat "$f"
done

echo "---"

# --- プロジェクト環境自動復元 ---
if [ -f "pnpm-lock.yaml" ] && [ ! -d "node_modules" ]; then
  pnpm install && echo "✅ pnpm install complete"
elif [ -f "package-lock.json" ] && [ ! -d "node_modules" ]; then
  npm install && echo "✅ npm install complete"
elif [ -f "yarn.lock" ] && [ ! -d "node_modules" ]; then
  yarn install && echo "✅ yarn install complete"
elif [ -f "package.json" ] && [ ! -d "node_modules" ]; then
  pnpm install && echo "✅ pnpm install complete (default)"
elif [ -f "pyproject.toml" ] && [ ! -d ".venv" ]; then
  if command -v uv >/dev/null; then
    uv venv .venv --allow-existing --python 3.11 && source .venv/bin/activate && uv pip install -r requirements.txt && echo "✅ uv install complete"
  else
    python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && echo "✅ pip install complete"
  fi
else
  echo "✅ project env already set up (or no lockfile found)"
fi
```

NEXT_SESSION.md が見つかった場合:
- 未完了タスクを一覧表示
- 「続きから作業しますか？ 新しいタスクを始めますか？」と確認

---

## Phase 4: 最終確認（統合ブロック）

```bash
ANTIGRAVITY_DIR="${ANTIGRAVITY_DIR:-$HOME/.antigravity}"

# GEMINI.mdリソース一覧を動的更新
$ANTIGRAVITY_DIR/agent/scripts/list_resources.sh --update-gemini 2>/dev/null

# 最終確認
df -h . | tail -1
echo "---"
echo "workflows: $(ls .agent/workflows/ 2>/dev/null | wc -l) files"
echo "skills: $(ls .agent/skills/ 2>/dev/null | wc -l | tr -d ' ') dirs"
echo "---"
echo "✅ Check-in complete!"
```

---

## Vision OS モード対応

`/go --vision "ビジョン"` 経由で呼ばれた場合:
- チェックイン完了後、`/vision-os` へ自動分岐
- ビジョンテキストをコンテキストとして `/vision-os` に渡す
- 通常の `/work` フローはスキップ

## 注意

> このワークフローは**全ての一時データを削除**します。
> 引き継ぎたいconversationがある場合は事前にKI化してください。
