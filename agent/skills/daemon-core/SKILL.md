name: Daemon Core Operating Insights
description: COO 自己強化学習ループ (L4) が自動生成した Daemon Core の運用知識
generated_by: coo-optimizer
last_updated: 2026-03-10T04:35:08.974Z
---

# Daemon Core Operating Insights

**COO 自己強化学習ループ（L4）** によって自動生成・更新されるスキルシート。
Daemon Core の実績データから学習した最適運用パラメータを記録する。

## 実績サマリー

| 指標 | 値 |
|------|-----|
| 総タスク数 | 12 |
| 成功率 | 0% |
| 平均 LLM コール数 | 20 |
| Stagnation 発生 | 0 件 |
| Budget 超過 | 12 件 |

## 推奨 TTL（タスクカテゴリ別）

| カテゴリ | 推奨 TTL |
|----------|---------|
| general | 900s (15分) |
| testing | 900s (15分) |

## エラーホットスポット（注意すべきエラータイプ）

- **parse_error**: 29件発生
- **write_er**

## Quick Wins

- VID BUDDY テロップ区切りロジック修正 (P0+P1+キャッシュ削除)
- VID BUDDY テロップ区切りロジック品質改善
