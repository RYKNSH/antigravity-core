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

## 保持するもの

- `knowledge/` - ナレッジベース
- `user_settings.pb` - ユーザー設定
- `mcp_config.json` - MCP設定
- `browserAllowlist.txt` - ブラウザ許可リスト

## 削除するもの

- `browser_recordings/` - 全削除
- `conversations/*.pb` - 古いもの全削除
- `brain/` - 古いartifacts全削除
- `implicit/` - キャッシュ全削除
- Chrome/Adobe/Notion/npmキャッシュ


## Phase 0: Antigravity GitHub Sync
// turbo

GitHub から最新の Antigravity core を pull（他環境からの変更を取得）:

```bash
ANTIGRAVITY_DIR="$ANTIGRAVITY_DIR"
[ ! -d "$ANTIGRAVITY_DIR" ] && ANTIGRAVITY_DIR="$HOME/.antigravity"
if [ -d "$ANTIGRAVITY_DIR/.git" ]; then
  cd "$ANTIGRAVITY_DIR"
  git pull origin main 2>/dev/null && echo "✅ Antigravity core updated from GitHub" || echo "⚠️ GitHub pull failed (offline?)"
fi
```

---

## Phase 1: クリーンアップ

0. USAGE_TRACKER更新（自動トラッキング）
```bash
$ANTIGRAVITY_DIR/agent/scripts/update_usage_tracker.sh checkin
```

// turbo
1. SSD構造確認（コンテキスト把握高速化）
```bash
echo "=== SSD Structure ===" && ls $ANTIGRAVITY_DIR/ 2>/dev/null || echo "SSD not connected"
```

// turbo
2. 現在のストレージ確認
```bash
df -h . | tail -1
```


2. browser_recordings全削除
```bash
rm -rf ~/.gemini/antigravity/browser_recordings/* && echo "browser_recordings cleared"
```

3. 古いconversations削除 (24h+)
```bash
find ~/.gemini/antigravity/conversations -name "*.pb" -mtime +1 -delete && echo "old conversations cleared"
```

4. 古いbrain artifacts削除 (24h+)
```bash
find ~/.gemini/antigravity/brain -mindepth 1 -maxdepth 1 -type d -mtime +1 -exec rm -rf {} + 2>/dev/null; echo "old brain artifacts cleared"
```

5. implicit全削除
```bash
rm -rf ~/.gemini/antigravity/implicit/* && echo "implicit cache cleared"
```

6. システムキャッシュ削除
```bash
rm -rf ~/Library/Application\ Support/Google/Chrome/Default/Service\ Worker 2>/dev/null
rm -rf ~/Library/Application\ Support/Adobe/CoreSync 2>/dev/null
rm -rf ~/Library/Application\ Support/Notion/Partitions 2>/dev/null
rm -rf ~/.npm/_npx ~/.npm/_logs ~/.npm/_prebuilds ~/.npm/_cacache 2>/dev/null
echo "system caches cleared"
```

---

## Phase 2: 環境最新化（プロジェクト初期化）

7. ワークスペースの.agentディレクトリ確認・作成
```bash
mkdir -p .agent/{skills,workflows}
```

8. グローバルワークフローの同期（SSD → ワークスペース）
SSDから最新のワークフローを同期（ローカルの方が新しいファイルは保護）:
```bash
rsync -a --update $ANTIGRAVITY_DIR/agent/workflows/*.md .agent/workflows/ 2>/dev/null && echo "workflows synced (--update: local customizations preserved)" || echo "SSD not connected, skipping workflow sync"
```

9. グローバルスキルの同期・アップデート（SSD → ワークスペース）
SSDから最新のスキルを同期（ローカルの方が新しいファイルは保護）:
```bash
rsync -a --update $ANTIGRAVITY_DIR/agent/skills/ .agent/skills/ 2>/dev/null && echo "skills synced/updated (--update: local customizations preserved)" || echo "SSD not connected, skipping skill sync"
```

10. MCP設定の同期（SSD → ホスト）
SSDからマスターMCP設定をコピーし、チルダパスを展開、gdrive クレデンシャルをローカルにコピー:
```bash
# MCP設定コピー + チルダ展開
cp $ANTIGRAVITY_DIR/mcp_config.json ~/.gemini/antigravity/mcp_config.json 2>/dev/null && \
  sed -i '' "s|~/|$HOME/|g" ~/.gemini/antigravity/mcp_config.json && \
  echo "mcp_config synced" || echo "SSD not connected, skipping MCP config sync"
# gdrive クレデンシャルをローカルにコピー
mkdir -p ~/.secrets/antigravity/gdrive && \
  cp $ANTIGRAVITY_DIR/credentials/credentials.json ~/.secrets/antigravity/gdrive/gcp-oauth.keys.json 2>/dev/null && \
  cp $ANTIGRAVITY_DIR/credentials/.gdrive-server-credentials.json ~/.secrets/antigravity/gdrive/.gdrive-server-credentials.json 2>/dev/null && \
  echo "gdrive credentials synced" || echo "gdrive credentials not found, skipping"
# mcp-server-gdrive 確認（グローバルインストールはユーザー確認が必要）
if ! command -v mcp-server-gdrive >/dev/null 2>&1; then
  echo "⚠️  mcp-server-gdrive が未インストールです。必要な場合は手動で: npm install -g @modelcontextprotocol/server-gdrive"
fi
```

