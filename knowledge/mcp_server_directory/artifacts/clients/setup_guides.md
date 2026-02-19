# MCP Client Setup Guides

MCPサーバーを使用するには、クライアント側の設定ファイルにサーバー情報を記述する必要があります。

## 1. Cursor

設定ファイルの場所: `.cursor/mcp.json` (プロジェクトルート)

```json
{
  "mcpServers": {
    "server-id": {
      "command": "npx",
      "args": ["-y", "@scope/package-name"],
      "env": {
        "KEY": "VALUE"
      }
    }
  }
}
```

## 2. VS Code

設定ファイルの場所: `.vscode/mcp.json` (プロジェクトルート)

```json
{
  "servers": {
    "server-id": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@scope/package-name"],
      "env": {
        "KEY": "VALUE"
      }
    }
  }
}
```

## 3. Claude Desktop

設定ファイルの場所: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "server-id": {
      "command": "npx",
      "args": ["-y", "@scope/package-name"],
      "env": {
        "KEY": "VALUE"
      }
    }
  }
}
```

## 4. Claude Code (CLI)

コマンドラインから動的に追加可能です。

```bash
claude mcp add <server-id> -- npx -y <package-name>
```

## 5. Antigravity Agent

設定ファイルの場所: `.agent/mcp/<server-id>/mcp.json` (プロジェクトルート)

```json
{
  "name": "server-id",
  "version": "1.0.0",
  "type": "mcp",
  "command": "npx",
  "args": ["-y", "@scope/package-name"],
  "env": {
    "KEY": "${KEY_FROM_ENV_LOCAL}"
  }
}
```
※ `${VARIABLE}` 形式で `.env.local` から値を注入可能です。

---

## 認証と環境変数

多くのMCPサーバーはAPIキーやトークンを必要とします。
- クライアントの設定ファイル内の `env` セクションに直接記述するか、
- システムの環境変数（`.zshrc`, `.bashrc` 等）に `export` して参照させます。

---

## 設定の反映と検証

設定を有効にするには、以下のステップが不可欠です。

### 1. エディタ/アプリの再起動
設定ファイル（`mcp.json`等）を書き換えたり、`.agent/mcp/` に新しいディレクトリを追加したりしただけでは、現在起動中のエディタやAIアシスタントには反映されません。必ず対象のアプリケーションを完全に**再起動**してください。再起動により、設定ディレクトリの再スキャンが行われます。

### 2. 環境変数の適用
システムの環境変数を使用する場合、ターミナルやシェルで `source ~/.zshrc` などを行い、新しい設定が現在のセッションに読み込まれていることを確認してください。

### 3. 動作検証
AIアシスタントに以下の質問をして、ツールが認識されているか確認してください：
- 「利用可能なMCPサーバーを一覧表示して」
- 「[サーバー名] のツールが使えるか確認して」

ツール一覧に目的のツールが表示されない場合は、設定ファイルのパスやJSONの構文（カンマの不足など）を再確認してください。
