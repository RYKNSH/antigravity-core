# ENVIRONMENTS.md — 4環境ラベリング定義

> [!IMPORTANT]
> **git 操作・ファイル編集・スクリプト実行の前に必ずこのファイルを参照する。**
> **環境を混同してのgit push・秘密情報へのアクセスは絶対禁止。**

---

## 環境マップ

| 環境ID | パス | 管理方式 | 主な用途 | git操作 | 秘密情報 |
|--------|------|---------|---------|---------|---------|
| **Core-A** | `~/.antigravity/` | ✅ git管理（remote: GitHub） | AI OSワークフロー・スキル・ルール・スクリプト | ✅ push可 | ❌ 置かない |
| **Core-B** | `~/.gemini/antigravity/` | ❌ git管理外 | AIの作業ログ・brain・artifacts（セッション固有） | ⛔ push禁止 | ❌ 置かない |
| **Projects** | `~/Desktop/AntigravityWork/[Project]/` | ✅ 各プロジェクトgit管理 | プロダクトコード | ✅ 各repo内でpush可 | ⚠️ `.env`のみ（gitignore必須）|
| **Private** | `~/.antigravity-private/` | ❌ git管理外 | APIキー・`.env`・個人認証情報 | ⛔ push禁止 | ✅ ここだけ |

---

## 禁止操作（絶対遵守）

```
⛔ Core-B (~/.gemini/antigravity/) で git push を実行してはいけない
⛔ Private (~/.antigravity-private/) を git add してはいけない
⛔ Core-A のファイルを Core-B に混在させてはいけない
⛔ Projects の .env を他のプロジェクトにコピーしてはいけない
⛔ Core-A 配下のスクリプトに API キーをハードコードしてはいけない
```

---

## Grounding確認手順（git操作前に必ず実行）

```bash
# Step 1: 現在地が git管理下か確認
git rev-parse --show-toplevel 2>&1

# Step 2: remote 確認（none なら push しない）
git remote -v 2>&1

# Step 3: 環境IDを目視確認
# ~/ で始まるパスが Core-A/B/Private のどれか？
# ~/Desktop/AntigravityWork/ なら Projects
```

---

## 名前類似による混同リスク一覧

| 混同しやすいペア | 正しい区別 |
|----------------|-----------|
| `~/.antigravity/` vs `~/.gemini/antigravity/` | Core-A(git管理)  vs Core-B(非git) |
| `~/.antigravity/agent/scripts/` vs プロジェクト内 `scripts/` | グローバルCLI vs プロジェクト固有 |
| `~/.antigravity-private/.env` vs プロジェクト `.env` | グローバル秘密情報 vs プロジェクト用 |

---

## 関連ファイル

- [`safe-commands.md`](agent/rules/safe-commands.md) — git操作のGrounding原則
- [`incidents.md`](incidents.md) — 環境混同インシデントの記録
- [`checkin.md`](agent/workflows/checkin.md) — セッション開始時の4環境確認（自動実行）
