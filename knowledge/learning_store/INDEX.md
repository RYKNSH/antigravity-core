# Learning Store — 統一インデックス

> 全学習データの横断検索エントリーポイント。
> 各WFの Phase 0 はこのファイルだけ読めば、全学習ソースにアクセスできる。

## 学習データソース一覧

| Source | Location | 生成元WF | 用途 |
|--------|----------|---------|------|
| **Debug Patterns** | `knowledge/debug_patterns/` | `/debug-deep` Step 6, `/error-sweep` Phase 7 | フレームワーク・OS共通のエラーパターン |
| **Galileo Log** | `knowledge/galileo_log/` | `/galileo` Phase 5 | 真実検証の記録、OVERTURN精度追跡 |
| **Sweep Patterns** | プロジェクトルート `/.sweep_patterns.md` | `/error-sweep` Phase 7 | プロジェクト固有の検出原則 |
| **Debug Learnings** | プロジェクトルート `/.debug_learnings.md` | `/debug-deep` Step 6 | プロジェクト固有のデバッグ学習 |
| **Persona Stats** | `skills/persona-orchestration/personas/` | `/debate` Post-Debate | ペルソナのパフォーマンス追跡 |

## 検索手順（エージェント向け）

Phase 0 で学習データを読み込む際は以下の順序:

1. **プロジェクト固有**（最優先）:
   - `.sweep_patterns.md` → Priority Score上位10原則
   - `.debug_learnings.md` → 最新5件

2. **グローバル**:
   - `knowledge/debug_patterns/INDEX.md` → 関連パターン検索
   - `knowledge/galileo_log/INDEX.md` → 関連テスト結果
   - このファイル（`learning_store/INDEX.md`）→ 横断検索

## クロスポリネーション

異なるWFの学習が相互に活用される:

```
/error-sweep の sweep_patterns → /debug-deep の Step 2 で参照
/debug-deep の debug_learnings → /error-sweep の Phase 0 で参照
/galileo の overturn_tracker → /debate で「常識検証」の精度参考
```
