# Development Tool MCP Servers

開発ワークフローを効率化するための標準的なMCPサーバーです。

## GitHub

リポジトリの検索、Issueの作成、PRの管理などを行います。

- **Package**: `@modelcontextprotocol/server-github`
- **Env**: `GITHUB_PERSONAL_ACCESS_TOKEN`
- **Required Scopes**: `repo`, `user`, `project`

## Git

ローカルリポジトリの詳細な操作を行います。

- **Package**: `@modelcontextprotocol/server-git` (Reference server)
- **Command**: `npx -y @modelcontextprotocol/server-git`

## Filesystem

ローカルファイルの安全な読み書き操作を許可します。

- **Package**: `@modelcontextprotocol/server-filesystem`
- **Args**: 許可するディレクトリのパスを指定する必要があります。
  ```json
  "args": ["/Users/user/projects/my-app"]
  ```

## Fetch

Webページの取得とLLMに最適化された形式（Markdown等）への変換を行います。

- **Package**: `@modelcontextprotocol/server-fetch`

## Desktop Commander

ターミナル操作、ファイルシステムの検索、diff形式でのファイル編集機能を提供します。

- **Package**: `@wonderwhy-er/desktop-commander`
- **Note**: `@anthropic/mcp-server-desktop-commander` などは存在しないため、このコミュニティパッケージを使用してください。
- **Features**: ターミナル制御、プロセス管理、詳細なファイル編集（Diff/Patch）
- **Repository**: `https://github.com/wonderwhy-er/DesktopCommanderMCP`

## Homebrew

macOSのシステムパッケージ管理操作を直接行います。

- **Command**: `brew mcp-server` (Built-in)
- **Configuration** (Cursor/Claude):
  ```json
  "homebrew": {
    "command": "brew",
    "args": ["mcp-server"]
  }
  ```
- **Features**: パッケージの検索、情報取得、インストール、アンインストール、クリーンアップ。
