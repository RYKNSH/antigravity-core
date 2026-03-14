---
name: Daemon Core Operating Insights
description: COO 自己強化学習ループ (L4) が自動生成した Daemon Core の運用知識
generated_by: coo-optimizer
last_updated: 2026-03-14T02:21:49.230Z
---

# Daemon Core Operating Insights

**COO 自己強化学習ループ（L4）** によって自動生成・更新されるスキルシート。
Daemon Core の実績データから学習した最適運用パラメータを記録する。

## 実績サマリー

| 指標 | 値 |
|------|-----|
| 総タスク数 | 100 |
| 成功率 | 0% |
| 平均 LLM コール数 | 15 |
| Stagnation 発生 | 0 件 |
| Budget 超過 | 1533 件 |

## 推奨 TTL（タスクカテゴリ別）

| カテゴリ | 推奨 TTL |
|----------|---------|
| testing | 900s (15分) |

## エラーホットスポット（注意すべきエラータイプ）

- **write_error**: 29件発生
- **llm_error**: 2件発生

## Quick Wins

- VID BUDDY テロップ区切りロジック修正 (P0+P1+キャッシュ削除)
- VID BUDDY テロップ区切りロジック品質改善
- [Self-Improvement/L3] knowledge/ ディレクトリの 9 件のエピソードを解析し、SKILL.md を更新
