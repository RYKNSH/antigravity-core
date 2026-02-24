# Round 4: 未発見問題点の洗い出し × 業界典型パターンとの照合 × 予防的検証

**日時**: 2026-02-23T23:50:00+09:00
**前ラウンドからの焦点**: Round 1〜3で発見した問題の死角を検証。外部リサーチ（AI エージェント失敗パターン業界標準 + シェルスクリプトハング防止 BP）を照合し、Antigravity が未対処の問題を特定する。

---

## 📡 外部リサーチ結果（業界標準の典型パターン）

### AIエージェント失敗パターン TOP（2024-2025）
| # | パターン名 | 業界での発生率 | Antigravity 内の対応状況 |
|---|-----------|-------------|----------------------|
| P-01 | **Hallucinated API / 存在しないメソッド呼び出し** | 42%（最多） | ❌ 未対処（incidents.mdに記録なし） |
| P-02 | **Silent Failure（エラーを成功と偽る）** | 高頻度 | ⚠️ 一部対処（smart_run give-up後も続行）|
| P-03 | **Infinite Loop（同じプランを繰り返す）** | 高頻度 | ✅ watchdog 90秒で対処 |
| P-04 | **Long-Running Project memory loss（セッション間記憶喪失）** | 高頻度 | ⚠️ brain_logで部分対処（揮発リスクあり）|
| P-05 | **"God Mode"（dev/prod環境の混同）** | 中〜高 | ❌ `.env`の扱いルールが曖昧 |
| P-06 | **Cascading Failure（1エラーが連鎖）** | 中 | ⚠️ 各WFが独立しているが連鎖検知なし |
| P-07 | **GPU Memory Leak（リソース枯渇）** | 23% | N/A（GPU使用なし） |
| P-08 | **Ambiguous Instructions（曖昧な指示→誤実行）** | 中 | ⚠️ `/refine`/`/spec`で軽減しているが根本は残る |

### シェルスクリプトBP — Antigravityとの乖離
| BP | 業界標準 | Antigravity現状 | 乖離 |
|----|---------|---------------|------|
| BP-01 | `set -euo pipefail` 冒頭に必須 | checkout.mdにない | ❌ |
| BP-02 | `timeout` コマンドで個別タイムアウト | custom `_smart_run`で代替 | △（自前実装） |
| BP-03 | `flock` で排他ロック（競合書き込み防止） | 並列`&`実行のまま | ❌ |
| BP-04 | `trap EXIT` でクリーンアップ | checkout.mdに`trap`あり | ✅ |
| BP-05 | `set -x` デバッグモード対応 | なし | ❌（デバッグ困難） |
| BP-06 | atomic `mktemp` で一時ファイル | `tmpout=$(mktemp)` ✅ | ✅ |

---

## 議論

**🤔 Skeptic**:
「**P-01（Hallucinated API呼び出し）が42%** というのは見過ごせない。Antigravityにおける相当物を考えると、AIが 『あのスクリプトはこういうオプションを持つはず』 と想定して実行し、実際には存在しない引数でハングまたはサイレント失敗するというケースが頻繁に起きているはずだ。

checkout.md の `node ~/.antigravity/agent/scripts/git_context.js snapshot` — この `git_context.js` は実在するか？ `sync_private.js` は？ こういったスクリプトが存在しない場合、`_smart_run` は10〜20秒待ってから quietly give up する。**スクリプト不在のサイレント give-up事案は P-01 + P-02 の合体パターン**で、最も検知困難だ。」

**😈 Devil's Advocate**:
「BP-01 `set -euo pipefail` の不在を指摘するのは正しい。だが、これより深刻なのは **BP-03 `flock` の欠如**だ。

checkout.md は `_smart_run ... usage-tracker &` と `_smart_run ... evolve &` を同時に並列実行している。両方が `~/.antigravity/` 配下のファイル（`USAGE_TRACKER.md`, `SELF_EVOLUTION.md` 等）を同時に `sed -i ''` で編集する可能性がある。

macOS の `sed -i ''` は atomic ではない。ファイルが同時に書き込まれると：
1. ファイルの一部が破損する（silent corruption）
2. もしくは一方が hung に見える（fd競合）

**Round 2 で提示した「競合書き込み仮説」を `flock` 欠如が裏付けている。** この問題はwatchdogでは解決できない。`flock` による排他ロックが唯一の解だ。

さらに `update_usage_tracker.sh` 自体に `set -euo pipefail` がない。`sed -i ''` が失敗したとき、スクリプトは何も報告せず終了コード0で返す可能性がある。**Silent Failure（P-02）の典型構造がここにある。**」

**🔬 Systems Analyst**:
「**P-05（God Mode: dev/prod混同）** をAntigravityに対応させる。

AIエージェントが操作するディレクトリは：
- `~/.antigravity/` → Core-A（本番のWorkflow Engine）
- `~/.gemini/antigravity/` → Core-B（AI作業ログ）
- `~/Desktop/AntigravityWork/[プロジェクト]/` → 各プロジェクト（本番コード）
- `~/.antigravity-private/` → 秘密情報（`.env`、APIキー）

