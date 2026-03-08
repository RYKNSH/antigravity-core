---
name: test-quality-engine
description: テスト品質を6次元で定量スコアリングするエンジン。/test-evolve Phase 4 で使用。
source: Antigravity-core (custom)
---

# Test Quality Engine

テスト品質を定量的に評価し、改善優先順位を決定するスキル。

## アプローチ

テスト品質は**6つの独立した次元**で計測する。各次元を0-100でスコアリングし、重み付き平均で総合スコアを算出。

## 6次元スコアリング

### 1. Assertion Density（アサーション密度）
**計測**: テストケースあたりの `expect()` / `assert` 出現数

```bash
# expect数
EXPECT_COUNT=$(grep -rn "expect(" --include="*.test.*" --include="*.spec.*" . | grep -v node_modules | wc -l)

# テストケース数
TEST_COUNT=$(grep -rn "it(\|test(" --include="*.test.*" --include="*.spec.*" . | grep -v node_modules | wc -l)

# 密度
echo "Assertion Density: $(echo "scale=1; $EXPECT_COUNT / $TEST_COUNT" | bc)"
```

| スコア範囲 | 密度 | 判定 |
|-----------|------|------|
| 90-100 | ≥ 3.0 | 各テストが複数の振る舞いを確実に検証 |
| 70-89 | 2.0-2.9 | 適切 |
| 40-69 | 1.0-1.9 | 最低限 |
| 0-39 | < 1.0 | テストが何も検証していない可能性 |

**注意**: 密度が高すぎる場合（≥ 5.0）はテスト分割を推奨。

---

### 2. Mock Purity（モック純度）
**計測**: モック使用数 / テストケース数

```bash
# モック数
MOCK_COUNT=$(grep -rn "mock(\|jest.fn(\|vi.fn(\|sinon\.\|stub(" --include="*.test.*" --include="*.spec.*" . | grep -v node_modules | wc -l)

# 比率
echo "Mock Ratio: $(echo "scale=2; $MOCK_COUNT / $TEST_COUNT" | bc)"
```

| スコア範囲 | Mock比率 | 判定 |
|-----------|---------|------|
| 90-100 | ≤ 0.5 | テストが実コードを十分に実行 |
| 70-89 | 0.5-1.0 | 適切な範囲 |
| 40-69 | 1.0-2.0 | モック過多。偽の安心感のリスク |
| 0-39 | > 2.0 | テストがモックをテストしている状態 |

> [!WARNING]
> Mock比率が高い = 「テストが通る」≠「コードが正しい」。
> 統合テストの追加を優先推奨。

---

### 3. Edge Coverage（エッジカバレッジ）
**計測**: エッジケーステストの割合

```bash
# エッジケーステスト検出（テスト名から推定）
EDGE_COUNT=$(grep -rn "null\|undefined\|empty\|zero\|negative\|boundary\|edge\|invalid\|error\|fail\|throw\|reject\|timeout\|overflow\|NaN\|Infinity" \
  --include="*.test.*" --include="*.spec.*" . | grep -v node_modules | \
  grep -c "it(\|test(\|describe(")

echo "Edge Coverage: $(echo "scale=1; $EDGE_COUNT * 100 / $TEST_COUNT" | bc)%"
```

| スコア範囲 | エッジ率 | 判定 |
|-----------|---------|------|
| 90-100 | ≥ 30% | 防御的。主要エッジケースを網羅 |
| 70-89 | 20-29% | 良好 |
| 40-69 | 10-19% | ハッピーパス偏重 |
| 0-39 | < 10% | エッジケース盲目 |

---

### 4. Determinism（決定性）
**計測**: 非決定的要素を含むテスト数

```bash
# 非決定的パターン検出
NONDET_COUNT=$(grep -rn "Date.now\|new Date()\|Math.random\|setTimeout\|setInterval\|process.hrtime" \
  --include="*.test.*" --include="*.spec.*" . | grep -v node_modules | \
  grep -v "mock\|fake\|stub\|vi.useFakeTimers\|jest.useFakeTimers" | wc -l)

echo "Non-deterministic patterns: $NONDET_COUNT"
```

