# Antigravity Core Self-Improving Pipeline — Whitepaper

> **作成日時**: 2026-02-24（v1.0）→ 2026-02-24 Round 7 実装検証で v2.0 に更新 → v2.1 承認ゲート実装完了
> **ディベート**: Round 1-7 完走・戦略ロック済み
> **参照先**: `refine/hang-log-global-correlation/` (round_01〜07)
> **現在地**: MS1.1〜MS4.1 全実装済み。承認ゲート運用フロー実装完了（2026-02-24）

---

## 1. このドキュメントが解決する問題

Antigravityは高度なハング対策（watchdog / `_smart_run`）を持ちながら、
そのハング対策がインシデントを隠蔽し、学習ループを閉じえないという逆説的な構造を持っていた。

**根本命題（Round 3〜6を経て確定）**:

> 「Antigravityの学習ループは、CoreをサーバーサイドCIとして自律運転させることで初めて閉じる。
> ローカルは "消費者"、Coreは "自律進化する知識エンジン" という役割分担が本来の設計ゴールだ。」

---

## 2. ハングの3分類（Round 1で確定）

Antigravityで発生するハングは根本原因で3種類に分類される:

| 分類 | 代表例 | 検知困難度 |
|------|--------|-----------|
| **A: 環境前提ミス型** | SSD未マウントのパスへのアクセス、index.lock残存 | 低（エラーが即時出る） |
| **B: プロセス実行型** | bash -c変数展開ループ、pipe buffer flush待ち、flock未使用の並列書き込み競合 | 中（30秒後にkillされるが原因不明） |
| **C: 外部API依存型** | Notion HTTPSタイムアウト、git push credential prompt待ち、SSH接続詰まり | 高（watchdogが隠蔽し Silent Failure化） |

---

## 3. 学習ループが閉じなかった構造的原因（Round 2〜3）

```
[インシデント発生]
    ↓
[brain_log に記録] ← Core-B（揮発可能・git管理外）
    ↓
[checkin が参照？] ← 最新1件のみ → 過去インシデントが埋もれる
    ↓
[safe-commands.md に反映] ← 手動 or AIの自発的判断に依存
    ↓
[incidents.md に記録] ← 転記トリガーが存在しない
    ↓
[Core-A に git push] ← ここで初めて永続化
```

**詰まり箇所**:
1. brain_log → safe-commands.md の反映が自動ではない
2. 転記トリガーが存在しない（checkout は「閉じる」だけで「学習を固定する」ステップがない）
3. ブラウザSAのインシデントがターミナルルールのスコープ外

---

## 4. watchdogパラドックス（Round 2）

`_smart_run` / watchdog は「ハングを検知してkillする」が、同時に「ハングをサイレントに処理する」。

```
ハング発生
  ↓
_smart_run が30秒後にkill
  ↓
"⚠️ [label] gave up" と表示して次のステップへ
  ↓
AIエージェントは「失敗したが続行した」と認識
  ↓
インシデントとして記録されない → 学習されない
```

watchdogを持つことで、システムは壊れた状態でも動き続けられる。
これが「Silent Failure」を量産し、学習ループを閉じない原因になっていた。

---

## 5. 解決アーキテクチャ（Round 4〜6）

### 全体構造

```
[ローカルセッション]
  実践ハング発生
      ↓
  ハング検出（30秒ルール）
      ↓
  Terminate → 報告（safe-commands.md フェーズ2.5）
      ↓
  brain_log に構造化MDで記録（Core読み取り可能形式）
      ↓
  checkout時にantigravity-private へ自動rsync
      ↓
  git push → antigravity-core（public）

[サーバーサイド Core自律ループ]
  全ユーザーのincidents.md / brain_log変更を受信
      ↓
  AI改善提案エンジン（/evolve のサーバー版）
      ↓
  Issue自動生成（bot: evolve-proposal）
      ↓
  【承認ゲート】/approval-gate WFで人間レビュー
      ↓
  PR作成 → CI: 依存マップ整合性チェック + Chaos層テスト
      ↓
  Pass → main merge
      ↓
[各ローカル]
  checkin時に git pull → 最新Coreを受け取る（既に実装済み）
```

### 全コンポーネント実装済み（2026-02-24 完全完了）

