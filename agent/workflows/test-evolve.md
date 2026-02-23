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
# テストファイル一覧
find . -name "*.test.*" -o -name "*.spec.*" | grep -v node_modules | sort

# テストケース数の概算
grep -rn "it(\|test(\|describe(" --include="*.test.*" --include="*.spec.*" . | grep -v node_modules | wc -l

# テスト対象外モジュールの検出（src内でテストのないファイル）
comm -23 \
  <(find src -name "*.ts" -o -name "*.tsx" | sed 's/\.tsx\?$//' | sort -u) \
  <(find . -name "*.test.*" -o -name "*.spec.*" | grep -v node_modules | sed 's/\.test\.\|\.spec\./\./' | sed 's/\.\(ts\|tsx\|js\|jsx\)$//' | sort -u) 2>/dev/null
```

---

### Phase 1: Mutation Testing（変異テスト） 🧬
**担当**: Mutation Engineer
**目的**: コードを意図的に壊して、テストがそれを検出できるか検証する

> [!IMPORTANT]
> ミュータント生存 = テストに穴がある。ミュータント殺傷率がテストの真の品質指標。

#### 変異パターン（手動ミューテーション）

テストツールに依存せず、AIが直接変異を適用・検証する:

```markdown
変異オペレータ:
1. **条件反転**: `if (x > 0)` → `if (x <= 0)`
2. **境界値シフト**: `if (x >= 10)` → `if (x >= 11)`
3. **演算子置換**: `a + b` → `a - b`
4. **戻り値変更**: `return true` → `return false`
5. **null注入**: `return data` → `return null`
6. **例外削除**: try/catch 内の throw を削除
7. **ループ境界**: `i < n` → `i < n-1`
8. **デフォルト値変更**: `count = 0` → `count = 1`
```

#### 実行手順

1. Phase 0 で特定した**最重要モジュール**上位5つを選定
2. 各モジュールに対して上記変異を**1つずつ適用**
3. テストを実行し、**検出されたか（殺傷）/ 検出されなかったか（生存）**を記録
4. 変異適用後は**必ず元に戻す**

```markdown
## Mutation Report

| モジュール | 変異 | 結果 | テスト名 |
|-----------|------|------|---------|
| auth.ts:42 | 条件反転 | 🔴 生存 | — (検出テストなし) |
| auth.ts:42 | 条件反転 | 🟢 殺傷 | should reject invalid token |

ミュータント殺傷率: X/Y (Z%)
```

**目標**: 殺傷率 80% 以上。60%未満は `critical`。

---

### Phase 2: Adversarial Analysis（敵対的分析） 🗡️
**担当**: Adversarial Hacker
**目的**: 攻撃者の思考で「テストを通過するバグ」を設計し、テストの盲点を暴く

#### Step 2-1: 攻撃シナリオ設計

各機能モジュールに対して以下を問う:

```markdown
攻撃者思考:
1. 「このテストスイートを通過しつつ、ユーザーに被害を与えるバグ」を3つ設計せよ
2. 「テストには見えない副作用」を引き起こす変更を設計せよ
3. 「テストの前提条件を迂回する」入力パターンを特定せよ
```

#### Step 2-2: 攻撃実行

設計したバグを実際にコードに注入し、テストが検出できるか検証:

```markdown
## Adversarial Report

| 攻撃 | テスト結果 | 危険度 |
|------|-----------|--------|
| SQLインジェクションパターン | 🔴 未検出 | critical |
| 大量データ投入 (10万件) | 🟡 タイムアウトのみ | warning |
| 空文字列+特殊文字混在 | 🟢 検出済み | — |
```

#### Step 2-3: セキュリティ重点チェック

```markdown
- [ ] 認証バイパス: トークン改竄/期限切れトークンの再利用
- [ ] 権限昇格: 一般ユーザーが管理者APIを呼べるか
- [ ] データ漏洩: 他ユーザーのデータが取得可能か
- [ ] インジェクション: SQL/NoSQL/Command/XSS のテスト有無
- [ ] レースコンディション: 並行リクエストでの不整合
- [ ] リソース枯渇: メモリリーク/接続リーク/ファイルディスクリプタ
```

---

### Phase 3: Coverage Gap Analysis（カバレッジギャップ分析） 🔭
**担当**: Coverage Astronomer
**目的**: テストされていない暗黒領域を精密に特定する

#### チェックリスト

```markdown
## ブランチカバレッジ
- [ ] if/else の else 側がテストされているか
- [ ] switch の default ケースがテストされているか
- [ ] 三項演算子の両方の値がテストされているか
- [ ] 短絡評価 (&&, ||) の両パスがテストされているか

