---
description: Antigravity Core が Daemon Core にタスクを委譲するかどうかの判断ルールとベストプラクティス (debate deep 2026-03-10 確定版)
---

# Daemon 委譲ルール — Best Practices

## 呼称と権限モデル（正式定義）

| 主体 | 権限 | 禁止 |
|------|------|------|
| **ユーザー（CEO）** | ビジョン定義 (`/gen-dev`) + 費用承認のみ | 実装詳細への介入 |
| **Antigravity Core（COO）** | 設計・判断・Git管理・シークレット管理 | なし |
| **Daemon Core** | コード実装・テスト実行・自己強化学習 | GitHub直接push・外部SaaS契約 |

> **ユーザーが「コア」と言ったら「Antigravity Core」を指す。**
> **ユーザーが「デーモン」と言ったら「Daemon Core」を指す。**

---

## 基本方針

> **Antigravity Core = 設計・判断・コミュニケーション・Git管理**
> **Daemon Core = コード実装・テスト実行・自己強化学習**

---

## ✅ Daemon Core に委譲するケース

| 条件 | 例 |
|-----|-----|
| 要件が明確でファイルに落とせる | 「テスト書いて」「バグ直して」「実装して」 |
| 繰り返し・定型的な実装 | CRUD, テストファイル生成, リファクタ |
| quality_gatesで合否判定できる | pytest PASS / lint CLEAN / build OK |
| Human の判断不要 | LLM に丸投げで完結するもの |
| 並列で複数プロジェクトを回したい | タスクキューに積んで放置でいいもの |

**委譲手順（自動化済）:**
```
1. /gen-dev でROADMAP→MILESTONES→TASKS.md 自動生成
2. Task Bridge が TASKS.md をパース → pending_tasks へ自動投入 (priority=coo_assigned)
3. Daemon Core が ReActループで自律実行
4. quality_gates (Level 1) → Vision Check (Level 2) → PASS: COOがGit push
5. 完了を session_state.json の completed_tasks で確認
```

**タスク優先度キュー（Phase 8実装済）:**
```
coo_assigned  ← /gen-dev・/checkout Task Bridge経由のタスク（最優先）
high          ← 明示的な高優先タスク
medium        ← 通常タスク
low           ← 任意タスク
self_improvement ← Daemon自己生成タスク（最低優先）
```

---

## ❌ Antigravity Core が直接やるケース

| 条件 | 例 |
|-----|-----|
| ユーザーと対話しながら設計が必要 | 仕様決め・アーキテクチャ議論 |
| Daemon Core が止まっている / 起動確認できない | `docker ps` で Running でない時 |
| MCP・外部API・ブラウザ操作が必要 | Discord送信・Notion更新 |
| 緊急（ユーザーが今すぐ結果を必要としている） | デモ直前のバグ修正など |
| タスクが曖昧でまず整理が必要 | 「なんとかして」系 |

---

## 🔁 自律委譲パイプライン（Complete Flow）

```
ユーザー: /gen-dev
    ↓
ROADMAP → MILESTONES → TASKS.md 自動生成
    ↓
[Task Bridge] TASKS.md をパース → Daemon Core pending_tasks へ自動投入
    (priority=coo_assigned, /gen-dev ワークフロー最終ステップ)
    ↓
Daemon Core: ReActループ (Phase 8 agent-loop.js)
    ↓
Level 1: quality_gates (CLIテスト)
Level 2: Vision Check (WHITEPAPER/TASKS.mdとの整合性 LLM評価)
Level 3: Browser QA (URLがある場合は HTML→Gemini マルチモーダル評価)
    ↓
PASS: Antigravity Core が Git push (daemon/auto-* branch)
FAIL: Daemon Core が自動修正 → 再実行
    ↓
[任意] Notion Progress Gate に自動蓄積
```

---

## 💰 ユーザー介入ポイント（最小化・正式定義）

| タイミング | 内容 | 必須 |
|---|---|---|
| プロジェクト開始 | `/gen-dev` でビジョン定義 | ✅ |
| 外部SaaS費用発生時 | 通知→承認（OK/NG） | ✅ |
| LLMコスト月$5超過時 | 継続承認（session_state.cost_alertで検知） | ✅ |
| 進捗確認（任意） | Notionで随時確認 | 任意 |

**機密管理**: 1Password を Antigravity Core 経由で管理。
Daemon Core には `.env` として事前注入（op service account 導入後に動的取得）。

---

## 🛡️ Daemon Core 安全弁（Phase 8実装済）

| 機能 | 実装 |
|------|------|
| **暴走検知** | 1時間10タスク超過でpause 30分 → COO報告 |
| **コスト閾値** | 月次LLMコール累積 $5超過 → cost_alertフラグ |
| **開発停止ゼロ** | 全エラーをcatch → ログ記録して自動継続 |
| **Vision Check** | coo_assignedタスク完了時にWHITEPAPER整合性評価 |
| **Browser QA** | browser_check_urls指定時にHTML→Gemini品質評価 |

---

## 🔁 セッション開始時の自動チェック

`/checkin` 実行時に以下を自動確認:
```bash
docker ps --filter "name=daemon_core" | grep Running
```
- **Running** → 未完了タスクがあれば Task Bridge でDaemon Coreへ積む
- **停止中** → `docker-compose up -d` してから積む
- **起動失敗** → Antigravity Core が直接処理、後でインシデント記録

---

## 判断フローチャート

```
ユーザー指示
     │
     ▼
要件をファイルで渡せる？
  ├─ NO  → Antigravity Core が直接実装
  └─ YES → Daemon Core は起動中？
               ├─ NO  → docker-compose up -d → Task Bridge で委譲
               └─ YES → Task Bridge でキュー積み (priority=coo_assigned)
                              ↓
                         Daemon Core が自律実行
                              ↓
                         quality_gates → Vision Check → Browser QA
                              ↓
                         PASS → Antigravity Core が Git push
```

---

## 🔑 シークレット管理

| 現在 | 将来（op service account導入後） |
|------|------|
| `.env` 静的ファイル（Antigravity Core が管理） | `op` service accountでDaemonが動的取得 |
| `op inject` はAntigravity Coreセッションのみ | 1Passwordでシークレット変更→Daemonに自動反映 |

**費用承認対象**: op service account (月$20程度、ビジネスプラン以上)
