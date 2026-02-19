---
description: AIエージェントの自律駆動用ルーティングテーブル。全ワークフローの分岐条件・遷移先を集約。
---

# WORKFLOW ROUTER (Consolidated)

## 🏗️ Session Partitioning Model (Think/Go/Verify)

プロジェクトの状態は `PROJECT_STATE.md` で管理され、作業は `git worktree` で物理的に分離されます。

| フェーズ | コマンド | 役割 |
|---|---|---|
| **Planning** | `/think "Task"` | 計画・設計・新規Worktree/Branch作成。<br>`PROJECT_STATE.md` にタスク登録。 |
| **Execution** | `/go "Task"` | 実装・コーディング。<br>Fuzzy Matchで該当Worktreeへ移動。 |
| **Verification** | `/verify` | 品質保証 (Test + Error Sweep + UX Check)。<br>完了時に `PROJECT_STATE.md` を更新。 |
| **PR / Reporting** | `/blog` | 広報・レポート作成。<br>プロジェクト動向を把握し記事化する。 |

---

## 🧭 コマンドマッピング

### Primary Commands (The Big Four + One)
| コマンド | WF | トリガー / 備考 |
|---------|-----|----------------|
| **`/setup`** | setup.md | 「プロジェクト開始」「初期化」<br>`PROJECT_STATE.md` 生成 |
| **`/think`** | think.md | 「新しいタスク」「計画」「設計」 |
| **`/go`** | go.md | 「実装」「続きをやる」「(タスク名)」<br>Worktree自動移動 |
| **`/verify`** | verify.md | 「テスト」「検証」「確認」<br>完了としてマーク |
| **`/blog`** | blog.md | 「ブログ」「記事化」「広報」「レポート」 |

### Utility Commands
| コマンド | WF | 役割 |
|---------|-----|------|
| `/checkin` | checkin.md | 環境同期 (バックグラウンド実行推奨) |
| `/checkout` | checkout.md | セッション終了、自己評価 |
| `/worktree` | worktree.md | Worktreeの手動管理 |
| `/level` | level.md | 自律レベル変更 |
| `/evolve` | evolve.md | 自己進化・改善提案 |

### Internal / Advanced (直接呼び出し非推奨)
| コマンド | WF | 備考 |
|---------|-----|------|
| `/ship` | ship.md | `/verify` 後のデプロイ |
| `/debug-deep` | debug-deep.md | 検証失敗時のエスカレーション |
| `/galileo` | galileo.md | Deep Verification |
| `/debate` | debate.md | Review / Planning Support |
| `/_checkpoint_to_blog` | (Deprecated) | -> `/blog` に統合されました |

---

## 🔄 メインフロー

```mermaid
graph TD
    Start((Start)) --> Setup[/setup]
    Setup --> ProjectState[PROJECT_STATE.md]
    
    ProjectState --> Think[/think]
    Think -->|Add Task| ProjectState
    Think -->|New Branch| Go[/go]
    
    Go -->|Implement| Verify[/verify]
    
    Verify -->|Pass| Done(Complete/Merge)
    Done -->|Update| ProjectState
    
    Verify -->|Fail| Fix[/go]
    
    Done --> Blog[/blog]
    ProjectState --> Blog
```

## ⚡️ Parallel Execution
Fuzzy Match により、タスク名 (`login` 等) を指定するだけで適切な Worktree に移動します。

```bash
/go login  --> ../worktrees/feat-login へ移動
/go pay    --> ../worktrees/feat-payment へ移動
```

---

## 優先ルール

1.  **State Driven**: 全てのアクションは `PROJECT_STATE.md` に記録されるべきである。
2.  **Context Follows Git**: AIのコンテキストは、現在の Worktree/Branch に従う。
3.  **Quality First**: 曖昧な指示には、勝手な判断をせずユーザーに確認を求める。
