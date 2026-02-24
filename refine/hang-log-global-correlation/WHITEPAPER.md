# Antigravity Core Self-Improving Pipeline — Whitepaper

> **作成日時**: 2026-02-24（v1.0）→ 2026-02-24 Round 7 実装検証で v2.0 に更新
> **ディベート**: Round 1-7 完走・戦略ロック済み
> **参照先**: `refine/hang-log-global-correlation/` (round_01〜07)
> **現在地**: MS1.1〜MS4.1 全実装済み。残倹題 = 承認ゲートの運用定義

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
  PR自動生成
      ↓
  CI: 依存マップ整合性チェック + Chaos層テスト
      ↓
  Pass → main merge（承認ゲート）
      ↓
[各ローカル]
  checkin時に git pull → 最新Coreを受け取る（既に実装済み）
```

### 全コンポーネント実装済み（Round 7検証済み）

| コンポーネント | 状態 | Round 7検証結果 |
|---|---|---|
| ローカル → Core push | ✅ git push 実装済み | 専用項目 |
| Core → ローカル pull | ✅ checkin.md SLOW ZONEで実装済み | 専用項目 |
| ハング報告スキーム | ✅ safe-commands.md フェーズ2.5 | 専用項目 |
| 依存マップ | ✅ dependency_map.json v1.1.0 | JSON lint CIで和実証済み |
| brain_log → incidents.md 転記 | ✅ checkin.md全件スキャン | 専用項目 |
| brain_log 構造化MD | ✅ MS1.1 INCIDENT_FORMAT.md | C4テストで動作確認済み |
| GitHub Actions 最小CI | ✅ MS2.1 ci.yml | PR/push/weekly トリガー実装済み |
| サーバー版 evolve エンジン | ✅ MS3.1 server_evolve.js | OPENインシデント分析+Issue生成 |
| Chaos CI | ✅ MS4.1 pipeline_chaos.js | **C1〜C5 全シナリオ 6 passed, 0 failed** |
| INC-003 ブラウザSA | ✅ CLOSED | 专用項目 |

### 残倷題（Round 7に特定）

| コンポーネント | 優先度 | 状況 |
|---|---|---|
| 承認ゲートの進流定義（IssueからPRまでのプロセス） | 🔴 高 | Issue作成は出来るが、PRへのクローズフローが未文書 |
| C型ハングの実際再現（Notion/Railway） | 🟠 中 | C5はネット層タイムアウトのみ。SaaS UIスタックはブラウザSAスコープ公外 |
| マルチユーザーコンフリクト | 🟡 低 | OSS化後 |
| Chaos CI サンドボックスコスト | 🟡 低 | GitHub Actionsランナーで現在は無偈 |

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

---

## 9. 設計原則

1. **ローカルは消費者、Coreは自律進化する知識エンジン**
2. **報告なき修正は学習ではない** — ハングは必ず報告されてからCoreに反映される
3. **watchdogは保護、インシデント記録は学習** — 両方必要で代替不可
4. **フォーマットが自動化の鍵** — 構造化されていないデータはサーバーが学習できない
5. **承認ゲートは Issue → 人間レビュー → PR** —（Round 7確定） server_evolve.jsがIssueを自動作成。人間が内容を確認してPRとして提出。完全自律mergeはWHITEPAPER設計原則上許可しない

---

## 10. テスト戦略

| フェーズ | テスト種別 | ツール |
|---------|------------|--------|
| 現在（ローカル） | 実践ハング検出 + 報告 | safe-commands.md規約 |
| **実装済み** | **依存マップ整合性チェック** | **GitHub Actions ci.yml** |
| **実装済み** | **Chaos Engineering C1〜C5** | **pipeline_chaos.js（6 passed）** |
| **実装済み** | **週次 OPENインシデント分析+Issue生成** | **server_evolve.js** |
| 次フェーズ | 房 Issue → PR プロセス定義 | 承認ゲート運用ルール |
| 将来 | マルチユーザー競合テスト | 専用サンドボックス |
