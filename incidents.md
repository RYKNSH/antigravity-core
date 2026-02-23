# Incident Registry
> セッション中に発生した失敗・ハング・フリーズ・承認待ちの記録。揮発させず結晶化する。

**Last Updated**: 2026-02-23
**Total Incidents**: 1

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

## INC-002〜 [未記録]

次のインシデントは `/incident` を実行して記録する。