10.5 GEMINI.md マスター同期（SSD → ホスト）
SSDマスターから `~/.gemini/GEMINI.md` を同期し、Proactive Triggers等のグローバルルールを反映:
```bash
GEMINI_MASTER="$ANTIGRAVITY_DIR/agent/rules/GEMINI.md.master"
GEMINI_LOCAL="$HOME/.gemini/GEMINI.md"
if [ -f "$GEMINI_MASTER" ]; then
  cp "$GEMINI_MASTER" "$GEMINI_LOCAL" && echo "✅ GEMINI.md synced from SSD master"
else
  echo "⚠️ GEMINI.md.master not found on SSD"
fi
```

---

## Phase 2.5: プロジェクト環境復元 (Lazy Install)

前回の `/checkout` で削除された `node_modules` / `.venv` 等を、**作業対象プロジェクトのみ**復元する。

11. SSD上のプロジェクト一覧を表示

```bash
SSD="/Volumes/PortableSSD"
if [ ! -d "$SSD" ]; then
  echo "⏭️  SSD not connected, skipping project restore"
else
  echo "=== SSD Projects ==="
  echo ""
  echo "📦 Node.js projects (package.json detected):"
  find "$SSD/STUDIO/Apps" -maxdepth 2 -name "package.json" -not -path "*/node_modules/*" 2>/dev/null | while read pkg; do
    DIR=$(dirname "$pkg")
    NAME=$(basename "$DIR")
    HAS_NM="❌"
    [ -d "$DIR/node_modules" ] && HAS_NM="✅"
    echo "  $HAS_NM $NAME ($DIR)"
  done
  echo ""
  echo "🐍 Python projects (pyproject.toml detected):"
  find "$SSD/STUDIO/Apps" -maxdepth 2 -name "pyproject.toml" -not -path "*/.venv/*" 2>/dev/null | while read pyp; do
    DIR=$(dirname "$pyp")
    NAME=$(basename "$DIR")
    HAS_VENV="❌"
    [ -d "$DIR/.venv" ] && HAS_VENV="✅"
    echo "  $HAS_VENV $NAME ($DIR)"
  done
fi
```

12. ユーザーに作業対象プロジェクトを確認

**「今回どのプロジェクトで作業しますか？」** とユーザーに質問する。
回答パターン:
- プロジェクト名を指定 → そのプロジェクトのみ復元
- `all` → 全プロジェクト復元（時間に余裕がある場合）
- `skip` or 空 → 復元をスキップ（後で手動実行）

13. 指定プロジェクトの環境構築

ユーザーが指定したプロジェクトに対して以下を実行:

**Node.js プロジェクトの場合:**
```bash
# 対象ディレクトリに cd して実行
cd "$PROJECT_DIR"
if [ -f "pnpm-lock.yaml" ]; then
  pnpm install && echo "✅ pnpm install complete: $(basename $PROJECT_DIR)"
elif [ -f "package-lock.json" ]; then
  npm install && echo "✅ npm install complete: $(basename $PROJECT_DIR)"
elif [ -f "yarn.lock" ]; then
  yarn install && echo "✅ yarn install complete: $(basename $PROJECT_DIR)"
else
  pnpm install && echo "✅ pnpm install complete: $(basename $PROJECT_DIR)"
fi
```

**Python プロジェクトの場合:**
```bash
cd "$PROJECT_DIR"
if [ -f "pyproject.toml" ]; then
  if command -v uv >/dev/null; then
    uv venv .venv --allow-existing --python 3.11 && source .venv/bin/activate && uv pip install -r requirements.txt && echo "✅ uv pip install complete: $(basename $PROJECT_DIR)"
  else
    # Fallback to python3.11 if available, else python3 (with warning)
    PY_BIN="python3"
    if command -v python3.11 >/dev/null; then PY_BIN="python3.11"; fi
    $PY_BIN -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && echo "✅ pip install complete: $(basename $PROJECT_DIR)"
  fi
fi
```

---

## Phase 2.6: Project Mount Proposal (New)

