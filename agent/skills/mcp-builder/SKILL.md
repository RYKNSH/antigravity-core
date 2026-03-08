---
name: mcp-builder
description: MCPサーバー構築ガイド。TypeScript/PythonでのMCPサーバー設計・実装・テスト・評価を支援。
source: anthropics/skills (公式)
---

# MCP Server Development Guide

高品質なMCPサーバーを構築するための4フェーズワークフロー。

## 概要

MCPサーバーの品質 = LLMが実世界タスクをどれだけうまく達成できるか。

## 4フェーズ

### Phase 1: リサーチ & 計画

**設計原則:**
- API Coverage vs Workflow Tools のバランス
- 明確なツール命名（`github_create_issue` 等の一貫プレフィックス）
- 簡潔なレスポンス（フィルタ/ページネーション対応）
- アクション可能なエラーメッセージ

**推奨スタック:**
- TypeScript（SDK品質高、型安全）
- Streamable HTTP（リモート）/ stdio（ローカル）

**MCP仕様確認:**
- サイトマップ: `https://modelcontextprotocol.io/sitemap.xml`
- ページは `.md` 付きで取得（例: `https://modelcontextprotocol.io/specification/draft.md`）

### Phase 2: 実装

**インフラ:**
- 認証付きAPIクライアント
- エラーハンドリングヘルパー
- レスポンスフォーマット
- ページネーション

**各ツール実装:**
- Input: Zod (TS) / Pydantic (Python)
- Output: `outputSchema` + `structuredContent`
- Annotations: `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`

### Phase 3: レビュー & テスト

- MCP Inspectorでテスト
- エラーケース検証
- パフォーマンス確認

### Phase 4: 評価作成

- 実タスクベースの評価スクリプト
- 成功基準の定義

---

## Toolchain

**Scripts**: None
**Knowledge**: None
**Related WF**: None

---

## Appendix: Development Best Practices Reference

### MCP アーキテクチャ基礎

**対象者（Participants）**
- **MCP Host**: AIアプリケーション（例: Claude Desktop）。複数のMCP Clientを管理。
- **MCP Client**: MCP Serverと接続を維持し、コンテキストを取得。
- **MCP Server**: コンテキスト（Tools/Resources/Prompts）を提供。

**レイヤー構造**
1. **Data Layer**: JSON-RPC 2.0ベース
2. **Transport Layer**: Stdio（ローカル推奨） または Streamable HTTP（リモート）

### セキュリティ要件

**サーバー側必須（MUST）**
- **入力バリデーション**: Zod等でスキーマ定義・検証を必須化
- **アクセス制御**: `path.startsWith()`等で許可領域を限定
- **レート制限**: 単位時間あたりのリクエスト数制限
- **出力サニタイズ**: ログやエラー出力からの機密情報マスク

**クライアント側推奨（SHOULD）**
- センシティブ操作のユーザー確認（IsSensitiveOperation判定）
- 操作前の入力事前表示
- タイムアウト設定と監査ログ

### リソース設計（URI）

- **HTTPS**: `https://example.com/resource`
- **File**: `file:///path/to/file.txt` (アクセス制御必須)
- **Git**: `git://repo/path/to/file`
- **MUST**: バイナリデータのBase64エンコーディングとMIME Type設定

### エラーハンドリング

- Protocol Errors (JSON-RPC標準): -32602(無効な引数), -32603(内部エラー)
- Tool Execution Errors: `isError: true` フラグを使用してツール結果内にエラー理由をテキストで返す

### ライフサイクルと通知

- **Capability Negotiation**: ツール/リソースリストの変更通知購読などを定義
- **Notifications**: `notifications/resources/list_changed`, `notifications/tools/list_changed` でクライアント側に状態変更をプッシュ

