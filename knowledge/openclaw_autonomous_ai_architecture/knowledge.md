# OpenClaw: 永続的自律AIエージェント・アーキテクチャ

> **Source**: dabit3 (Nader Dabit) — "You Could've Invented OpenClaw"
> - [X Article](https://x.com/dabit3/status/2021387483364151451)
> - [Tutorial Gist (Markdown)](https://gist.github.com/dabit3/bc60d3bea0b02927995cd9bf53c3db32)
> - [Mini OpenClaw (~400行 Python)](https://gist.github.com/dabit3/86ee04a1c02c839409a02b20fe99a492)

## 概要

OpenClawは、AIエージェントとメッセージングアプリを接続するゲートウェイ。ツールによるコンピュータ操作と、会話を超えた永続メモリを提供する。

**解決する4つの根本課題:**
1. **ステートレス** → セッション永続化 + 長期メモリ
2. **受動的** → Heartbeat（Cron Jobs）
3. **孤立** → ツール + エージェントループ
4. **単一チャネル** → ゲートウェイパターン

---

## 10コンポーネント・アーキテクチャ

### 1. Persistent Sessions（セッション永続化）
- **形式**: JSONL（1行1メッセージ、append-only）
- **パス**: `~/.openclaw/agents/<agentId>/sessions/<sessionId>.jsonl`
- **特徴**: クラッシュ時の損失は最大1行。プロセス再起動でも会話継続
- **キーパターン**: `load_session()` / `append_to_session()` / `save_session()`

### 2. SOUL.md（人格定義）
- **パス**: `~/.openclaw/workspace/SOUL.md`
- **役割**: system promptとして毎回注入。名前・性格・行動境界・記憶指示を定義
- **原則**: 具体的なほど一貫性が高い（「helpful」より「sycophantでなく意見を持つ」）

### 3. Agent Loop + Tools（エージェントループ）
- **構造**: `while True` → LLM呼び出し → `stop_reason == "tool_use"` なら実行 → 結果をfeedback → 繰り返し
- **標準ツール**: `run_command`, `read_file`, `write_file`, `web_search`, `save_memory`, `memory_search`
- **拡張ツール**: ブラウザ操作、エージェント間メッセージング、サブエージェント生成
- **パターン**: スキーマ定義 → 説明 → 実行関数

```python
def run_agent_turn(messages, system_prompt):
    while True:
        response = client.messages.create(
            model="claude-sonnet-4-5-20250929",
            system=system_prompt,
            tools=TOOLS,
            messages=messages
        )
        if response.stop_reason == "end_turn":
            return extract_text(response), messages
        if response.stop_reason == "tool_use":
            # ツール実行 → 結果をmessagesに追加 → ループ継続
```

### 4. Permission Controls（権限制御）
- **3階層**: `safe`（自動許可）→ `approved`（過去承認済み）→ `needs_approval`（ユーザー確認必要）
- **永続化**: `exec-approvals.json` に承認履歴を保存（同じコマンドの再確認不要）
- **拡張**: globパターン対応（`git *` で一括承認）、3-tierモデル（ask/record/ignore）

### 5. Gateway Pattern（ゲートウェイ）
- **核心**: `run_agent_turn()` はチャネル非依存。同一セッション・同一メモリに複数インターフェース
- **実装**: Telegram + HTTP API + Discord + WhatsApp + Slack + Signal + iMessage
- **設定**: JSON config-drivenでチャネル追加
- **セッションスコープ**: `main`（全DM共有）/ `per-peer`（人別）/ `per-channel-peer`（チャネル×人別）

### 6. Context Compaction（コンテキスト圧縮）
- **トリガー**: トークン推定 > 100,000（128kウィンドウの~80%）
- **処理**: 古いメッセージを要約 → `[Previous conversation summary]` + 最新メッセージで置換
- **保存項目**: ユーザー情報、重要な決定、未完了タスク

### 7. Long-Term Memory（長期メモリ）
- **形式**: Markdownファイル（`./memory/<key>.md`）
- **ツール**: `save_memory`（保存）/ `memory_search`（キーワード検索）
- **特徴**: セッションリセットを超えて永続。全エージェントがアクセス可能
- **拡張**: ベクトル検索（SQLite + 埋め込み）+ FTS5（完全テキスト検索）

### 8. Command Queue（コマンドキュー）
- **課題**: 同一セッションへの同時書き込みによるデータ破損
- **解決**: `defaultdict(threading.Lock)` でセッション単位のロック
- **拡張**: レーン分離（メッセージ / cron / サブエージェント）でHeartbeatがリアルタイム会話をブロックしない

### 9. Heartbeats / Cron Jobs
- **パターン**: `schedule` ライブラリでタイマー実行 → 専用セッションキー（`cron:morning-briefing`）
- **隔離**: 各Heartbeatは独自セッション（メイン会話を汚さない）
- **拡張**: 完全cronexpression対応（`30 7 * * *`）

### 10. Multi-Agent Routing（マルチエージェント）
- **構造**: `AGENTS = {"main": {...}, "researcher": {...}}`
- **ルーティング**: メッセージプレフィックス（`/research`）でエージェント切り替え
- **連携**: 共有メモリディレクトリを介した間接協調
- **拡張**: `sessions_spawn` でサブエージェント動的生成、タイムアウト付き

---

## Antigravity参考対照（別プロダクトとして構築）

> [!IMPORTANT]
> OpenClawベースの自律AIコアは**Antigravityとは完全に独立した別製品**として構築する。
> 以下はAntigravityでの学びを参考として記録したもの。マージはしない。

| OpenClaw | Antigravityでの学び | 新コアでの実装 |
|----------|-------------------|---------------|
| SOUL.md | rules/ + MEMORY方式が参考になる | SOUL.mdをそのまま採用 |
| Persistent Sessions | JSONL append-only | JSONL形式で実装 |
| Agent Loop + Tools | MCP方式の知見あり | OpenClaw方式のwhile Trueループ |
| Permission Controls | safe-commands.md方式 | 3-tier（safe/approved/needs_approval） |
| Gateway Pattern | 未経験 | **コアの最重要機能** |
| Context Compaction | compaction.md方式 | トークン推定 + 自動要約 |
| Long-Term Memory | knowledge/方式 | ファイルベース + ベクトル検索 |
| Command Queue | 未経験 | per-sessionロック + レーン分離 |
| Heartbeats | immortal-agent-coreスキル | cronベーススケジューラ |
| Multi-Agent | persona-orchestration | SOUL + session + routing |

---

## 実装戦略: discord-buddy内 BotPlugin として統合 (Debate v3 結論)

> [!IMPORTANT]
> OpenClawの設計パターンをTypeScriptに翻訳し、discord-buddyモノレポの
> `packages/agent-brain` として実装。既存 `products/antigravity-agent` に組み込む。
> Pythonの独立プロダクトではない。

### 新パッケージ構造

```
packages/agent-brain/            # discord-buddyモノレポ内
├── src/
│   ├── index.ts                 # エクスポート
│   ├── agent-loop.ts            # while(tool_use)ループ
│   ├── session.ts               # JSONLセッション管理
│   ├── memory.ts                # 長期メモリ（save/search）
│   ├── compaction.ts            # コンテキスト圧縮
│   ├── soul.ts                  # SOUL.md読み込み・注入
│   ├── tools/
│   │   ├── registry.ts          # ツール定義・登録
│   │   ├── read-file.ts
│   │   ├── memory-tools.ts
│   │   └── web-search.ts
│   └── types.ts
├── souls/
│   └── default.md               # デフォルトSOUL
└── package.json                 # @anthropic-ai/sdk, @discord-buddy/types
```

### 組み込み先: `products/antigravity-agent`

既存の `BotPlugin` インターフェースに準拠:

```typescript
const agentBrainPlugin: BotPlugin = {
  name: 'agent-brain',
  requiredIntents: [GuildMessages, MessageContent],
  async setup(client) {
    const brain = new AgentBrain({ soulPath: './souls/default.md' });
    // /ask, /remember, /recall, /reset コマンド登録
  }
};
```

### 既存資産の再利用

| 資産 | 活用方法 |
|------|----------|
| `packages/llm-client` | Anthropic SDK統合済み（ただしAgent Loopは直接SDK使用） |
| `packages/bot-plugins` | BotPlugin IF + PluginManager |
| turbo + pnpm | CI/CDパイプラインそのまま |
| Railway + Dockerfile | デプロイ変更なし |

### 段階的リリース

| Phase | 内容 | 規模 |
|-------|------|------|
| 1 | Agent Loop + SOUL + Session（`/ask`のみ） | ~200行 |
| 2 | 長期メモリ（`/remember` `/recall`） | +100行 |
| 3 | Thread + DM対応 | +80行 |
| 4 | Compaction + ツール拡張 | 後日 |

---

## フォーク戦略（将来展開）

agent-brainパッケージのSOUL + ツール差替えで派生ボットを `products/` に追加:

| 製品 | SOUL | ツール |
|------|------|--------|
| 広告運用AI Bot | 広告最適化専門家 | Meta/Google Ads API |
| EC管理 Bot | EC運用者 | Shopify/在庫API |
| 顧客サポート Bot | CS担当 | CRM/FAQ検索 |

---

## 参考リンク
- [Tutorial Gist](https://gist.github.com/dabit3/bc60d3bea0b02927995cd9bf53c3db32)
- [Mini Implementation (Python参照実装)](https://gist.github.com/dabit3/86ee04a1c02c839409a02b20fe99a492)
