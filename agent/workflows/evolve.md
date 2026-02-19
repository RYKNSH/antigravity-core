---
description: 自律的なシステム進化・改善提案を行うワークフロー
---

# /evolve

システムの利用状況を分析し、改善案を提示します。

## 1. 分析実行

```bash
node ~/.antigravity/agent/scripts/evolve.js
```

## 2. 改善アクション

提示された改善案に基づき、以下のコマンドを使用して対応してください：

- **不要なワークフローの削除**:
  ```bash
  rm ~/.antigravity/agent/workflows/UNUSED_WORKFLOW.md
  # USAGE_TRACKER.md からも削除
  ```

- **高頻度ワークフローの最適化**:
  - ショートカットの作成
  - 処理の並列化（`// turbo` 追加）
  - 無駄なステップの削減

- **新しいパターンの学習**:
  - `/learn_from_blog` を実行してナレッジを更新

## 3. 分析結果の記録

分析結果を `SELF_EVOLUTION.md` の「進化履歴」に追記することを推奨します。
