---
description: プロジェクトのWHITEPAPERからROADMAP→MILESTONES→TASKSを自動生成する。新規子会社セットアップ時や大幅な計画変更時に使用。
---

# /gen-dev - Dev Command Generator

**Concept**: ディベートが完了した後に実行する。以下を**全て自動生成**する：

1. **WHITEPAPER.md** — ディベート成果を統合した経営設計書
2. **ROADMAP.md** — Phase構成と時系列
3. **MILESTONES.md** — 各Phaseの検証可能な完了条件（Mermaid依存関係図付き）
4. **TASKS.md** — マイルストーンを1セッション以内の粒度に分解
5. **`/xx-dev` ワークフロー** — そのプロジェクト専用の開発セッション開始コマンド

## Cross-Reference

```
/whitepaper Phase 5 → /gen-dev（自動呼び出し）
/gen-dev → [project]/.agent/workflows/xx-dev.md（生成）
/xx-dev → WHITEPAPER → ROADMAP → /go "タスク" → /verify
```

---

## 使用方法

```bash
/gen-dev                    # 自動でプロジェクト名からコマンド名決定
/gen-dev --name "ada-dev"   # コマンド名を明示指定
```

---

## Step 1: プロジェクト情報収集

**⚡ アクション: 以下の情報を自動検出し、変数として保持する。**

| 変数 | 検出方法 |
|------|---------|
| `PROJECT_NAME` | package.json の name / ディレクトリ名 |
| `COMMAND_NAME` | プロジェクト名から短縮形を生成（例: Ada→ada-dev, Velie→vel-dev） |
| `PROJECT_ROOT` | カレントプロジェクトの絶対パス |

WHITEPAPER.md が存在しない場合 → `/whitepaper` の実行を提案して終了。

---

## Step 2: テンプレート生成

**⚡ アクション: 以下のテンプレートの `{{PROJECT_NAME}}` と `{{COMMAND_NAME}}` を Step 1 で検出した値に置換し、ファイル内容を準備する。**

> [!IMPORTANT]
> テンプレート内のプレースホルダーを必ず実際の値に置換すること:
> - `{{PROJECT_NAME}}` → Step 1 で検出したプロジェクト名
> - `{{COMMAND_NAME}}` → Step 1 で決定したコマンド名

````markdown
---
description: {{PROJECT_NAME}}開発セッション開始時の定型フロー。WHITEPAPER.mdを参照し指向性を確認してから開発に入る。
---

# /{{COMMAND_NAME}} — {{PROJECT_NAME}} Dev Session

// turbo-all

## 1. 前回のコンテキスト復元
- `~/.antigravity/NEXT_SESSION.md` があれば読み込む
- `git log -n 5 --oneline`

## 2. プロジェクトの現在地を把握
- `[親プロジェクトの company_directory.md]` — 全社の最新ステータス（子会社の場合）

## 3. 判断の軸をロード
- `{{PROJECT_ROOT}}/WHITEPAPER.md` — ビジョン・ミッション・アーキテクチャの確認

## 4. 今のPhaseと進行中のマイルストーン確認
- `{{PROJECT_ROOT}}/docs/ROADMAP.md` — 現在のPhaseと責務を確認
- `{{PROJECT_ROOT}}/docs/MILESTONES.md` — 進行中(🔶)のマイルストーンと完了条件を特定

## 5. 今日のタスク選定
- `{{PROJECT_ROOT}}/docs/TASKS.md` の「今すぐ着手可能なタスク」から優先度の高いタスクを提案する

選択基準（優先順）:
1. **前回の継続タスク**（NEXT_SESSION.md）
2. **依存関係が解消済みのタスク**
3. **工数「小」のタスク**（モメンタム確保）

## 6. Boundary Protocol 確認
- ✅ 担当ディレクトリ: `{{PROJECT_ROOT}}/`
- ❌ 禁止: 他コンポーネントのコード修正 / 共有基盤の変更

## 7. 実行開始
ユーザーの承認を得たら `/go` で実行開始。

---

### 参照用ドキュメント（必要な時のみ）
| ファイル | いつ読む |
|---------|---------|
| `WHITEPAPER.md` | 戦略の根拠を確認したい時 |
| Architecture系ドキュメント | システム設計に触る時 |
````

---

## Step 3: ファイル出力

> [!CAUTION]
> **このステップが最も重要。必ず `write_to_file` ツールを使ってファイルを実際に作成すること。**
> テンプレートを読んだだけで完了としてはならない。

**⚡ アクション: `write_to_file` ツールで以下のファイルを作成する。**

| 項目 | 値 |
|------|---|
| **出力先** | `{{PROJECT_ROOT}}/.agent/workflows/{{COMMAND_NAME}}.md` |
| **内容** | Step 2 でプレースホルダーを置換済みのテンプレート |
| **ディレクトリ** | `.agent/workflows/` が存在しない場合は自動作成される |

```
write_to_file ツールの引数:
  TargetFile: "{{PROJECT_ROOT}}/.agent/workflows/{{COMMAND_NAME}}.md"
  CodeContent: [Step 2 で置換済みテンプレートの全文]
```

---

## Step 4: ワークフローリスト登録

`/gen-dev` 完了後、以下を通知:

```markdown
✅ /{{COMMAND_NAME}} を生成しました

**ファイル**: {{PROJECT_ROOT}}/.agent/workflows/{{COMMAND_NAME}}.md
**使用方法**: /{{COMMAND_NAME}} でセッション開始

このコマンドは以下を自動実行します:
1. WHITEPAPER.md の熟読（ビジョン把握）
2. ROADMAP.md の精読（進捗把握）
3. タスク選択の提案
4. /go → 実装 → /verify
5. マイルストーン品質ゲート（/test-evolve full）
```

---

## 完了条件

| 成果物 | 状態 |
|--------|------|
| `/xx-dev` ワークフローファイル | **`write_to_file` でファイルが実際に作成されている** |
| ユーザーへの通知 | 完了 |

## エラー時

| 状況 | 対応 |
|------|------|
| WHITEPAPER.md 不在 | `/whitepaper` の実行を提案 |
| ROADMAP.md 不在 | `/whitepaper` Phase 3 の実行を提案 |
| `.agent/workflows/` 作成失敗 | エラー報告 + 手動作成手順提示 |
| コマンド名衝突 | ユーザーに代替名を確認 |