**問題：これら4つの "環境" に対するアクセス制御ルールが存在しない。**

safe-commands.md には `git操作前のGrounding確認` は書かれているが：
- `~/.antigravity-private/` の中身を誤って `git add` してしまうリスク
- プロジェクトの本番 `.env` を別プロジェクトにコピーしてしまうリスク
- Core-A のworkflowを編集したときに誤ってCore-Bを参照するリスク

どれも **環境ラベリングの欠如**が原因。`.antigravity-private/` に `.gitignore` があるか？ 確認されていない。」

**🧠 Root Cause Hunter**:
「**P-04（長期プロジェクトでの記憶喪失）** に5 Whysを適用する。

brain_log 2026-02-17 に「update_usage_tracker.sh 毎回ハング → 要調査」と書かれ、2026-02-23 のセッションではその情報が失われていた問題。

- **Why 1**: 2026-02-23のAIが2026-02-17のbrain_logを参照しなかった
- **Why 2**: checkin.mdが「最新1件のbrain_log」しか読まない設計
- **Why 3**: brain_logのファイル名は `session_MMDDHHNN.md` 形式で、最新=最大の日付 → 2つの異なるMMDDがある場合、02-17は最新ではない
- **Why 4**: checkin.mdには「未解決タスク」を横断検索するロジックがない
- **Why 5（根本）**: **brain_log が "日記" として設計されており、"バックログ" として機能していない。** 未解決インシデントはbrain_logから切り出してincidents.mdに移行する設計でなければ、必ず時間が経つと失われる。

→ 業界標準との照合：*Long-Running Project Failures は「chat transcript頼り」から「structured database」への移行で解決する*（リサーチ結果[10]）。Antigravityは `brain_log` という chat transcript 型。`incidents.md` という structured database型への転記が **自動化されていない** ことが根本。

**予防策（実装なし/設計命題として）**: 
checkin.md が `brain_log/*.md` を全件スキャンし、`## 未完了のタスク` セクションの `[ ]` アイテムを `incidents.md` に自動転記するステップがあれば、このパターンは構造的に防げる。」

---

## 🔬 予防的検証マトリクス（Antigravity 固有）

| 問題 | 業界典型パターン | 現在の対処 | 防げるか？ | 必要な設計変更 |
|------|--------------|-----------|-----------|-------------|
| git push 誤パス（INC-001） | P-05 God Mode | Grounding確認（追加済） | ✅ 防げる | — |
| update_usage_tracker.sh ハング | P-02 Silent Failure + BP-01/03欠如 | 10s smart_run kill | ❌ 根本未解決 | `flock` 排他ロック + `set -euo pipefail` |
| ブラウザスタック（H-03） | P-03 Infinite Loop | なし | ❌ 未対処 | ブラウザ専用ルール（N回失敗→切替） |
| brain_log情報喪失 | P-04 Memory Loss | 最新1件読み込み | ❌ 構造的欠陥 | checkin: 全brain_log `[ ]` → incidents.md 転記 |
| スクリプト不在のサイレントgive-up | P-01 + P-02 合体 | ❌ 未検知 | ❌ 新規発見 | checkout前 "スクリプト存在チェック" ステップ |
| 環境混同（4種のdir） | P-05 God Mode | 未定義 | ❌ 新規発見 | 環境ラベリングドキュメント（`~/.antigravity-private/`含む） |
| Cascading Failure | P-06 | WFが独立 | △ 部分的 | WF間エラー伝播追跡 |

---

## 🧭 Moderator Summary（Round 4最終）

| 項目 | 内容 |
|------|------|
| **新規発見（Round 4）** | ①スクリプト不在のサイレントgive-up（P-01+P-02合体。最も検知困難）②`flock`欠如による並列書き込み競合（update_usage_tracker.sh ハングの真因候補）③4種のディレクトリ環境ラベリング未整備（`~/.antigravity-private/`含む）④`set -euo pipefail`の全スクリプトへの未適用 |
| **業界標準と照合した優先度** | Critical: `flock`+`set -euo pipefail`（スクリプト修正で即解決可能）/ High: brain_log全件スキャン（設計変更で解決可能）/ Medium: 環境ラベリング・ブラウザ専用ルール |
| **予防可能な問題の割合** | 7問題中5つは設計変更で予防可能。2つ（Cascading Failure・Ambiguous Instructions）はモニタリング強化が必要 |
| **次のアクション（ユーザー判断）** | 優先度1: `/go "update_usage_tracker.sh に set -euo pipefail と flock を追加"` ← 最小変更・最大効果 / 優先度2: `/go "checkin.md に brain_log 全件スキャン → incidents.md 転記ステップを追加"` / 優先度3: `/go "4環境ラベリングドキュメントを作成"` |
| **判定** | `Conclude` — 業界標準との照合まで完了。議論は出尽くした |