| コンポーネント | 状態 | 実装内容 |
|---|---|---|
| ローカル → Core push | ✅ 実装済み | git push 実装済み |
| Core → ローカル pull | ✅ 実装済み | checkin.md SLOW ZONEで実装済み |
| ハング報告スキーム | ✅ 実装済み | safe-commands.md フェーズ2.5 |
| 依存マップ | ✅ 実装済み | dependency_map.json v1.1.0 |
| brain_log → incidents.md 転記 | ✅ 実装済み | checkin.md全件スキャン |
| brain_log 構造化MD | ✅ 実装済み | MS1.1 INCIDENT_FORMAT.md |
| GitHub Actions 最小CI | ✅ 実装済み | MS2.1 ci.yml |
| サーバー版 evolve エンジン | ✅ 実装済み | MS3.1 server_evolve.js |
| Chaos CI | ✅ 実装済み | MS4.1 pipeline_chaos.js（C1〜C5 全シナリオ passed） |
| INC-003 ブラウザSA | ✅ CLOSED | safe-commands.mdブラウザルール追加 |
| **承認ゲート運用フロー** | **✅ 実装済み（2026-02-24）** | **agent/workflows/approval-gate.md 新規作成** |

### 残課題（優先度更新）

| コンポーネント | 優先度 | 状況 |
|---|---|---|
| C型ハングの実際再現（Notion/Railway） | **✅ CLOSED** | **Chaos CI (C6シナリオ) によりSaaS UIレンダリングハングでの強制的脱出（MR-08/MR-10）を検証・担保済み** |
| マルチユーザーコンフリクト | 🟡 低 | OSS化後 |
| Chaos CI サンドボックスコスト | 🟡 低 | GitHub Actionsランナーで現在は無償 |

---

## 6. 依存マップ（dependency_map.json）

`~/.antigravity/dependency_map.json` に以下を定義済み:

- 各WF（checkin/checkout/go/blog/evolveなど）が読み書きするファイルの一覧
- スクリプト間の呼び出し関係
- `hang_risk` と既知の原因・修正状態
- `hang_correlation` — ハング発生時の影響範囲（4パターン）
- 4環境の役割定義（Core-A/B/Private/Projects）

---

## 7. brain_log 構造化MD形式（設計命題）

現状の非構造化形式:

```markdown
# セッション 2026-02-17
今日はcheckoutでハングが3回発生した。update_usage_tracker.shが詰まってる気がする。次回要調査。
```

提案する構造化形式（Core読み取り可能）:

```markdown
## [INCIDENT] session_02171234
- type: hang
- component: update_usage_tracker.sh
- trigger: 並列実行時のsed -i競合
- duration: >20s (smart_run kill)
- resolution: pending
- status: OPEN

## [FIXED] session_02241054
- type: hang
- component: notion_poster.js
- trigger: .env not found / HTTPS timeout
- resolution: symlink ~/.antigravity-private/.env
- status: FIXED
```

この形式により、`grep type: hang | status: OPEN` でサーバーが実践ハングを自動集計できる。

---

## 8. 残存する制約と将来課題

| 課題 | 影響範囲 | 対応時期 |
|------|---------|---------|
| Core-B data（brain_log）が揮発可能 | 構造化MD形式導入で部分解消 | 次フェーズ |
| マルチユーザーコンフリクト（timeout値競合等） | OSS化・複数人参加時に発生 | OSS化後 |
| コールドスタート（CIの最初のテストを誰が書くか） | CI実装着手時に直面 | CI実装時 |
| Chaos CI サンドボックスコスト | GitHub Actionsランナーに影響 | インフラ確保後 |

## 9. Core Philosophy & Design Principles

Antigravity Coreを駆動する基幹となる設計思想と、AIが守るべき思考フレームワーク。下位のスキル・WFはすべてこれらの原則に従い「単なる履行手法（意図的劣化）」として実装される。

### 9.1 The Debate Loop (Persona Orchestration)
単一のAI人格による判断への妄信（単一障害点）を排除し、複数ペルソナによる**事前の対立仮説生成（Prompt-to-Debate）**をすべての意思決定の上流に置く。問題や仕様の解釈案をあらかじめ対立させ、その摩擦（ディベート）から安全かつ高品質な合成案（Synthesis）を生み出す。
※ 具現化手法と運用ルールは `agent/skills/persona-orchestration/SKILL.md` 等に譲る。

### 9.2 First Principles Thinking (第一原理思考)
迷いや停滞（エスカレーション時等）が生じた際の必須思考プロセス。表面的な問題解決（バンドエイド）を禁じ、「なぜ」を繰り返して（5-Why）根本原因に到達し、すべての制約を取り払った「理想系」から逆算して現実のパスを再構築する。
※ 実行フォーマットと適用手順は `agent/skills/first-principles/SKILL.md` に譲る。

