# gws — Google Workspace CLI

> **追加日**: 2026-03-06  
> **バージョン**: 0.7.0  
> **パッケージ**: `@googleworkspace/cli`  
> **ステータス**: Google developer sample（非公式サポート）

## 概要

Google Workspace向け公式CLIツール。**MCP（Model Context Protocol）ネイティブ対応**で、AIエージェント用に設計。Drive, Gmail, Calendar, Sheets, Docs, Chat等、40以上のAgent Skillを内包。

### 特徴
- **動的APIディスカバリ**: Google Discovery Serviceで実行時に全Workspace APIを自動サポート（→ツール更新不要で新API即時対応）
- **MCP対応**: `gws mcp` でMCPサーバーとして起動可能
- **認証**: OAuth + Google Cloud Project（ローカルキーリング保存）

## インストール

```bash
npm install -g @googleworkspace/cli
gws --version  # → gws 0.7.0
```

## 初回認証セットアップ（要ユーザー実行）

```bash
gws auth setup
# ↑ Google Cloud Projectの作成 + API有効化 + OAuthログインを対話形式でガイド
```

> ⚠️ この手順は**ユーザー側でのインタラクティブな実行が必要**。AIエージェントからは自動実行不可。

## MCP設定（mcp_config.json）

```json
"gws": {
  "command": "gws",
  "args": ["mcp"]
}
```

`~/.gemini/antigravity/mcp_config.json` に追加済み（2026-03-06）。

## 主要コマンド

### Drive
```bash
gws drive files list                  # ファイル一覧
gws drive files get <fileId>          # ファイル取得
gws drive files create --name "test"  # ファイル作成
```

### Gmail
```bash
gws gmail messages list               # メッセージ一覧
gws gmail messages send ...           # メール送信
```

### Calendar
```bash
gws calendar events list              # イベント一覧
gws calendar events insert ...        # イベント作成
```

### Sheets
```bash
gws sheets spreadsheets create ...    # スプレッドシート作成
gws sheets spreadsheets values get <id> <range>  # 値取得
```

### 全APIリスト
```bash
gws --help  # 全サービス一覧
gws <service> --help  # サービス内コマンド一覧
```

## Antigravity内での使い方

AIエージェント（Gemini CLI / Claude等）が `gws mcp` 経由でGoogle Workspaceを操作。
- カレンダー作成・確認 → `gws calendar events list/insert`
- Driveへのファイル保存 → `gws drive files create`
- Sheets連携（データ書き込み等） → `gws sheets spreadsheets values append`

## 既存ツールとの関係

| ツール | パッケージ | 特徴 |
|--------|-----------|------|
| `google-workspace`（MCP） | `@iflow-mcp/google-workspace-mcp-server` | サードパーティ、シンプル |
| **`gws`（MCP）** | `@googleworkspace/cli` | **Google公式、APIカバレッジ広大** |

両方を `mcp_config.json` に登録済み。用途に応じて使い分け可。

## 参考リンク
- npm: https://www.npmjs.com/package/@googleworkspace/cli
- GitHub: https://github.com/googleworkspace/gws-cli
