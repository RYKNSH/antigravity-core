---name: Daemon Core Operating Insights
description: COO 自己強化学習ループ (L4) が自動生成した Daemon Core の運用知識
generated_by: coo-optimizer
last_updated: 2026-03-10T03:24:36.372Z
---

# Daemon Core Operating Insights

**COO 自己強化学習ループ（L4）** によって自動生成・更新されるスキルシート。
Daemon Core の実績データから学習した最適運用パラメータを記録する。

## 実績サマリー

| 指標 | 値 |
|------|-----|
| 総タスク数 | 9 |
| 成功率 | 33% |
| 平均 LLM コール数 | 10 |
| Stagnation 発生 | 0 件 |
| Budget 超過 | 6 件 |

## 推奨 TTL（タスクカテゴリ別）

| カテゴリ | 推奨 TTL |
|----------|---------|
| testing | 900s (15分) |

## エラーホットスポット（注意すべきエラータイプ）

- **parse_error**: 21件発生
- **parse_error**: Bad control character in string literal in JSON

## Quick Wins（低コストで成功するタスクパターン）

- "[
- **キャッシュ削除**: 特定のキャッシュファイルを削除するタスク (例: `telop_chunks.json`)
- **特定関数のみ修正**: 大規模ファイル内で特定の関数 (`chunk_telops` など) のみを修正するタスク
- **既存ファイルの部分更新**: `write_file` で既存ファイルの全行を読み込み、特定箇所だけを書き換えるタスク