### 9.3 System Architecture Principles
1. **ローカルは消費者、Coreは自律進化する知識エンジン**
2. **報告なき修正は学習ではない** — ハングは必ず報告されてからCoreに反映される
3. **watchdogは保護、インシデント記録は学習** — 両方必要で代替不可
4. **フォーマットが自動化の鍵** — 構造化されていないデータはサーバーが学習できない
5. **承認ゲートはIssue→人間レビュー→PR** — server_evolve.jsがIssueを自動作成。完全自律mergeは許可しない。

---

## 10. テスト戦略

| フェーズ | テスト種別 | ツール |
|---------|------------|--------|
| 現在（ローカル） | 実践ハング検出 + 報告 | safe-commands.md規約 |
| **実装済み** | **依存マップ整合性チェック** | **GitHub Actions ci.yml** |
| **実装済み** | **Chaos Engineering C1〜C5** | **pipeline_chaos.js（6 passed）** |
| **実装済み** | **週次 OPENインシデント分析+Issue生成** | **server_evolve.js** |
| **✅ 実装済み** | **Issue→PR承認ゲートフロー** | **agent/workflows/approval-gate.md** |
| 将来 | マルチユーザー競合テスト | 専用サンドボックス |

---

## 11. The Immortal Agent Architecture: CEO-COO-Daemon Trinity

> **追記日**: 2026-03-09
> **ディベート**: Hardcore Review Debate (Round ∞) + Chaos Engineer 追加
> **起点**: Phase 1-4 の「サーバーサイドCI自律ループ」を**Dockerコンテナ化された完全自律型AIエージェント**へ昇格させる

### 11.1 問題の再定義

Phase 1-4 により「学習ループ」は閉じた。しかし、実際のコード実装・テスト・デバッグの泥作業は**依然として人間（CEO）がIDEチャット経由で逐次的に指示を出し、応答を待つ**必要があった。
この「人間がボトルネック」構造を根本的に破壊し、**計画が固まった後は人間の介入なしに実装を完遂させる**ことが新たな命題である。

### 11.2 三層構造モデル (The Trinity Model)

| 層 | エンティティ | 役割 | 環境 |
|----|------------|------|------|
| **CEO** | Human (あなた) | 理念の提示、最終意思決定、予算の承認 | 対面 |
| **COO** | Antigravity Core (IDE AI / Ultra) | 戦略立案、品質閾値管理、メタルール（既存の `DECISION_USECASES.md` 等）の強制、Daemon監督 | Mac ネイティブ |
| **Executor** | Daemon Core (Docker Headless AI) | 不眠不休の実装・テスト・デバッグ・自己修復ループ | Docker コンテナ |

### 11.3 コア・メカニズム

1. **The Overseer**: Docker `HEALTHCHECK` によるハング検知と自動再起動。OSネイティブの `launchd` に依存しない。
2. **State Hydration**: `~/.antigravity/` を Docker Volume としてマウント。コンテナ死亡→再起動時に直前の状態を完全復元。
3. **The Immune System**: `fatal_blacklist.json` に致命的エラーパターンを自己蓄積。同じ死因での再死亡を回避。
4. **Asynchronous Gateway**: CLI（`/core-run`）からJSONキューにタスクをPushするだけ。Daemon CoreがMCP/SSH経由でMac本体を操作。
5. **Cost-Based Escalation**: Daemonが停止する唯一の条件は「設定された予算上限に達しそうな時」のみ。権限やコマンド種別による制限は行わない。

### 11.4 自己強化学習閉ループ (Self-Reinforcing Learning Loops)

- **Daemon（下位ループ）**: 反復エラーを `fatal_blacklist.json` / `knowledge/` に自己蓄積し、次回ループで回避する免疫系。
- **COO（上位ループ）**: Daemonからの Suspend / 完了レポートを解析し、自身が生成するプロンプト・SKILL.md・閾値設計を自己最適化する上位学習ループ。

### 11.5 Design Principles（追記）

6. **人間は戦略（計画）と決裁（コスト承認）のみ** — 実装・検証の泥作業でCEOがボトルネックになることは許容しない
7. **既存のAntigravity Core開発スキーム（IDE `/go` 等）は非破壊** — Daemon Coreは `opt-in` の別コマンド（`/core-run`）で起動する
8. **COOの統治道具は既にCoreに存在する** — メタルール (`DECISION_USECASES.md`)、品質基準 (`code-standards.md`)、ワークフロー群、スキル群、ナレッジ群がそのままDaemonへの「命令書」となる

### 11.6 Debate-Validated Mandatory Mechanisms（/debate deep 5ラウンド完走）

