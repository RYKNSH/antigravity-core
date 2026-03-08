---
name: supabase-postgres-best-practices
description: Supabase公式のPostgreSQLパフォーマンス最適化ガイドライン。SQL, スキーマ設計, RLS, 接続管理に適用。
source: supabase/agent-skills (公式)
version: "1.1.0"
---

# Supabase Postgres Best Practices

8カテゴリのPostgreSQLパフォーマンス最適化ガイド。

## 適用タイミング

- SQLクエリ・スキーマ設計時
- インデックス・クエリ最適化時
- DB性能レビュー時
- 接続プーリング・スケーリング設定時
- Row-Level Security (RLS) 実装時

## カテゴリ別優先度

| 優先 | カテゴリ | インパクト | プレフィックス |
|------|---------|---------|-----------|
| 1 | クエリ性能 | CRITICAL | `query-` |
| 2 | 接続管理 | CRITICAL | `conn-` |
| 3 | セキュリティ & RLS | CRITICAL | `security-` |
| 4 | スキーマ設計 | HIGH | `schema-` |
| 5 | 並行性 & ロック | MEDIUM-HIGH | `lock-` |
| 6 | データアクセスパターン | MEDIUM | `data-` |
| 7 | 監視 & 診断 | LOW-MEDIUM | `monitor-` |
| 8 | 高度な機能 | LOW | `advanced-` |

## 主要ルール

### CRITICAL: クエリ性能
- `query-missing-indexes` — WHERE/JOIN列にインデックス必須
- `query-select-star` — SELECT * 禁止、必要列のみ指定
- `query-n-plus-one` — N+1問題をJOINで解決
- `query-explain-analyze` — EXPLAIN ANALYZEで実行計画確認

### CRITICAL: 接続管理
- `conn-pooling` — 本番では接続プーリング必須（PgBouncer/Supavisor）
- `conn-idle-timeout` — アイドルタイムアウト設定
- `conn-max-connections` — 最大接続数の適切な設定

### CRITICAL: セキュリティ
- `security-rls-enabled` — テーブルにRLS有効化必須
- `security-rls-policy` — 最小権限ポリシー設計
- `security-service-role` — service_roleキー使用を最小限に

### HIGH: スキーマ設計
- `schema-partial-indexes` — 部分インデックスでストレージ節約
- `schema-appropriate-types` — 適切なデータ型選択（textよりenum等）
- `schema-foreign-keys` — 外部キー制約で整合性保証

## リファレンス

- [PostgreSQL公式ドキュメント](https://www.postgresql.org/docs/current/)
- [Supabase Docs](https://supabase.com/docs)
- [Supabase RLSガイド](https://supabase.com/docs/guides/auth/row-level-security)

---

## Toolchain

**Scripts**: None
**Knowledge**: None
**Related WF**: None
