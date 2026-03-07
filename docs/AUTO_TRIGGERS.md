# Auto Triggers

> AIがユーザー発言・状況に応じて自律的にワークフローを提案・実行するルール。
> 詳細なルーティングは `.agent/workflows/WORKFLOW_ROUTER.md` を参照。

## 発言トリガー

| パターン | アクション |
|---------|-----------|
| 「おはよう」「始めよう」/ 6h+空白 | `/checkin` |
| 「終わり」「また明日」 | `/checkout` |
| 「バグ」「エラー」 | `/bug-fix` |
| 「新機能」「追加して」 | `/spec` → `/new-feature` |
| 「整理」「リファクタ」 | `/refactor` |
| 「デプロイ」「公開」 | `/ship` |
| 「本当に？」「検証して」 | `/galileo` |
| 「フルチェック」「完全チェック」「全スコープ」 | `/fullcheck` |
| 「つづけて」「go」「進めて」 | 次ステップを自律実行 |

## AI自律トリガー

| 条件 | アクション |
|------|-----------|
| 実装完了 | `/verify` 自動 |
| 変更6ファイル以上 | `/verify --deep` |
| フロントエンド・UIの変更後 | `browser_subagent` を起動しコンソールエラーとUI検証を自動実行 |
| verify通過+staging存在 | `/ship staging` 提案 |
| 新APIエンドポイント | `/error-sweep` Contract重点チェック |
| テスト品質スコア C以下 | `/test-evolve` 提案 |
| `/fbl deep` 実行時 | `/test-evolve quick` 自動（Phase 5.75） |
| リリース前チェック | `/test-evolve` full 提案 |
| `/ship --fullcheck` | `/fullcheck` → `/ship`（Tier 1-6 全稼働） |

## 自律継続ルール

- `notify_user` はブロッキング判断が必要な場合のみ
- 「何をやりましょう？」は禁止。自分で判断して実行
- 全タスク完了時のみ最終レポートを送信
