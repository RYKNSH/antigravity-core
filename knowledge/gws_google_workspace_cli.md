# gws — Google Workspace CLI

> **追加日**: 2026-03-06  
> **バージョン**: 0.7.0  
> **パッケージ**: `@googleworkspace/cli`  
> **ステータス**: Google developer sample（非公式サポート）

## 概要

Google Workspace向け公式CLIツール。Drive, Gmail, Calendar, Sheets, Docs, Chat等、全Workspace APIを尊を統一コマンドで操作できる。

> **運用方針**: Antigravityでは**CLI直打ちが主運用**。`run_command` で `gws <command>` を直接実行する。MCP経由は不要。

### 特徴
- **動的APIディスカバリ**: Google Discovery Serviceで全Workspace APIを自動サポート
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

AIエージェントは `run_command` で**gws CLIを直接呼び出す**。MCP経由は不要。

```bash
# 例: AIが run_command で直接実行
gws drive files list
gws calendar events list --calendar-id primary
gws gmail messages list --max-results 10
gws sheets spreadsheets values get <id> <range>
```


## 参考リンク
- npm: https://www.npmjs.com/package/@googleworkspace/cli
- GitHub: https://github.com/googleworkspace/gws-cli
