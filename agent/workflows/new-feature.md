---
description: 新機能を開発する際の標準ワークフロー
---

# 新機能開発ワークフロー

## Cross-Reference

```
/work "新機能" → /spec → /new-feature → /verify → /ship
/go → /work → /new-feature → /verify
```

> [!IMPORTANT]
> Claude Code 公式推奨: **探索 → 計画 → 実装 → コミット** の順序を厳守

## フェーズ概要

| Phase | 内容 | ブロッカー |
|-------|------|-----------|
| 🔍 **探索** | Step 1-2: 理想系定義、First Principles分析 | - |
| 📝 **計画** | Step 3-5: 設計、ADR、テスト戦略 | -（破壊的操作時のみ確認） |
| 🛠️ **実装** | Step 6-8: コーディング、レビュー、品質ゲート | - |
| 🚀 **コミット** | Step 9-10: デプロイ、振り返り | - |

## 前提条件
- 機能要件が明確であること
- ユーザーストーリーが定義されていること

---

## 🔍 探索フェーズ

> 🧠 **THINK GATE — 計画フェーズ**: `WORKFLOW_CONTRACTS.md` の Core Engagement Matrix を参照。
> Small: H | Medium: H + T(quick) + N(quick) | Large: H + T + N(deep) + I

### 1. 理想系の定義
**目的**: 制約を無視した理想の状態を明確にする

```markdown
以下を定義してください：
1. この機能が完璧に動作したら、ユーザーはどのような体験をするか
2. 技術的な制約がなければ、どのように実装するか
3. この機能の成功をどのように測定するか
```

**出力**: `docs/IDEAL_STATE.md` に追記

---

### 2. First Principles 分析
**目的**: 既存のパターンに囚われず、本質的な解決策を導出する

```markdown
以下を問う：
1. なぜこの機能が必要か？（5-Why）
2. この機能なしで問題を解決する方法はないか？
3. もっとシンプルな解決策はないか？
```

---

## 📝 計画フェーズ

> 🧠 **THINK GATE — 設計フェーズ**: `WORKFLOW_CONTRACTS.md` の Core Engagement Matrix を参照。
> Medium: N(quick) | Large: N(deep) + I

### 3. 設計とADR作成
**目的**: アーキテクチャ決定を文書化し、レビューを受ける

```markdown
以下を作成してください：
1. 設計オプションの列挙
2. 選択したオプションと理由
3. ADR（Architecture Decision Record）
```

**出力**: `docs/DECISIONS.md` に追記

---

### 4. 自己レビューとセキュリティゲート
**目的**: 実装前に設計の妥当性を検証し、破壊的変更がないか確認する

#### AI-Driven 自己レビュー
`/debate quick` を実行し、以下のポイントを検証する：
1. 理想系の定義と設計オプションは整合しているか
2. First Principles に反していないか
3. AI-Driven Principle に反する妥協がないか

#### Security Gate（ユーザー確認）
**以下の破壊的操作・高リスク操作が含まれる場合のみ**ユーザーに承認を求める。それ以外は即実装に進む。
- DB schema変更（マイグレーション）
- 決済・認証ロジックの破壊的変更
- production環境へのデプロイ（別WF）

---

### 5. テスト戦略の策定
**目的**: 実装前にテスト戦略を決定する（TDD）

#### Step 5-0: 過去パターン参照（テスト進化ループ入口）

テスト設計前に過去の学習データを読み込む:
1. **`.test_evolution_patterns.md`**（プロジェクト単位）が存在すれば読む
2. **`~/.antigravity/knowledge/test_evolution_patterns/`**（グローバル）を検索
3. 過去に発見されたテスト盲点パターンを事前にチェックリストに含める

> これにより「同じテスト盲点を繰り返さない」強化学習がテスト設計時点で機能する。

```markdown
以下を定義してください：
1. ユニットテストの対象
2. 統合テストの対象
3. E2Eテストの対象
4. エッジケースのリスト（過去パターンからの重点項目含む）
5. 過去のテスト盲点パターンへの対策（`.test_evolution_patterns.md` 参照）
```

---

## 🛠️ 実装フェーズ

### 6. 実装
// turbo
**目的**: 設計に基づいて実装を進める

```bash
# 開発サーバー起動
pnpm dev

# テスト監視モード
pnpm test:watch
```

**注意事項**:
- TDD: テストを先に書く
- 小さなコミット: 変更は小さく、頻繁にコミット
- PRは小さく: 1つのPRで1つの機能

---

### 7. コードレビュー
**目的**: 品質を担保し、知識を共有する

---

### 8. 品質ゲート通過
// turbo
**目的**: すべての品質基準をクリアする

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

---

## 🚀 コミットフェーズ

### 9. デプロイ
**目的**: 変更を本番環境に反映する

**参照**: `/deploy` ワークフロー

---

### 10. 振り返り
**目的**: 学びを文書化し、プロセスを改善する

```markdown
振り返りポイント：
1. うまくいったこと
2. 改善すべきこと
3. 次回に活かす学び
```

**出力**: ボトルネックがあれば `docs/BOTTLENECK.md` に記録

---

### 11. 統合検証（自動）

> 🧠 **THINK GATE — 検証フェーズ**: `WORKFLOW_CONTRACTS.md` の Core Engagement Matrix を参照。
> Small: K(参照) | Medium: K + N(quick) | Large: K + N(deep) + T

> [!IMPORTANT]
> **`/go` 経由時**: `/go` Phase 4 の Smart Verify（規模連動）に検証を委譲する。
> このステップでは `/verify` を**呼び出さない**（二重実行防止）。
> **直接呼び出し時のみ**: `/verify`（規模自動判定）を実行する。

| 呼び出し元 | 検証方法 |
|-----------|---------|
| `/go` 経由 | → `/go` Phase 4 に委譲（規模連動: quick/standard/deep） |
| 直接呼び出し | → `/verify`（規模自動判定 — `--quick` 固定しない） |

- テスト全パス → `/ship` 可能
- テスト失敗 → Step 6 に戻って修正
