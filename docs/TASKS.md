# Antigravity Core Self-Improving Pipeline — TASKS

> **現在のフェーズ**: Phase 8 — Four-Loop Quality Governance（✅ 全完了）
> **次のフェーズ候補**: Phase 9 — Quality Governance × Daemon 統合テスト
> **今すぐ着手可能**: 5.1.2〜5.1.5 の追加E2E検証（任意）or Phase 9 新規定義

---

## ✅ MS 1.1〜4.1: Phase 1-4 全実装済み（2026-02-24 完了）

*詳細は MILESTONES.md を参照*

---

## ✅ MS 5.1: Daemon Core Docker基盤 & Asynchronous Gateway（実質完了）

> **実態**: Dockerfile/docker-compose.yml 稼働中、Daemon healthy、core-run.js + mcp-host-server.js 実装済み。
> タスク記載は残すが全タスクが実質クリア済み。

### タスク 5.1.1: `Dockerfile` + `docker-compose.yml` の最終化・起動テスト ✅
- **工数**: 中（1セッション以内）
- **担当ファイル**: `~/.antigravity/docker-core/Dockerfile`, `docker-compose.yml`
- **内容**: 既存のひな形を整備し `docker compose up` で正常起動するまで検証
- **完了チェック**: ✅ `docker ps` で RUNNING + healthy 確認済み

### タスク 5.1.2: Volume マウント検証 ✅
- **工数**: 小
- **内容**: `~/.antigravity/` をVolumeマウントし、コンテナ再起動後も `.session_state.json` が保持されるか確認
- **依存**: 5.1.1
- **完了チェック**: ✅ `.session_state.json` がコンテナ再起動後も保持されている

### タスク 5.1.3: HEALTHCHECK 自動再起動テスト（未検証）
- **工数**: 中
- **内容**: TTL超過時にコンテナが自動で再起動されることを実証
- **依存**: 5.1.2
- **完了チェック**: 意図的にTTL超過させ、`docker events` で restart が観測される

### タスク 5.1.4: `/core-run` CLI スクリプト作成 ✅
- **工数**: 小
- **担当ファイル**: `~/.antigravity/agent/scripts/core-run.js`
- **内容**: `pending_tasks` へのJSON Push スクリプト
- **依存**: 5.1.2

### タスク 5.1.5: Gateway E2E テスト
- **工数**: 中
- **内容**: `/core-run` → Daemon検知 → ログ出力までの結合テスト
- **依存**: 5.1.3, 5.1.4
- **完了チェック**: ターミナルでPush→Dockerログで検知確認

---

## ⬜ MS 6.1: Headless LLM Agent Engine + Safety Mechanisms
*(MS 5.1完了後に着手)*

### タスク 6.1.1: Gemini API クライアント組み込み
- **工数**: 中 | **担当**: `docker-core/agent-loop.js`
- **内容**: `@google/generative-ai` SDK を組み込み、プロンプト送信・レスポンス受信を実証
- **完了チェック**: Dockerコンテナ内から `Gemini hello world` が正常返答される

### タスク 6.1.2: MCP Host Server（Mac側）の実装
- **工数**: 大 | **担当**: `agent/scripts/mcp-host-server.js`
- **内容**: Daemon からの「ファイルR/W / コマンド実行」リクエストを受け付けるサーバー
- **完了チェック**: コンテナ内Daemonから `npm test` をMCP経由でMac側に実行させられる

### タスク 6.1.3: Think→Act→Observe (ReAct) ループ実装
- **工数**: 大 | **担当**: `docker-core/agent-loop.js`
- **内容**: LLMが「考える→ツール呼び出す→結果観察→次の思考」を繰り返すループ
- **完了チェック**: エラーログを渡すと修正コードを生成 → 実行 → 再検証が自律的に回る

### タスク 6.1.4: COO Smart Contract JSON 受信・遵守ロジック
- **工数**: 中 | **担当**: `docker-core/agent-loop.js`
- **内容**: `/core-run` でPushされた Smart Contract JSON を読み込み、`quality_gates` を評価基準にする
- **完了チェック**: `quality_gates.lighthouse.score_min: 95` が守られない限りループが終わらない

### タスク 6.1.5: Stagnation Watcher 実装
- **工数**: 中 | **担当**: `docker-core/agent-loop.js`
- **内容**: スコアをStateに記録し、`stagnation_threshold` 回連続で改善なしなら自動Suspend + COOレポート
- **完了チェック**: 意図的に改善不可能なタスクでSuspend→レポートが生成される

