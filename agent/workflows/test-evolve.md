---
description: テスト自体を進化させる自律型フィードバックループ。テストの品質・カバレッジ・耐障害性を継続的に改善する唯一のWF。
---

# /test-evolve - テスト進化ループ

> [!IMPORTANT]
> **哲学**: 「テストが通る」は品質の証明ではない。
> テストが**壊れたコードを確実に検出できるか**が本当の品質。
> このWFは「テストをテストする」メタ品質を自律的に進化させる。

## Cross-Reference

```
/verify Phase 3 後 → /test-evolve quick（自動。Phase 0 + 3 + 4 のみ）
/fbl deep Phase 5.75 → /test-evolve quick（自動）
/new-feature Step 5 → .test_evolution_patterns.md 参照（Phase 6 の学習データ）
/bug-fix Step 10 → .test_evolution_patterns.md 追記（テスト盲点の記録）
/test-evolve Phase 5 修正3回失敗 → /debug-deep（自動エスカレーション）
直接呼出し → 全Phase実行
```

---

## バリエーション

| コマンド | Phase | 用途 |
|---------|-------|------|
| `/test-evolve scoring` | **4 のみ** | 全コミット品質計測（Quick verify用。記録のみ、修正なし） |
| `/test-evolve quick` | 0 + 3 + 4 + 6 | Standard verify用。カバレッジ+スコア+学習 |
| `/test-evolve standard` | 0 + 1 + 3 + 4 + 5 + 6 | Deep verify用。ミューテーション含む（Adversarial以外全部） |
| `/test-evolve` | 全Phase | ship前/MS完了用。フル実行 |
| `/test-evolve adversarial` | 0 + 1 + 2 | セキュリティ特化 |

---

## Evolve チーム（Specialist Personas）

| ペルソナ | 担当Phase | 専門 |
|---------|-----------|------|
| 📊 **Test Cartographer** | Phase 0 | テスト資産の全量把握・分類 |
| 🧬 **Mutation Engineer** | Phase 1 | コード変異体生成・テスト殺傷力測定 |
| 🗡️ **Adversarial Hacker** | Phase 2 | テストを通過するバグの設計 |
| 🔭 **Coverage Astronomer** | Phase 3 | カバレッジの暗黒領域探索 |
| ⚖️ **Quality Scorer** | Phase 4 | テスト品質の定量評価 |
| 🛠️ **Evolution Executor** | Phase 5 | テスト改善の自律実行 |

---

## 検証フェーズ

### Phase 0: Test Inventory（棚卸し） 📊
**担当**: Test Cartographer
**目的**: 現在のテスト資産を完全に把握し、マッピングする

#### Step 0-0: 過去パターン参照（学習ループ入口）

チェック開始前に、過去の学習データを読み込む:

1. **`.test_evolution_patterns.md`**（プロジェクト単位）が存在すれば読む
2. **`~/.antigravity/knowledge/test_evolution_patterns/`**（グローバル）を検索
3. **`.sweep_patterns.md`** + **`.debug_learnings.md`** からテスト関連の知見を抽出（**クロスポリネーション**）
4. **`world-class-test-patterns`** スキルを参照し、7アーキタイプ（L0-L6）のうち該当するレベルを特定

> Phase 6 の出口データが次回の入口になる。

#### チェックリスト
```markdown
- [ ] テストファイル総数・テストケース総数を計測
- [ ] テスト種別の分布（unit / integration / e2e / performance / security）
- [ ] テスト対象 vs 非テスト対象のモジュール一覧
- [ ] 最も古いテスト（メンテ不足リスク）の特定
- [ ] テストファイルとソースファイルの対応関係マッピング
```

#### 実行
```bash

---

> **詳細テンプレート**: [test-evolve-templates.md](file:////Users/ryotarokonishi/.antigravity/docs/wf-reference/test-evolve-templates.md)
