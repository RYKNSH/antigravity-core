# Global Environment Design & Autonomous Setup (2026-02-07)

## 概要
2026-02-07、Videditのアーカイブ機能を自律駆動（AIによる直接操作）させるため、NotionおよびGoogle Drive用のSDKとMCPサーバーの設定を統合しました。また、SSD運用におけるPython環境の脆弱性（pipコマンドの消失等）に対する救済策を標準化しました。

## 1. Autonomous Action Toolset (Global SDKs)
エージェントがコード実行を通じてクラウドサービスを直接操作できるよう、以下のパッケージをプロジェクトの venv に配備。

- **Google Drive**: `google-api-python-client`, `google-auth-httplib2`, `google-auth-oauthlib`
- **Notion**: `notion-client`

これらは `requirements.txt` にも反映されており、プロジェクトのアーカイブ（Pattern 311）をAIがハンドルするための基盤となります。

## 2. Venv Recovery Pattern: Targeted UV Install
ポータブル環境において仮想環境（.venv）内の `pip` が破損または消失した場合の回復プロトコル。

- **Pattern**: `uv pip install -p path/to/python`
- **Procedure**:
  ```bash
  # システムの uv を使用し、venv 内の python インタープリタを直接ターゲットにしてパッケージを流し込む
  uv pip install -p .venv/bin/python <packages>
  ```
- **Benefit**: venvを再構築することなく、壊れたシンボリックリンクやインタープリタの不整合をバイパスして環境を修復可能です。

## 3. MCP Server Integration (Model Context Protocol)
AIエージェントがコマンドラインからではなく、MCPプロトコルを通じて直接 Notion/GDrive を探索・編集するためのグローバル設定。

- **Path**: `~/.gemini/antigravity/mcp_config.json`
- **New Entries**:
    - **Notion**: HTTP Hosted Endpoint (`https://mcp.notion.com/mcp`)
    - **Google Drive**: `stdio` 型 (`npx -y @modelcontextprotocol/server-gdrive`)
- **Residual Task**: Google Driveの `auth` フローにおいて、`npx` パッケージ内部のパス不整合によるエラーを回避するため、独自の認証スクリプト `scripts/auth_gdrive.py` と手順書 `README_AUTH.md` を提供しました。
- **Autonomous Recovery**: 万が一MCPサーバーが設定不備で動かない場合でも、Agentはインストール済みのSDKと生成された `token.json` を用いて、Pythonコード実行により自律的にDriveを操作可能です。

---
*Verified: 2026-02-07. Environment Setup for Autonomous Archive Feature.*
