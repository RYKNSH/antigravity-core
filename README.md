# antigravity-private

> ⚠️ PRIVATE REPO - DO NOT MAKE PUBLIC

個人用シークレットと設定ファイル。`antigravity-core`(OSS)と自動接続される。

## 構造
```
mcp_config.json   ← MCP設定（トークン含む）
.env              ← APIキー
blogs/            ← 個人ブログ記事
brain_log/        ← セッション履歴
NEXT_SESSION.md   ← セッション引き継ぎ
```

## セットアップ
```bash
# antigravity-core のsetup.shが自動でこのリポもpullする
curl -sL https://raw.githubusercontent.com/RYKNSH/antigravity-core/main/setup.sh | bash
```