| スコア範囲 | 非決定的数 | 判定 |
|-----------|-----------|------|
| 100 | 0 | 完全決定的 |
| 70-99 | 1-3 | 軽微なリスク |
| 30-69 | 4-10 | フレーキーテストの温床 |
| 0-29 | > 10 | CI/CDが信頼できない |

---

### 5. Isolation（独立性）
**計測**: テスト間の共有状態・順序依存の検出

```bash
# グローバル状態変更の検出
SHARED_STATE=$(grep -rn "beforeAll\|global\.\|process\.env\.\|localStorage\.\|sessionStorage\." \
  --include="*.test.*" --include="*.spec.*" . | grep -v node_modules | wc -l)

echo "Shared state patterns: $SHARED_STATE"
```

| スコア範囲 | 共有状態数 | 判定 |
|-----------|-----------|------|
| 100 | 0 | 完全独立。並列実行可能 |
| 70-99 | 1-5 | 許容範囲（beforeAll が setup用途なら可） |
| 30-69 | 6-15 | 順序依存リスク |
| 0-29 | > 15 | テスト並列化不可能 |

---

### 6. Speed（速度プロファイル）
**計測**: テスト実行時間

```bash
# テスト実行時間計測
time pnpm test 2>&1 | tail -5
```

| スコア範囲 | 実行時間 | 判定 |
|-----------|---------|------|
| 90-100 | ≤ 10s | 超高速。TDD体験が最高 |
| 70-89 | 10-30s | 良好。TDD可能 |
| 40-69 | 30-60s | CI/CDボトルネック予備軍 |
| 0-39 | > 60s | TDD不可能。分割を推奨 |

---

## 総合スコア算出

### 重み配分

| 次元 | 重み | 理由 |
|------|------|------|
| Assertion Density | 20% | テストの本質（検証）の品質 |
| Mock Purity | 15% | テストの信頼性 |
| Edge Coverage | 25% | 最も多くのバグを防ぐ |
| Determinism | 15% | CI/CDの信頼性 |
| Isolation | 15% | テストのスケーラビリティ |
| Speed | 10% | 開発者体験 |

### 算出式

```
Total = AD × 0.20 + MP × 0.15 + EC × 0.25 + DT × 0.15 + IS × 0.15 + SP × 0.10
```

### グレード

| Grade | スコア | 意味 |
|-------|--------|------|
| **S** | 95-100 | テストがコードより堅牢 |
| **A** | 85-94 | 本番レベルの信頼性 |
| **B** | 70-84 | 良好。改善余地あり |
| **C** | 50-69 | 要改善 |
| **D** | 0-49 | テストが信頼できない |

---

## 出力フォーマット

```markdown
# 🧪 Test Quality Score Card

**Project**: [プロジェクト名]
**Date**: [日時]
**Grade**: [S/A/B/C/D] ([スコア]/100)

| 次元 | Raw | Score | Weight | Weighted |
|------|-----|-------|--------|----------|
| Assertion Density | 2.3 | 75 | 20% | 15.0 |
| Mock Purity | 0.8 | 85 | 15% | 12.8 |
| Edge Coverage | 22% | 75 | 25% | 18.8 |
| Determinism | 0 | 100 | 15% | 15.0 |
| Isolation | 2 | 90 | 15% | 13.5 |
| Speed | 18s | 80 | 10% | 8.0 |
| **Total** | | | | **83.0** |

## Improvement Priorities
1. 🔴 Edge Coverage: 境界値テスト追加 (impact: +8)
2. 🟡 Assertion Density: expect追加 (impact: +3)
3. 🔵 Speed: 遅いテスト分割 (impact: +2)

## Trend
| Date | Grade | Score | Δ |
|------|-------|-------|---|
| 2026-02-20 | B | 72 | — |
| 2026-02-22 | B+ | 83 | +11 |
```

---

## ベストプラクティス

- スコアリングは**絶対値ではなく推移**で判断する（B→A- は S よりも良い成果）
- プロジェクトの性質によって重み配分を調整可能
- 6次元全てを改善しようとせず、**最もインパクトの大きい1-2次元に集中**する
- スコアカードは `.test_evolution_patterns.md` に履歴として蓄積する

---

## Toolchain

**Scripts**: None
**Knowledge**: None
**Related WF**: None
