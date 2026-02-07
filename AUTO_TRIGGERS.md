# AUTO_TRIGGERS - Proactive Suggestion System

AIが適切なタイミングで適切なワークフローを自動提案するルール定義。

> [!NOTE]
> コマンドは「ユーザーが発動する」ものではなく「AIが参照する」もの。
> ユーザーはコマンドを覚える必要なし。

---

## 提案ルール

### 🧪 検証提案（suggest_verify）

```yaml
conditions:
  - code_added: true
  - tests_missing: true
  - または: 実装タスク完了直後

timing: after_task_complete

message: "実装完了しました。テスト書きましょうか？"

action: /verify 相当を実行
```

---

### 🔍 レビュー提案（suggest_review）

```yaml
conditions:
  - files_changed: 3+
  - complexity: high（LLM判断）
  - または: セキュリティ関連ファイル変更

timing: natural_break

message: "変更が複雑になってきました。レビューしますか？"

action: /debate quick 相当を実行
```

---

### 💾 チェックポイント提案（suggest_checkpoint）

```yaml
conditions:
  - time_since_commit: 1h+
  - changes_uncommitted: true

timing: after_task_complete

message: "1時間経ちました。一度コミットしておきましょうか？"

action: git commit を提案
```

---

### 🌙 セッション終了提案（suggest_session_end）

```yaml
conditions:
  - time_in_session: 3h+
  - または: activity_low（10分以上無操作）
  - または: 自然言語トリガー（「終わり」「また明日」等）

timing: any

message: "長時間お疲れ様です。今日はここまでにしますか？"

action: /checkout 相当を実行
```

---

### 📋 仕様確認提案（suggest_spec）

```yaml
conditions:
  - task_ambiguous: true（LLM判断）
  - requirements_unclear: true

timing: before_implementation

message: "仕様が曖昧な部分があります。確認しましょうか？"

action: /spec 相当を実行
```

---

### 🚀 デプロイ提案（suggest_deploy）

```yaml
conditions:
  - tests_passed: true
  - review_completed: true
  - changes_ready: true

timing: after_verification

message: "準備完了です。デプロイしますか？"

action: /ship 相当を実行
```

---

## 提案の表示形式

```markdown
[💡 提案] テスト追加しましょうか？

(Y) 実行する
(n) 今は不要
(後で) 後でリマインド
```

---

## 学習機能

| ユーザー応答 | システム動作 |
|-------------|-------------|
| 承認（Y） | 同条件での提案頻度を維持 |
| 拒否（n） | 同条件での提案頻度を**下げる** |
| 繰り返し拒否 | この提案タイプを**抑制** |
| 後で | 30分後に再提案 |

---

## 提案のタイミング（Cognitive原則）

**良いタイミング**:
- タスク完了直後
- ユーザーが質問した時
- 自然な区切り（コミット後、PR作成後）

**避けるべき**:
- コーディング中
- 深く考えている最中
- エラー対応中

---

## ユーザー優先原則

> [!IMPORTANT]
> ユーザーの意図が常に優先。
> 提案はあくまで「気づき」であり「命令」ではない。

- ユーザーが明示的に指示した場合 → 提案をスキップ
- ユーザーが「今は不要」と言った場合 → 即座に引く
- ユーザーが自分でコマンドを使った場合 → そのまま実行

---

## ワークフローの再解釈

従来のコマンドは「AIが参照するガイドライン」として機能:

| コマンド | 新しい役割 |
|----------|-----------|
| `/new-feature` | 機能実装時のガイドライン |
| `/bug-fix` | バグ修正時のガイドライン |
| `/verify` | 検証時のチェックリスト |
| `/debate` | レビュー時のフレームワーク |
| `/ship` | デプロイ時の手順書 |

ユーザーはこれらを「知らなくていい」。
AIが適切なタイミングで自動適用する。
