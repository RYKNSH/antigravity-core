# Test Evolution Patterns - Global Knowledge Base

テスト改善パターンのグローバルナレッジ。プロジェクト横断で共通するテスト盲点パターンを蓄積。

## 参照元

- `/test-evolve` Phase 0 (入口): 重点チェック領域の決定に使用
- `/test-evolve` Phase 6 (出口): 新パターンの蓄積・既存パターンの更新
- `/new-feature` Step 5-0: テスト戦略策定時の参照
- `/bug-fix` Step 10: バグ振り返りからのテスト盲点蓄積
- `world-class-test-patterns` スキル: テスト設計テンプレートの参照元

## Principles（Ada CoreAPI 実証済み — 初期蓄積）

### TE-001: 入力ゲートは3段階分類（Safe/Flagged/Blocked）で設計する
- **根因**: 2値分類（通す/拒否）では安全な入力の誤検知が頻発する
- **適用スコープ**: 外部入力を受ける全API
- **発見頻度**: 3
- **ステータス**: active
- **初出**: 2026-02-21 Ada test_sentinel.py
- **Evidence**: Ada sentinel_node の flag レベル設計

### TE-002: 攻撃テストは必ず「安全な入力が通ること」のテストとセットで書く
- **根因**: 攻撃パターンの追加に注力するあまり、正常入力の誤検知テストを忘れる
- **適用スコープ**: Adversarial Testing (L1), Security Gate (L6)
- **発見頻度**: 5
- **ステータス**: active
- **初出**: 2026-02-21 Ada test_adversarial.py
- **Evidence**: TestHarmfulContentAdversarial.test_security_discussion_safe, test_code_review_safe

### TE-003: Integration テストではノード間の出力キー衝突を明示的に検証する
- **根因**: 各ノードが独立開発され、偶然の出力キー重複が実行時エラーを引き起こす
- **適用スコープ**: パイプライン/ノードベースアーキテクチャ
- **発見頻度**: 2
- **ステータス**: active
- **初出**: 2026-02-21 Ada test_integration.py
- **Evidence**: TestFullPipelineStateConsistency.test_no_state_key_collisions

### TE-004: Performance テストは「平均」と「最大」の両方を閾値チェックする
- **根因**: 平均値が閾値内でも外れ値が UX を破壊する場合がある
- **適用スコープ**: レイテンシクリティカルな全コンポーネント
- **発見頻度**: 2
- **ステータス**: active
- **初出**: 2026-02-21 Ada test_performance.py
- **Evidence**: _measure_node 関数の avg/max 返却設計

### TE-005: 安定性テストは100反復で結果の一貫性を検証する
- **根因**: 非決定的な処理（正規表現マッチング順序等）が稀にフレーキーテストを生む
- **適用スコープ**: 全コンポーネント
- **発見頻度**: 1
- **ステータス**: active
- **初出**: 2026-02-21 Ada test_performance.py
- **Evidence**: TestStabilityUnderLoad.test_sentinel_100_iterations

### TE-006: E2Eテストではモックを使わず全レイヤーを実際に通す
- **根因**: モック統合テストでは契約違反を検出できない
- **適用スコープ**: パイプライン全体テスト (L4)
- **発見頻度**: 3
- **ステータス**: active
- **初出**: 2026-02-21 Ada test_lifecycle.py
- **Evidence**: TestScribe.test_full_lifecycle_e2e

### TE-007: 自律進化ループのテストはフィードバック蓄積→分析→進化のフルサイクルで検証する
- **根因**: 個別コンポーネントテストだけではループの統合性を保証できない
- **適用スコープ**: Evolution/Feedback Systems (L5)
- **発見頻度**: 1
- **ステータス**: active
- **初出**: 2026-02-21 Ada test_evolution.py
- **Evidence**: TestEvolutionE2E.test_full_evolution_pipeline

## パターン一覧

| ID | パターン名 | 適用スコープ | ステータス |
|----|-----------|-------------|----------|
| TE-001 | 3段階入力分類 | 外部API全般 | active |
| TE-002 | 攻撃+安全テストのペア | Adversarial/Security | active |
| TE-003 | 出力キー衝突検証 | パイプラインアーキテクチャ | active |
| TE-004 | 平均+最大値閾値 | Performance | active |
| TE-005 | 100反復安定性 | 全コンポーネント | active |
| TE-006 | モックなしE2E | パイプライン全体 | active |
| TE-007 | フルサイクル進化テスト | Evolution/Feedback | active |

## 関連ナレッジ

- `debug_patterns/` — デバッグパターン
- `.test_evolution_patterns.md` — プロジェクト単位のテスト改善パターン
- `world-class-test-patterns` スキル — テスト設計テンプレート集