> **検証日**: 2026-03-09 | **5ペルソナ × 5ラウンド深掘りディベート**

#### 全6必須機構

| # | 機構 | 役割 |
|---|------|------|
| 1 | **Stagnation Watcher** | N回試行スコア改善なし → Daemonを強制Suspend、COOへエスカレーション |
| 2 | **COO-guided Iteration** | COO（Ultra）が根本原因分析し「Hint」注入 → Daemon再起動 |
| 3 | **Write Interceptor** | 50行超のdiffはステージング → COO目視確認（暴走書込防止） |
| **4** | **Knowledge昇格プロトコル** | N件類似事例 → COOがSKILL.mdに汎化ルールを自動追記（エピソード記憶→意味記憶化） |
| **5** | **Fact-Checking Gate** | 3タスクで実証されたルールのみSKILLに昇格（誤汎化による自己毒化防止） |
| **6** | **Knowledge Pruning** | `knowledge/` 肥大化時に重要度低ナレッジを自動アーカイブ（ノイズ化防止） |

#### 自己強化学習の5層複利モデル（どんどん賢くなる構造）

| Layer | 学習単位 | 蓄積先 | 賢さの種類 |
|-------|---------|--------|----------|
| L1 | 個別エラー → 回避 | `fatal_blacklist.json` | 知らないことを減らす |
| L2 | 修正パターン → 成功事例 | `knowledge/` エピソード | 経験を増やす |
| L3 | 類似事例N件 → 汎化ルール | `SKILL.md` (COO昇格) | 原則を獲得する |
| L4 | SKILL.md更新 → COO初期値向上 | セッション引き継ぎ | 初手から賢い状態で起動 |
| **L5** | **蓄積知識 → 圧縮 → 濃縮原則** | **`knowledge/distilled/`** | **密度を上げながら永続的に賢くなる** |

L4が閉じると「Daemonが賢くなる → COOの指示が精密になる → さらにDaemonが賢くなる」という**指数的複利**が成立する。
L5が加わることで、知識ベースは**肥大化せずに凝縮し続ける**。量ではなく密度で賢くなるループが完成する。

#### Smart Contract JSON 標準スキーマ（Pragmatist提案より確定）
```json
{
  "task": "タスクの自然言語説明",
  "context": {
    "relevant_files": ["path/to/file.ts"],
    "past_errors": [],
    "error_blacklist": []
  },
  "quality_gates": [
    { "type": "command", "cmd": "npm test", "must_pass": true },
    { "type": "lighthouse", "score_min": 95 }
  ],
  "budget": {
    "max_llm_calls": 50,
    "stagnation_threshold": 5
  },
  "meta_rules_summary": "COOが生成するメタルールサマリー"
}
```

### 11.7 Knowledge Distillation Loop — 「濃縮還元」の閉ループ

> **起点**: CEOの設計追加「肥大化していく情報を整理整頓・圧縮しながら濃縮還元していく閉ループも必要」

L1〜L4 で蓄積された生知識をそのまま溜め込み続けると、コンテキストウィンドウの限界に達し、学習が逆にノイズになる。L5 はこの問題を「**量から密度へ**」の蒸留で解決する。人間の海馬→大脳皮質への記憶固定化と同じ原理だ。

```
[蓄積フェーズ]
  knowledge/ に生のエピソードが蓄積し続ける (L1-L2)
        ↓
[昇格フェーズ]
  類似N件 → SKILL.md の汎化ルールへ昇格 (L3)
        ↓
[蒸留フェーズ — L5 Knowledge Distillation Loop]
  SKILL.md 群の重複・類似・矛盾を検出
        ↓
  COO が「より少ない言葉でより多くを伝える原則」に圧縮
        ↓
  knowledge/distilled/ に「濃縮原則」として保存
        ↓
  元の冗長なエピソード・ルールを knowledge/archived/ へ
        ↓
[効果]
  コンテキストウィンドウの消費が減る → Daemon の思考が軽くなる
  より少ない指示でより高い精度 → 本質的な賢さの向上
        ↓
[再蓄積フェーズ]
  さらに高品質なベースラインで次のエピソードを蓄積 → ループへ戻る
```

**蒸留の3原則**:
1. **可逆性 (Reversibility)**: 蒸留前の生データは `knowledge/archived/` に保管。圧縮した原則が間違いだった場合に巻き戻せる
2. **実証ベース (Evidence-Backed)**: 少なくとも5件の独立した事例に支持された場合のみ「濃縮原則」に昇格
3. **定期実行 (Scheduled)**: タスク完了N件ごと、または `knowledge/` が一定サイズを超えた時に自動トリガー