### タスク 6.1.6: COO-guided Iteration 実装
- **工数**: 中 | **担当**: `docker-core/agent-loop.js`
- **内容**: COOがSuspendレポートを受け取り「Hint」をStateに書き込む → Daemonが読み込んで再起動するフロー
- **完了チェック**: Hintを書き込んだ直後にDaemonが詰まりを突破できる

### タスク 6.1.7: Write Interceptor 実装
- **工数**: 中 | **担当**: `agent/scripts/mcp-host-server.js`
- **内容**: ファイル書き込みリクエスト時に `git diff` を取得、50行超なら書き込みをステージング→COO承認要求
- **完了チェック**: 大きな変更がCOO確認なしに書き込まれないことを確認

### タスク 6.1.8: E2Eデモ完走
- **工数**: 大
- **内容**: 「バグ付きコード → `npm test` 全パス」を全安全装置込みで無人完走
- **依存**: 6.1.5, 6.1.6, 6.1.7
- **完了チェック**: テストログが「PASS」で終わり、Human介入ゼロ

---

## ⬜ MS 7.1: Self-Reinforcing Learning Loops — L1〜L5 複利閉ループ
*(MS 6.1完了後に着手)*

### タスク 7.1.1: L1 免疫系 — 反復エラー自動 blacklist 追記
- **工数**: 中 | **担当**: `docker-core/agent-loop.js`
- **内容**: 同一エラーパターンがN回出現したら `fatal_blacklist.json` に自動追記
- **完了チェック**: 初回失敗エラーが3回目に最初から回避される

### タスク 7.1.2: L2 — 解決策の knowledge/ 自動蓄積
- **工数**: 中 | **担当**: `docker-core/agent-loop.js`
- **内容**: タスク完了時に「何をどう直したか」を `knowledge/YYYY-MM-DD-{slug}.md` に自動書き出し
- **完了チェック**: タスク後に knowledge/ に構造化MDが生成されている

### タスク 7.1.3: L3 Knowledge Upgrade Protocol — 汎化ルール自動昇格
- **工数**: 大 | **担当**: `agent/scripts/knowledge-upgrader.js`
- **内容**: `knowledge/` をスキャンし、類似するエpiソードN件を検出したら COO に汎化ルール案を生成させ `SKILL.md` に追記
- **完了チェック**: 関連エピソード3件から汎化ルールが自動生成され SKILL.md に追記される

### タスク 7.1.4: Fact-Checking Gate 実装
- **工数**: 中 | **担当**: `agent/scripts/knowledge-upgrader.js`
- **内容**: 汎化ルール候補を3つの独立したタスクで検証し、全て成功した場合のみ SKILL 昇格
- **完了チェック**: 検証が2件しか通らないルールが昇格されないことを確認

### タスク 7.1.5: L4 — SKILL.md 更新の次セッション反映検証
- **工数**: 小
- **内容**: checkin.md 経由で更新された SKILL.md が次セッションで COO に読み込まれていることを確認
- **完了チェック**: 前セッションで追記したルールが次のCOO応答に反映される

### タスク 7.1.6: L5 Knowledge Distillation Loop — 蒸留エンジン実装
- **工数**: 大 | **担当**: `agent/scripts/knowledge-distiller.js`
- **内容**: `knowledge/` が閾値を超えたら自動起動 → SKILL.md群の重複・類似・矛盾を検出 → COOが圧縮 → `knowledge/distilled/{slug}.md` に保存 → 元データを `knowledge/archived/` へ退避
- **蒸留3原則**: 可逆性（archived保管）/ 実証ベース（5件支持）/ 定期実行（サイズ閾値トリガー）
- **完了チェック**: 蒸留後 `knowledge/` が軽量化し、`distilled/` に圧縮原則が保存されている

### タスク 7.1.7: Knowledge Pruning — 重要度低ナレッジの自動アーカイブ
- **工数**: 小 | **担当**: `agent/scripts/knowledge-distiller.js`
- **内容**: アクセス頻度・参照数が低いナレッジを `knowledge/archived/` に自動移動
- **完了チェック**: 古い低頻度ナレッジがコンテキストに混入しなくなる

### タスク 7.1.8: L1〜L5 全層 E2E テスト
- **工数**: 大
- **内容**: ① 同じエラーが2回目に回避される ② `distilled/` に蒸留原則が保存される ③ SKILLが次セッションに引き継がれる の3点を連続テストで確認
- **依存**: 7.1.5, 7.1.7
- **完了チェック**: 3点全て自動テストが PASS する

