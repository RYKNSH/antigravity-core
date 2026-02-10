# Debug Patterns Index

グローバルなデバッグパターン集。
`/debug-deep` Step 2 でエージェントが自動検索する。

プロジェクト固有でないパターン（フレームワーク起因、OS起因、一般的なパターン）をここに蓄積する。

## 命名規則

`[category]_[pattern].md`

例:
- `nextjs_hydration_mismatch.md`
- `macos_permission_sandbox.md`
- `prisma_migration_drift.md`
- `docker_port_conflict.md`

## 参照タイミング

1. `/debug-deep` Step 2（ディープリサーチ）で自動検索
2. Execution Loop Step 4（エラー発生時）で `.debug_learnings.md`（プロジェクト単位）と同時に検索
3. `/checkin` 時にプロジェクトの `.debug_learnings.md` を自動参照

## 二重学習構造

```
エラー発生
  ↓
プロジェクト固有? → .debug_learnings.md（プロジェクトルート）
  ↓
汎用パターン? → knowledge/debug_patterns/（グローバル）
  ↓
次回同パターン → 即座に正しいアプローチを選択
```
