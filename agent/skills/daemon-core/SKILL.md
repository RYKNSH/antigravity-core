---
name: Daemon Core Operating Insights
description: COO 自己強化学習ループ (L4) が自動生成した Daemon Core の運用知識
generated_by: coo-optimizer
last_updated: 2026-03-10T13:14:42.888Z
---

# Daemon Core Operating Insights

**COO 自己強化学習ループ（L4）** によって自動生成・更新されるスキルシート。
Daemon Core の実績データから学習した最適運用パラメータを記録する。

## 実績サマリー

| 指標 | 値 |
|------|-----|
| 総タスク数 | 11 |
| 成功率 | 9% |
| 平均 LLM コール数 | 28 |
| Stagnation 発生 | 0 件 |
| Budget 超過 | 10 件 |

## 推奨 TTL（タスクカテゴリ別）

| カテゴリ | 推奨 TTL |
|----------|---------|
| testing | 900s (15分) |
| general | 900s (15分) |

## エラーホットスポット（注意すべきエラータイプ）

- **parse_error**: 6件発生

## Quick Wins（低コストで成功するタスクパターン）

- "[MS 6.1.8 E2E Demo] /antigravity/docker-core/e2e-demo/buggy-calculator.js のバグを修正" (1 loops, 1 calls)

## COO への推奨事項


⚠️ Budget 超過が多発しています。max_llm_calls の増加、またはタスク細分化を検討してください。
💡 平均 LLM コールが多い。ReAct プロンプトのアクション精度を上げると効率化できます。

