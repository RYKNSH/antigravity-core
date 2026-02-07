# Infrastructure MCP Servers

インフラストラクチャの管理やデータベース操作を行うためのMCPサーバーです。

## Railway

Railwayプロジェクトやデプロイを管理します。

- **Package**: `@railway/mcp-server`
- **Configuration** (Cursor/Claude):
  ```json
  "railway-mcp-server": {
    "command": "npx",
    "args": ["-y", "@railway/mcp-server"]
  }
  ```
- **Auth**: 初回実行時にブラウザでログインが求められます。

## Supabase

Supabaseプロジェクトのデータベース操作、テーブル管理を行います。

- **URL**: `https://mcp.supabase.com/mcp` (HTTP通信方式)
- **Configuration** (Cursor/Claude):
  ```json
  "supabase": {
    "type": "http",
    "url": "https://mcp.supabase.com/mcp"
  }
  ```
- **Auth**: OAuth認証によりSupabaseへログインします。

## Docker

ローカルのDockerコンテナ（PostgreSQL, MySQL, Redis等）の管理、操作を行います。

- **Package**: `@0xshariq/docker-mcp-server` (Community wrapper)
- **Configuration** (Cursor/Claude):
  ```json
  "docker": {
    "command": "npx",
    "args": ["-y", "@0xshariq/docker-mcp-server"]
  }
  ```
- **Features**: コンテナのリスト、開始/停止、ログ取得、詳細情報の取得。
