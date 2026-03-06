# x-cli — X (Twitter) CLI

> **バージョン**: 0.1.0
> **インストール済み**: `uv tool install git+https://github.com/INFATOSHI/x-cli.git`
> **GitHub**: https://github.com/INFATOSHI/x-cli

## 概要

X (Twitter) API v2対応の高機能CLI。投稿・検索・タイムライン・ブックマーク・いいね/RT・メトリクスまで全対応。

> **運用方針**: Antigravityでは**CLI直打ちが主運用**。`run_command` で `x-cli <command>` を直接実行する。`@enescinar/twitter-mcp` は削除済み（2026-03-06）。

## 認証セットアップ

1. `mkdir -p ~/.config/x-cli` で設定ディレクトリを作成
2. `~/.config/x-cli/.env` に以下のキーを設定（値は1Password → "X Developer" アイテムを参照）
   - API Key / API Secret / Access Token / Access Token Secret
3. `x-cli --help` で動作確認


## 主要コマンド

### 投稿・返信
```bash
x-cli tweet post "Hello world"
x-cli tweet post --reply <tweet-url> "返信テキスト"
x-cli tweet post --quote <tweet-url> "引用テキスト"
x-cli tweet post --poll "Yes,No" "アンケート"
x-cli tweet delete <tweet-id>
```

### 読み取り・検索
```bash
x-cli tweet get <tweet-id-or-url>
x-cli tweet search "from:username keyword"
x-cli me timeline         # ホームタイムライン
x-cli me mentions         # メンション
x-cli user timeline       # ユーザータイムライン
```

### エンゲージメント
```bash
x-cli like <tweet-url>
x-cli retweet <tweet-url>
x-cli me bookmarks        # ブックマーク一覧
x-cli me bookmark <url>   # ブックマーク追加
x-cli me unbookmark <url> # ブックマーク解除
```

### メトリクス・ユーザー情報
```bash
x-cli tweet metrics <tweet-id>
x-cli user get <username>
x-cli user followers
x-cli user following
```

## 参考

- GitHub: https://github.com/INFATOSHI/x-cli
- X Developer Portal: https://developer.x.com
