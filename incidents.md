# Incident Registry
> セッション中に発生した失敗・ハング・フリーズ・承認待ち・**ブラウザスタック**の記録。揮発させず結晶化する。

**Last Updated**: 2026-02-24
**Total Incidents**: 3

---

## 記録ルール

- 発生したらすぐに `/incident` を実行して記録する
- 根本原因まで掘る（タイムアウト不足等の表面的な原因は書かない）
- 対処を `safe-commands.md` や workflow に反映してから `[FIXED]` にする

| ステータス | 意味 |
|---|---|
| `[OPEN]` | 再発防止策未適用 |
| `[FIXED]` | safe-commands / workflow に反映済 |
| `[WONTFIX]` | 外部要因につき対処困難 |

---

## INC-001 [FIXED] git push ハング（誤パス）

**発生日**: 2026-02-23
**セッション**: RYKNSH records 本社ホワイトペーパー作成
**症状**: `git push` が無限ハング → ユーザーがキャンセル

### 再現条件
- `~/.gemini/antigravity/` で `git` コマンドを実行
- このディレクトリは git 管理外（remote なし）

### 根本原因
**AIのワールドモデルと現実の乖離**。
- AIは「antigravity配下にgitリポジトリがある」という誤った前提で操作した
- 実際のgitリポジトリは `~/.antigravity/`（別パス）だった
- remote が存在しないディレクトリで push → 認証プロンプト待ちで無限ハング

### 対処（適用済）
1. `safe-commands.md` に「git操作前に必ず `git rev-parse --show-toplevel` と `git remote -v` を確認する」ルールを追記
2. `checkin.md` にワークスペーススキャン（主要gitリポジトリの一覧化）を追加

### 教訓
> タイムアウト・ハードコードで防ぐのではなく、「操作前に現実を確認する」を原則とする（Grounding原則）

---

## INC-002 [FIXED] update_usage_tracker.sh 慢性ハング

**発生日**: 2026-02-17（初回確認）〜 2026-02-23（継続）
**セッション**: 複数セッションの checkout 時に継続発生
**症状**: checkout の usage-tracker ステップが毎回ハング → `_smart_run` が10秒後にkillして続行

### 再現条件
- `checkout.md` の `_smart_run 10 1 "usage-tracker"` でスクリプト実行
- 複数のバックグラウンドジョブが同時に `USAGE_TRACKER.md` を `sed -i ''` で編集

### 根本原因
1. **`flock` 欠如による並列書き込み競合**: checkout.mdが複数ジョブを `&` で並列実行。`USAGE_TRACKER.md` への同時 `sed -i ''` がfd競合を起こし待機状態に
2. **`set -euo pipefail` 不在**: エラーが無視されていた（Silent Failure = P-02）
3. **watchdog の隠蔽効果**: 10s kill → give-up→続行 で問題が invisible になり incidents.md へ記録されなかった（P-04 Memory Loss の構造的誘発）

### 対処（適用済）
1. `update_usage_tracker.sh` に `set -euo pipefail` を追加
2. `flock -w 10 200` で排他ロックを実装
3. checkout.md にスクリプト存在チェックを追加

### 教訓
> watchdog の "サイレントgive-up" がインシデントを invisible にする逆説的構造が存在する。watchdog は "救助" であると同時に "隠蔽" になりうる。

---

## INC-003 [FIXED] ブラウザサブエージェント慢性スタック

**発生日**: 2026-02-23（複数セッション）
**セッション**: Lumina デプロイ、ARTISTORY Studio 等
**症状**: ブラウザサブエージェントが Supabase/Railway UI で何度もスタック → 効率スコア 2/5

### 再現条件
- ブラウザサブエージェントを外部SaaS（Supabase/Railway/Vercel等）のUI操作に使用
- MFA壁・ページ構造変化・ネットワーク遅延でセレクタが見つからない場合

### 根本原因
1. **ブラウザサブエージェントが safe-commands.md の保護圏外**: ターミナル向けルールしか存在しなかった
2. **"N回失敗→切り替え" ルールの不在**: brain_log に「3回失敗→別アプローチ」と書かれたが core に反映されなかった（P-04 Memory Loss）
3. **インシデントとして記録されなかった**: brain_log のみに記録 → 揮発
4. **承認ゲートの運用フローが未文書**: server_evolve.jsがIssueを生成しても人間がPRにする手順がなかった

### 対処（2026-02-24 全対処完了）
1. `safe-commands.md` にブラウザサブエージェント専用ルール（3回失敗→切り替え）を追加
2. incidents.md の対象範囲をブラウザ操作まで拡張
3. `agent/workflows/approval-gate.md` 新規作成 → Issue→PR承認ゲート運用フロー定義（学習ループの最後の1マイル）

### 教訓
> 「MFA壁への自動対処」は技術的手段ではなく、ルールとしての切り替え義務化で解決する。承認ゲートは完全自動化ではなく「人間の判断を必須フェーズ」として残す。

---
