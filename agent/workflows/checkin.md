---
description: セッション開始時に不要データを削除し、環境を最新化して軽量状態で開始
---
# Check-in (セッション開始)

作業開始時に実行。クリーンアップ＋環境の最新化。

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

// turbo-all

## Phase 1: クリーンアップ

0. USAGE_TRACKER更新（自動トラッキング）
```bash
/Volumes/PortableSSD/.antigravity/agent/scripts/update_usage_tracker.sh checkin
```

1. SSD構造確認（コンテキスト把握高速化）
```bash
echo "=== SSD Structure ===" && ls /Volumes/PortableSSD/.antigravity/ 2>/dev/null || echo "SSD not connected"
```

2. 現在のストレージ確認
```bash
df -h / | tail -1
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
SSDから最新のワークフローをコピー:
```bash
cp /Volumes/PortableSSD/.antigravity/agent/workflows/*.md .agent/workflows/ 2>/dev/null && echo "workflows synced" || echo "SSD not connected, skipping workflow sync"
```

9. グローバルスキルの同期・アップデート（SSD → ワークスペース）
SSDから最新のスキルをコピー（first-principles等のアップデートを反映）:
```bash
cp -R /Volumes/PortableSSD/.antigravity/agent/skills/* .agent/skills/ 2>/dev/null && echo "skills synced/updated" || echo "SSD not connected, skipping skill sync"
```

---

## Phase 3: 完了

10. GEMINI.mdリソース一覧を動的更新
```bash
/Volumes/PortableSSD/.antigravity/agent/scripts/list_resources.sh --update-gemini
```

11. 最終確認
```bash
df -h / | tail -1 && echo "---" && sysctl vm.swapusage && echo "---"
ls .agent/workflows/ 2>/dev/null | head -5
ls .agent/skills/ 2>/dev/null | head -5
echo "---Check-in complete!"
```

✅ チェックイン完了
- 一時データ削除済み
- ワークフロー最新化済み
- スキル最新化済み（first-principles等のアップデート反映）

## 注意

> このワークフローは**全ての一時データを削除**します。
> 引き継ぎたいconversationがある場合は事前にKI化してください。