---

## Phase 8: Four-Loop Quality Governance タスク一覧

> **Phase A（今週着手可能）: MS 8.1 — COO-Lite + TEO + QES基盤**

### タスク 8.1.1: bootstrap-goals.js 実装
- **工数**: 小 | **担当**: `~/.antigravity/agent/scripts/bootstrap-goals.js`（新規）
- **内容**: 現状コードベースを計測して初期品質目標値を自動設定する
  - テスト合格率を npm test から取得
  - Lighthouse スコアを初回計測
  - bundle KB を計測
  - 取得値 × 0.9 or ABSOLUTE_FLOORS の大きい方を初期閾値として保存
- **完了チェック**: `.quality/goals.json` が生成されており、現在値より低い目標値が設定されていない

### タスク 8.1.2: TEOスキーマ + proper-lockfile導入
- **工数**: 小 | **担当**: `docker-core/`
- **内容**: `.quality/teo_{task_id}.json` スキーマ定義 + proper-lockfile パッケージを追加
- **TEOスキーマ**:
  ```json
  {
    "task_id": "",
    "completed_at": "",
    "scores": { "quality": 0, "efficiency": 0, "speed": 0, "lightness": 0 },
    "qes_delta": 0,
    "stagnation_count": 0,
    "coo_calls": 0,
    "worker_measurements": {}
  }
  ```
- **完了チェック**: タスク完了後に .quality/ にTEOファイルが生成される

### タスク 8.1.3: 4軸スコア計測の実装
- **工数**: 中 | **担当**: `docker-core/quality-scorer.js`（新規）
- **内容**: 各軸の計測実装
  - quality: `npm test` の pass rate
  - efficiency: Daemon ログから LLM コール数 × 単価
  - speed: Lighthouse CI（10タスクごと、worker_threadsで非同期）
  - lightness: bundle-analyzer で KB 計測（worker_threadsで非同期）
- **完了チェック**: TEO の scores が全て 0 以外で記録される

### タスク 8.1.4: COO-Lite 実装
- **工数**: 中 | **担当**: `docker-core/coo-lite.js`（新規）
- **内容**:
  - Stagnation検知（同一タスクでN回連続エラー）をhookポイントとして定義
  - Environment Check先行実行（volume / env / API疎通）
  - 環境正常 → `process.env.COO_MODEL` の上位モデルで DECISION_USECASES.md を systemInstruction に注入して分析
  - COO-Lite LLM Adapter（`ANTIGRAVITY_DIR` 環境変数でパス解決）
- **完了チェック**: Stagnation時に上位モデルが呼ばれ、hintがTEOに記録される

### タスク 8.1.5: COO rate limit 実装
- **工数**: 小 | **担当**: `docker-core/coo-lite.js`
- **内容**: max_coo_calls_per_task=3、クールダウン30分、stagnation 10回でSuspend＋CEOへ通知
- **完了チェック**: 4回目以降のCOO呼び出しが抑制される

### タスク 8.1.6: Environment Check 実装
- **工数**: 小 | **担当**: `docker-core/environment-check.js`（新規）
- **内容**: コンテナ内で実行可能な4チェック
  - volume_mount: ANTIGRAVITY_DIR/docs/DECISION_USECASES.md の存在確認
  - env_variables: GEMINI_API_KEY, ANTIGRAVITY_DIR の存在確認
  - file_permissions: ANTIGRAVITY_DIR への書き込み権限確認
  - api_reachability: Gemini API エンドポイントへの疎通確認
- **完了チェック**: 環境問題がある場合に COO を呼ばずに issue 報告する

### タスク 8.1.7: QES 初期化ファイル作成
- **工数**: 小 | **担当**: `~/.antigravity/quality/qes_weights_global.json`（新規）
- **内容**: アンカー値（test_added=2.0, test_deleted=-10.0）と帰納更新対象のデフォルト値を設定
- **完了チェック**: `.quality/qes_weights_global.json` が存在し、Daemon が読み込める

### タスク 8.1.8: E2E テスト（Phase A 完了ゲート）
- **工数**: 中 | **依存**: 8.1.1〜8.1.7
- **内容**: Stagnation → Environment Check → COO-Lite → hint記録 → TEO 4軸スコア確認 の一連の流れをテスト
- **完了チェック**: 全ステップが自動で通過し、TEO に stagnation_count, coo_calls, scores が記録される
