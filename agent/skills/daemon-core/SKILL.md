---
name: Daemon Core Operating Insights
description: COO 自己強化学習ループ (L4) が自動生成した Daemon Core の運用知識
generated_by: coo-optimizer
last_updated: 2026-03-09T10:32:33.467Z
---

# Daemon Core Operating Insights

**COO 自己強化学習ループ（L4）** によって自動生成・更新されるスキルシート。
Daemon Core の実績データから学習した最適運用パラメータを記録する。

## 実績サマリー

| 指標 | 値 |
|------|-----|
| 総タスク数 | 10 |
| 成功率 | 10% |
| 平均 LLM コール数 | 27 |
| Stagnation 発生 | 1 件 |
| Budget 超過 | 2 件 |

## 推奨 TTL（タスクカテゴリ別）

| カテゴリ | 推奨 TTL |
|----------|---------|
| general | 2s (0分) |
| testing | 344s (6分) |
| implementation | 4s (0分) |

## エラーホットスポット（注意すべきエラータイプ）

- **command_error**: 4件発生
- **parse_error**: 1件発生
- **write_intercepted**: 1件発生

## Quick Wins（低コストで成功するタスクパターン）

- "e2e-demo/math.js の add 関数の 'return a - b' を 'return a + b' に、multiply 関数の 'retur" (1 loops, 1 calls)

## COO への推奨事項



💡 平均 LLM コールが多い。ReAct プロンプトのアクション精度を上げると効率化できます。

