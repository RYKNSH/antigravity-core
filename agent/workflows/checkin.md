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

```bash
ANTIGRAVITY_DIR="${ANTIGRAVITY_DIR:-$HOME/.antigravity}"

# GitHub Sync
if [ -d "$ANTIGRAVITY_DIR/.git" ]; then
  cd "$ANTIGRAVITY_DIR"
  git pull origin main 2>/dev/null && echo "✅ GitHub synced" || echo "⚠️ GitHub pull failed"
fi

# クリーンアップ（並列）
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

---

## Phase 2: 環境同期（統合ブロック）

```bash
ANTIGRAVITY_DIR="${ANTIGRAVITY_DIR:-$HOME/.antigravity}"

# 準備
mkdir -p .agent/{skills,workflows}

# 同期（メタデータ比較で高速化）
rsync -a --update --quiet "$ANTIGRAVITY_DIR/agent/workflows/"*.md .agent/workflows/ 2>/dev/null && echo "✅ workflows synced" &
rsync -a --update --quiet "$ANTIGRAVITY_DIR/agent/skills/" .agent/skills/ 2>/dev/null && echo "✅ skills synced" &
wait

# MCP設定
cp "$ANTIGRAVITY_DIR/mcp_config.json" ~/.gemini/antigravity/mcp_config.json 2>/dev/null && \
  sed -i '' "s|~/|$HOME/|g" ~/.gemini/antigravity/mcp_config.json && \
  echo "✅ mcp_config synced" || echo "⚠️ MCP config sync skipped"

# credentials
mkdir -p ~/.secrets/antigravity/gdrive
cp "$ANTIGRAVITY_DIR/credentials/credentials.json" ~/.secrets/antigravity/gdrive/gcp-oauth.keys.json 2>/dev/null
cp "$ANTIGRAVITY_DIR/credentials/.gdrive-server-credentials.json" ~/.secrets/antigravity/gdrive/.gdrive-server-credentials.json 2>/dev/null

# GEMINI.md master
GEMINI_MASTER="$ANTIGRAVITY_DIR/agent/rules/GEMINI.md.master"
if [ -f "$GEMINI_MASTER" ]; then
  cp "$GEMINI_MASTER" "$HOME/.gemini/GEMINI.md" && echo "✅ GEMINI.md synced"
fi
```

---

## Phase 3: セッション引き継ぎ + 学習データ + プロジェクト環境（統合ブロック）

```bash
ANTIGRAVITY_DIR="${ANTIGRAVITY_DIR:-$HOME/.antigravity}"

# パス直撃チェック（find廃止）
if [ -f "./NEXT_SESSION.md" ]; then NEXT_SESSION="./NEXT_SESSION.md";
elif [ -f "$ANTIGRAVITY_DIR/NEXT_SESSION.md" ]; then NEXT_SESSION="$ANTIGRAVITY_DIR/NEXT_SESSION.md";
fi

if [ -n "$NEXT_SESSION" ]; then
  echo "📋 前回セッション引き継ぎ: $NEXT_SESSION"
  cat "$NEXT_SESSION"
else
  echo "ℹ️ NEXT_SESSION.md なし"
fi

# 学習データ
for f in .sweep_patterns.md .debug_learnings.md; do
  [ -f "$f" ] && echo "📚 学習データ: $f" && cat "$f"
done

# 環境確認
if [ -f "package-lock.json" ] && [ ! -d "node_modules" ]; then
  echo "⚠️ node_modules not found"
else
  echo "✅ project env ok"
fi
```

---

## Phase 4: 最終確認（統合ブロック）

```bash
ANTIGRAVITY_DIR="${ANTIGRAVITY_DIR:-$HOME/.antigravity}"

# リソース更新
$ANTIGRAVITY_DIR/agent/scripts/list_resources.sh --update-gemini 2>/dev/null

# 結果表示
echo "workflows: $(ls .agent/workflows/ 2>/dev/null | wc -l) files"
echo "skills: $(ls .agent/skills/ 2>/dev/null | wc -l | tr -d ' ') dirs"
echo "✅ Check-in complete!"
df -h . | tail -1
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
