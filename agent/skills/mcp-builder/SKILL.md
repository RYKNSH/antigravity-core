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