## エラーパスカバレッジ
- [ ] try/catch の catch パスがテストされているか
- [ ] Promise.reject / throw のハンドリングがテストされているか
- [ ] HTTP 4xx/5xx レスポンスのハンドリングがテストされているか
- [ ] タイムアウト/ネットワークエラーのハンドリングがテストされているか

## 境界値カバレッジ
- [ ] 空配列 [] / 空オブジェクト {} / null / undefined
- [ ] 文字列: 空文字 "" / 最大長 / Unicode / 特殊文字
- [ ] 数値: 0 / -1 / MAX_SAFE_INTEGER / NaN / Infinity
- [ ] 日付: 境界日時 / タイムゾーン / うるう年

## 状態遷移カバレッジ
- [ ] 全状態遷移パスがテストされているか
- [ ] 不正な状態遷移（allowed外）が拒否されるか
- [ ] 並行状態遷移（レースコンディション）

## データフローカバレッジ
- [ ] 入力 → 処理 → 出力 の全パス
- [ ] データ変換の各ステップ
- [ ] キャッシュ有/無 の両パターン
```

#### 実行
```bash
# カバレッジレポート生成（ツールがある場合）
npx vitest --coverage --reporter=json 2>/dev/null || \
npx jest --coverage --json 2>/dev/null || \
npx c8 report --reporter=json 2>/dev/null || \
echo "Coverage tool not configured"
```

#### ギャップの Severity 分類

| Severity | 条件 |
|----------|------|
| 🔴 **critical** | 認証・決済・データ操作のテスト欠如 |
| 🟡 **warning** | ビジネスロジックのエラーパス未テスト |
| 🔵 **info** | ユーティリティ関数の境界値未テスト |

---

### Phase 4: Test Quality Scoring（品質スコアリング） ⚖️
**担当**: Quality Scorer
**目的**: テスト品質を定量的にスコアリングし、改善の優先順位を決定する

> `test-quality-engine` スキルを使用。

#### 6次元スコアリング

| 次元 | 定義 | 計測方法 | 合格ライン |
|------|------|---------|-----------|
| **Assertion Density** | テストあたりのアサーション数 | `expect(` の出現数 / テストケース数 | ≥ 2.0 |
| **Mock Purity** | モック vs 実コードの比率 | `mock(` `jest.fn(` 数 / テストケース数 | ≤ 1.5 |
| **Edge Coverage** | エッジケーステストの割合 | null/空/境界テスト数 / 全テスト数 | ≥ 20% |
| **Determinism** | 非決定的要素の排除度 | Date.now/Math.random/setTimeout 依存テスト数 | = 0 |
| **Isolation** | テスト間独立性 | 共有状態・順序依存の検出 | = 0 |
| **Speed** | テスト実行速度 | 全テスト実行時間 | ≤ 30s (unit) |

#### スコア算出
```markdown
## Test Quality Score Card

| 次元 | スコア | 判定 | 詳細 |
|------|--------|------|------|
| Assertion Density | 2.3 | 🟢 | テストあたり平均2.3アサーション |
| Mock Purity | 0.8 | 🟢 | モック使用は適切 |
| Edge Coverage | 12% | 🔴 | エッジケーステスト不足 |
| Determinism | 2 | 🟡 | Date.now依存テスト2件 |
| Isolation | 0 | 🟢 | テスト間依存なし |
| Speed | 45s | 🟡 | 30s超過 |

**総合スコア**: B+ (72/100)
**前回比**: +8 (前回 64/100)
```

#### 総合スコア判定

| Grade | スコア | 意味 |
|-------|--------|------|
| **S** | 95-100 | 世界最高水準。ミューテーション殺傷率90%+ |
| **A** | 85-94 | 優秀。実運用レベルの信頼性 |
| **B** | 70-84 | 良好。改善余地あり |
| **C** | 50-69 | 要改善。重大なギャップあり |
| **D** | 0-49 | 危険。テストが信頼できない |

---

### Phase 5: Evolution Execution（進化実行） 🛠️
**担当**: Evolution Executor
**目的**: Phase 0-4 で発見したギャップに基づき、テストを自律的に改善する

#### 優先順位

```
1. critical ギャップの解消（Phase 1-3 の 🔴）
2. Mutation 生存ミュータントのテスト追加（Phase 1）
3. Adversarial 未検出攻撃のテスト追加（Phase 2）
4. エッジケーステストの追加（Phase 3）
5. 非決定的テストの修正（Phase 4）
6. テスト速度改善（Phase 4）
```

#### 実行ルール

- テスト追加後は**必ず全テスト実行**で回帰確認
- 新テストは**既存テストファイルの構造に合わせる**（新規ファイル作成は最小限）
- テスト名は`should [期待動作] when [条件]` フォーマット
- テスト設計は **`world-class-test-patterns` スキルのテンプレート**に従う（L0-L6）
- Adversarial テスト追加時は必ず**Safe入力テストとペアで書く**（TE-002）

#### Self-Repair Loop

Phase 5 で追加したテストが既存テストを壊した場合:

```
発見 → 分析 → 修正 → 全テスト再実行 → 再判定
```

**セーフティ機構**:
- ループ: **プログレッシブ拡張**（3回→/debug-deep→5回→First Principles→5回 = 最大13回）
- 3回失敗 → `/debug-deep` に自動エスカレーション
- 各修正前に `git add -A && git commit -m "test-evolve: checkpoint"`

---

### Phase 6: Reinforcement Learning（強化学習） 🧠

**発動条件**: 常に実行（quick含む）
**目的**: テスト改善パターンを抽象化し、次回以降の品質向上を加速する

#### 6-1. スコア記録

```markdown
## Test Evolution History

### [日時] [プロジェクト名]
- **総合スコア**: B+ → A- (+5)
- **殺傷率**: 65% → 82% (+17%)
- **追加テスト数**: 12
- **修正テスト数**: 3
- **発見した盲点**: [カテゴリ]
```

#### 6-2. パターン昇華（具象→抽象）

Phase 1-3 で発見した盲点を以下の3問で抽象化:

```markdown
1. **パターン化**: この盲点は他のプロジェクトでも起き得るか？
   → Yes → Principle として記録
   → No → Evidence としてのみ記録

2. **根因分類**: なぜこのテストが書かれていなかったか？
   - [ ] 開発者がエッジケースを想像できなかった
   - [ ] テスト対象の仕様が曖昧だった
   - [ ] テスト困難な設計になっていた（DI不足等）
   - [ ] AI-Driven Principleに反する省略がないか

3. **原則化**: 一文で防止ルールを書けるか？
   → 書けたら Principle として記録
```

#### 6-3. プロジェクト単位: `.test_evolution_patterns.md`

```markdown
## Principles

### TE-001: 認証系はトークン改竄テストを必須とする
- **根因**: 開発者がエッジケースを想像できなかった
- **適用スコープ**: JWT認証, セッション管理
- **発見頻度**: 2
- **ステータス**: active
- **初出**: 2026-02-22 /test-evolve
- **Evidence**: auth.test.ts, middleware.test.ts
```

#### 6-4. グローバル: `~/.antigravity/knowledge/test_evolution_patterns/`

Principleがプロジェクト固有でない場合、グローバルにも保存:

```
~/.antigravity/knowledge/test_evolution_patterns/
├── auth_token_tampering_tests.md
├── async_error_propagation_tests.md
├── boundary_value_checklist.md
└── INDEX.md
```

> `/error-sweep` と `/debug-deep` の学習と**同じナレッジプールの隣接領域**に蓄積。

#### 6-5. 淘汰メカニズム

| 条件 | アクション |
|------|----------|
| `発見頻度 = 0`（5回以上参照で検出0） | → `deprecated` 候補 |
| 2つの Principle が実質同じ | → `merged`（統合） |
| プロジェクト固有 → 汎用化確認 | → グローバル昇格 |

#### 6-6. 学習ループの完成

```
Phase 0 (入口): .test_evolution_patterns.md 読込
     │           Priority順で重点チェック領域を決定
     ↓
Phase 1-3: 検出（重点パターンに従って精度向上）
     ↓
Phase 4: スコアリング（前回比で改善を定量化）
     ↓
Phase 5: 進化実行（テスト追加・改善）
     ↓
Phase 6 (出口): 具象→抽象 → .test_evolution_patterns.md 追記
     │           スコア推移記録 + 淘汰判定
     ↓
次回 Phase 0 で自動参照 → 重点領域の最適化 + 不要原則の淘汰
```

**これにより「テストの盲点が原則になり、原則がテスト設計を強化し、不要な原則が自然淘汰される」テスト進化ループが成立する。**

---

## `/test-evolve scoring` フロー

最軽量版。全コミットで品質スコアを計測・記録する。修正は行わない。

1. **Phase 4**: Test Quality Scoring（6次元スコアリング）
2. **品質History記録**: `.test_quality_history.md` に追記

所要時間目安: 1-2分

---

## `/test-evolve quick` フロー

Standard verify用。カバレッジ分析+スコアリング+学習。

1. **Phase 0**: Test Inventory（Step 0-0 パターン参照 + テスト分布確認）
2. **Phase 3**: Coverage Gap Analysis（ブランチ/エッジカバレッジ精査）
3. **Phase 4**: Test Quality Scoring（6次元スコアリング）
4. **Phase 6**: Reinforcement Learning（スコア記録 + 品質History記録）

所要時間目安: 5-10分

---

## `/test-evolve standard` フロー

Deep verify用。quick + ミューテーションテスト + テスト進化実行。

1. **Phase 0**: Test Inventory
2. **Phase 1**: Mutation Testing（変異テスト — テストが本当にバグを検出できるか検証）
3. **Phase 3**: Coverage Gap Analysis
4. **Phase 4**: Test Quality Scoring
5. **Phase 5**: Evolution Execution（テスト追加・改善実行）
6. **Phase 6**: Reinforcement Learning（スコア記録 + パターン昇華 + 品質History記録）

所要時間目安: 10-20分

---

## `/test-evolve adversarial` フロー

攻撃者視点特化版。セキュリティ重視の場面で使用。

1. **Phase 0**: Test Inventory（テスト分布確認）
2. **Phase 1**: Mutation Testing（変異テスト）
3. **Phase 2**: Adversarial Analysis（敵対的分析）
4. **Phase 6**: Reinforcement Learning

所要時間目安: 15-25分

---

## 発動条件まとめ

| トリガー | 発動元 | モード |
|---------|--------|--------|
| `/verify Quick`（全コミット） | 自動 | `scoring` |
| `/verify Standard` (Risk ≥ 2) | 自動 | `quick` |
| `/verify Deep` (Risk = 3) | 自動 | `standard` |
| `/fbl deep` Phase 5.75 | 自動 | `quick` |
| `/ship` Phase 1（強制Deep） | 自動 | `standard` |
| Auto-Escalation（B未満3連続） | 自動 | `standard` |
| MS完了時 品質ゲート | 自動 | `full` |
| 直接呼出し `/test-evolve` | 手動 | `full` |
| `/test-evolve adversarial` | 手動 | `adversarial` |

> [!NOTE]
> **AI-Driven前提**: リソース制約なし。全コミットでscoring、Standard以上でquick以上、Deepでミューテーション含むstandardが実行される。

---

## 品質Historyトレンド記録

全モードでPhase 4実行後、`.test_quality_history.md` に自動追記:

```markdown
# .test_quality_history.md
# コミットごとの品質History。Auto-Escalationがこのファイルを読む。

| Date | Commit | Score | Grade | Mode | 変更概要 |
|------|--------|-------|-------|------|----------|
| 2026-02-23 | abc1234 | 87/100 | A | scoring | CSS修正 |
| 2026-02-23 | def5678 | 72/100 | B | quick | API追加 |
| 2026-02-23 | ghi9012 | 58/100 | D | standard | DB schema変更 |
```

> [!IMPORTANT]
> **Auto-Escalation連動**: GradeがB未満（C/D）が3行連続した場合、`/verify` が次回自動的にDeepにエスカレーションする。
> `/checkout` 時にトレンドサマリーを出力する。

---

## 注意事項

> [!IMPORTANT]
> **テストはコードより重要**: テストの品質がコードの品質の上限を決める。
> このWFは「テストをテストする」メタ品質を保証する唯一の仕組み。

> [!CAUTION]
> **自動実行禁止の操作**:
> - 既存テストの削除（非推奨化のみ許可）
> - テストフレームワークの変更
> - CI/CD設定の変更
> - テストデータベースのリセット
