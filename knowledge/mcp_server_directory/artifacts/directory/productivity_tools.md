# Productivity Tool MCP Servers

AIアシスタントがクラウドワークスペース（Notion, Google Driveなど）のデータに直接アクセスし、操作するためのMCPサーバーです。

## Notion

Notionワークスペース内のページやデータベースの検索、読み取り、書き込みを可能にします。

- **URL (Hosted)**: `https://mcp.notion.com/mcp`
- **Official Package**: `@notionhq/notion-mcp-server`
- **Configuration** (Cursor/Claude):
  ```json
  "notion": {
    "type": "http",
    "url": "https://mcp.notion.com/mcp"
  }
  ```
- **Capability**: ページの読み書き、データベースの検索、コメントの参照。2025年後半のアップデートにより、データベースの「データソース」抽象化が強化されています。自律的なプロジェクト管理（アーカイブ実行など）に必須。

## Google Drive

Google Drive上のファイルの検索、フォルダ構造のリスト表示、ファイル内容の読み取り（Markdown/CSV変換含む）をサポートします。

- **Hosted Support**: Googleは2025年12月に公式なマネージドMCPサポートを全サービス対して提供開始予定。
- **Packages**:
  - `@modelcontextprotocol/server-gdrive` (Official Reference Implementation)
    - **Status**: Deprecated as of 2025.1.14 (Maintenance only).
    - **Setup**: Requires a GCP OAuth Client ID file (`gcp-oauth.keys.json`).
  - `piotr-agier/google-drive-mcp` (Advanced operations)
  - `isaacphi/mcp-gdrive` (CLI-centric)
- **Configuration (Reference)**:
  ```json
  "gdrive": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-gdrive"],
    "env": {
      "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/credentials.json"
    }
  }
  ```
- **Authentication Flow**:
  1. `npx -y @modelcontextprotocol/server-gdrive auth` を実行。
  2. ブラウザが起動し、GCPのOAuth認証を完了させる。
  3. **注意**: `npx` 経由では `gcp-oauth.keys.json` が見つからないエラーが発生する場合があるため、Python SDK (`scripts/auth_gdrive.py`) を使用したトークン生成が推奨されます。
  4. 初回実行時に `gcp-oauth.keys.json` (または `credentials.json`) が所定のディレクトリに必要。
- **Capabilities**:
  - ファイル/フォルダの検索と一覧表示
  - Google DocsのMarkdown変換読み取り
  - Google SheetsのCSV変換読み取り・書き込み
  - ファイルの移動、コピー、削除などの管理操作
