---
name: Daemon Core Operating Insights
description: COO 自己強化学習ループ (L4) が自動生成した Daemon Core の運用知識
generated_by: coo-optimizer
last_updated: 2026-03-10T14:18:49.555Z
---

# Daemon Core Operating Insights

**COO 自己強化学習ループ（L4）** によって自動生成・更新されるスキルシート。
Daemon Core の実績データから学習した最適運用パラメータを記録する。

## 実績サマリー

| 指標 | 値 |
|------|-----|
| 総タスク数 | 25 |
| 成功率 | 0% |
| 平均 LLM コール数 | 18 |
| Stagnation 発生 | 0 件 |
| Budget 超過 | 25 件 |

## 推奨 TTL（タスクカテゴリ別）

| カテゴリ | 推奨 TTL |
|----------|---------|
| general | 900s (15分) |
| testing | 900s (15分) |

## エラーホットスポット（注意すべきエラータイプ）

- データなし（タスク蓄積後に更新されます）

## Quick Wins

## knowledge/ の最新エピソード (21件中3件):
- 2026-03-09_VID_BUDDY________________P0_P1__________.md: # Knowledge: VID BUDDY テロップ区切りロジック修正 (P0+P1+キャッシュ削除)  ## 実行内容  ### P0: キャッシュ削除 /Users/ryotarokonishi/Desktop/AntigravityWork/VID BUDDY/test_work/extraction/telop_chunks.json を削除する  ### P1a: extractors
- 2026-03-09_VID_BUDDY____________________________ext.md: # Knowledge: VID BUDDY テロップ区切りロジック品質改善  ## 重要制約 - extractors.py は 963行ある大型ファイル。**chunk_telops 関数のみを修正せよ** - 他の関数(transcribe, detect_silences等)には一切触れるな - write_file で書く際は必ず既存ファイルの全行を読んで特定箇所だけ書き換える  ## 
- 2026-03-09__Self_Improvement_L3__knowledge_________.md: # Knowledge: [Self-Improvement/L3] knowledge/ ディレクトリの 9 件のエピソードを解��し、 /Users/ryotarokonishi/.antigravity/agent/skills/daemon-core/SKILL.md を更新せよ。  ## 現在のSKILL.md内容: --- name: Daemon Core Operating Insi