---
description: プロジェクト固有の /xx-dev コマンドを自動生成するメタワークフロー
---

# /gen-dev - Dev Command Generator

**Concept**: プロジェクトのWHITEPAPER.md + ROADMAP.md を読み込み、
そのプロジェクト専用の `/xx-dev` コマンドを自動生成する。
生成されたコマンドは**コンテキスト回帰**の起点として機能する。

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

**役割**: {{PROJECT_NAME}}の開発セッションを開始するコマンド。
WHITEPAPER → ROADMAP → マイルストーン → タスクの順でコンテキストを回復し、
正しい方向で実装に入る。

## Cross-Reference

```
/{{COMMAND_NAME}} → WHITEPAPER.md 参照 → ROADMAP.md 参照 → /go "タスク"
/whitepaper で生成された Whitepaper-Driven Development の実行コマンド
```

---

## Phase 0: Context Recovery（コンテキスト回帰）

**目的**: プロジェクトの全体像を把握し、正しい方向で作業開始する。

// turbo-all

### 0-1. WHITEPAPER.md 熟読
```bash
cat WHITEPAPER.md
```

以下を把握:
- プロジェクトのビジョン・存在意義
- アーキテクチャ設計原則
- 技術スタック
- 差別化ポイント

### 0-2. ROADMAP.md 精読
```bash
cat ROADMAP.md
```

以下を把握:
- 全マイルストーンの一覧と進捗
- 現在のマイルストーンと完了条件

### 0-2.5. MILESTONE.md 確認
```bash
cat MILESTONE.md
```

以下を把握:
- 現在MSの詳細タスクリスト
- タスクの依存関係

### 0-3. PROJECT_STATE.md 確認（存在する場合）
```bash
cat PROJECT_STATE.md 2>/dev/null || echo "PROJECT_STATE.md not found"
```

以下を把握:
- 現在のブランチ・Worktree状態
- 前回セッションの継続タスク

### 0-4. コンテキストサマリー出力

```markdown
📋 {{PROJECT_NAME}} Context Recovery

**ビジョン**: [WHITEPAPER要約1行]
**設計原則**: [Priority Weights等]
**現在のMS**: MS[N.M] — [名前]（戦闘力 X→Y）
**MS完了条件**: [条件]
**残タスク**: [N]件
**前回の作業**: [最後のコミット or NEXT_SESSION.md]
```

---

## Phase 1: Task Selection（タスク選択）

**目的**: 次に取り組むべきタスクを特定し、ユーザーに提案する。

### 選択基準（優先順）

1. **前回の継続タスク**（NEXT_SESSION.md / PROJECT_STATE.md）
2. **依存関係が解消済みのタスク**（ROADMAP.md の依存列参照）
3. **工数「小」のタスク**を優先（モメンタム確保）
4. **ブロッカーがないタスク**

### 提案フォーマット

```markdown
🎯 推奨タスク

1. **[タスクID] [タスク名]** — 工数: [小/中/大], 依存: [なし/解消済]
   理由: [選択理由]

2. **[タスクID] [タスク名]** — 工数: [小/中/大]
   理由: [選択理由]

どのタスクに取り組みますか？（番号 or 自由入力）
```

---

## Phase 2: Implementation（→ /go chain）

ユーザーが選択したタスクで実装開始:

```
/go "タスク名"
  → /work → /new-feature or /bug-fix or /refactor
  → /verify --quick
```

---

## Phase 3: Milestone Check（MS品質ゲート）

タスク完了時にマイルストーン完了条件をチェック:

### 3-1. 完了条件確認
ROADMAP.md のMS完了条件と照合。全条件を満たしているか？

### 3-2. MS品質ゲート（全条件満たした場合）

```
/test-evolve full
```

| チェック | 合格条件 |
|---------|---------|
| Test Quality Score | **≥ A (85/100)** |
| ミュータント殺傷率 | **≥ 90%** |
| Critical ギャップ | = 0 |

### 3-3. ROADMAP.md 更新

MS完了時:
- ROADMAP.md のタスクに ✅ マークを付ける
- 戦闘力スコアを更新
- 次のMSへの遷移を記録

```markdown
✅ MS[N.M] 完了 — [日時]
戦闘力: X → Y
Test Quality Score: [Grade] ([Score]/100)
```

### 3-4. 次のMSへ

未完了MSがあれば Phase 1 に戻る。
全MS完了 → `/ship` を提案。
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