SSD I/O ボトルネック解消のため、Desktopへのマウントを提案する。

13.5. マウント提案
```bash
echo "?? Project Mount System (Beta)"
echo "  SSD上のプロジェクトを Desktop (~/Desktop/AntigravityWork) に展開し、"
echo "  高速な内蔵SSDで作業することができます。"
echo "  (終了時に /unmount で自動的に書き戻されます)"
```

**「プロジェクトをDesktopにマウントして作業しますか？ (y/n/skip)」**

- **Yes**: `/mount` ワークフローを呼び出す（`/work` 経由または直接実行）
- **No**: そのままSSD上で作業（従来通り Phase 2.7 へ）

---

## Phase 2.7: 前回セッション引き継ぎ（自動）

前回の `/checkout` で生成された `NEXT_SESSION.md` を自動的に読み込み、コンテキストを復元する。

14. NEXT_SESSION.md の検索と読み込み

```bash
# プロジェクトルートを検索
NEXT_SESSION=$(find . $SSD/STUDIO -maxdepth 3 -name "NEXT_SESSION.md" -mtime -7 2>/dev/null | head -1)
if [ -n "$NEXT_SESSION" ]; then
  echo "📋 前回セッション引き継ぎ発見: $NEXT_SESSION"
  cat "$NEXT_SESSION"
else
  echo "ℹ️  NEXT_SESSION.md なし（新規セッション）"
fi
```

15. 引き継ぎ内容の表示

**NEXT_SESSION.md が見つかった場合:**
- 未完了タスクを一覧表示
- 「続きから作業しますか？ 新しいタスクを始めますか？」と確認
- SSD ブレインログ (`$ANTIGRAVITY_DIR/brain_log/`) にも最新ログがあれば参照

**見つからなかった場合:**
- スキップして Phase 2.75 へ

---

## Phase 2.75: Deferred Tasks リトライ（自動）

前回セッションで SSD I/O タイムアウト等により完了できなかったタスクを自動リトライする。

16. NEXT_SESSION.md の `## 🔄 Deferred Tasks` セクションを検索

```bash
NEXT_SESSION=$(find . $SSD /Volumes/PortableSSD -maxdepth 2 -name "NEXT_SESSION.md" -mtime -7 2>/dev/null | head -1)
if [ -n "$NEXT_SESSION" ] && grep -q "Deferred Tasks" "$NEXT_SESSION" 2>/dev/null; then
  echo "🔄 Deferred Tasks 検出:"
  sed -n '/## 🔄 Deferred Tasks/,/^## /p' "$NEXT_SESSION" | head -20
fi
```

17. 未完了タスクの自動リトライ
- `- [ ]` で始まる行を抽出
- 各タスクを **perl alarm 付き** で再実行
- 成功 → `- [x]` に更新
- 再度タイムアウト → そのまま残す（次回セッションでリトライ）

---

## Phase 2.8: 学習データ読み込み（自動）

プロジェクトルートに以下のファイルが存在すれば自動読み込み:

- **`.sweep_patterns.md`** — `/error-sweep` Phase 7 で蓄積された検出原則
- **`.debug_learnings.md`** — `/debug-deep` Step 6 で蓄積されたデバッグ知見

```bash
for f in .sweep_patterns.md .debug_learnings.md; do
  [ -f "$f" ] && echo "📚 学習データ読み込み: $f" && cat "$f" || true
done
```

> これらは `/error-sweep` Phase 0 (Step 0-0) でも参照されるが、`/checkin` 時に先に読み込むことでセッション全体のコンテキストに含まれる。

---

## Phase 3: 完了

16. GEMINI.mdリソース一覧を動的更新
```bash
$ANTIGRAVITY_DIR/agent/scripts/list_resources.sh --update-gemini
```

// turbo
17. 最終確認
```bash
df -h . | tail -1 && echo "---"
ls .agent/workflows/ 2>/dev/null | head -5
ls .agent/skills/ 2>/dev/null | head -5
echo "---Check-in complete!"
```

✅ チェックイン完了
- 一時データ削除済み
- ワークフロー最新化済み
- スキル最新化済み（first-principles等のアップデート反映）
- プロジェクト環境復元済み（指定プロジェクトのみ）
- 前回セッション引き継ぎ済み（NEXT_SESSION.md）

## Vision OS モード対応

`/go --vision "ビジョン"` 経由で呼ばれた場合:
- チェックイン完了後、`/vision-os` へ自動分岐
- ビジョンテキストをコンテキストとして `/vision-os` に渡す
- 通常の `/work` フローはスキップ

## 注意

> このワークフローは**全ての一時データを削除**します。
> 引き継ぎたいconversationがある場合は事前にKI化してください。

