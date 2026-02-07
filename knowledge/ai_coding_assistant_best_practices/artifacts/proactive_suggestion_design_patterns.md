# Proactive Suggestion Design Patterns

AI アシスタントが単なる「受動的な実行機」から「能動的なパートナー」へ進化するための設計パターン。

## 1. The Design Shift: Command-Centric to Context-Driven

### Command-Centric (Traditional)
1. User identifies needs (e.g., "I should test this").
2. User remembers command (`/test`).
3. User executes command.
4. **Cognitive Load**: User manages the process.

### Context-Driven (Proactive)
1. AI monitors context (code changes, time, intent).
2. AI identifies needs (e.g., "Tests are missing for new logic").
3. AI suggests action ("Shall I add tests?").
4. User approves or rejects.
5. **Cognitive Load**: AI manages the process; User manages the decisions.

## 2. Trigger Types

| Trigger | Condition | Suggested Action |
|---------|-----------|------------------|
| **Complexity Audit** | Significant changes in single file or logic density. | `/debate deep` or `/refactor` |
| **Integrity Audit** | New features added without corresponding tests. | `/test` or `/verify` |
| **Continuity Audit** | Session elapsed > 2 hours or midnight reached. | `checkpoint` or `ship` |
| **Inactivity Audit** | No user input for 15+ minutes. | "Summary & Next Steps" |
| **Style Drift** | Detected deviation from formatting/persona rules. | "Formatting Correction" |

## 3. Interaction Principles

### 3.1 Non-Intrusive Suggestions
提案はあくまで「お伺い」であり、作業の手を止めさせてはならない。
- **Bad**: "You MUST run tests now." (Blocking)
- **Good**: "I noticed tests are missing. Should I generate them while you continue?" (Parallel/Optional)

### 3.2 Learning from Rejection
ユーザーが提案を拒否した（例：「今はいい」）場合、そのセッション内や将来の提案頻度を自動で減衰させる仕組みが必要。

### 3.3 Reference as Guidelines
ワークフローファイル（`.md`）を「ユーザーが実行するコマンド」ではなく、「AI が参照すべき運行規定（Guidelines）」として再定義する。

## 4. Implementation Logic (AUTO_TRIGGERS)

`AUTO_TRIGGERS.md` のような中央制御ファイルを用意し、以下の項目を定義する：
- **Name**: 提案の識別子
- **Conditions**: 発火条件（ファイル名、変更行数、経過時間など）
- **Prompt**: ユーザーに提示するメッセージ
- **Actions**: 承認時に実行されるコマンド群

## 6. Pattern: Autonomous Action Chain (A2C)
提案だけでなく、サードパーティ製ツール（Google Drive, Notion 等）への実アクションを AI が自律駆動するパターン。

- **Trigger**: プロジェクト完了（Bulk Export 成功）の検知。
- **Suggested Action**: 「アーカイブを実行し、Notion への登録とローカルのクリーンアップを行いますか？」
- **Mechanism**: 
    1. **MCP Bridge**: 認証済み MCP サーバー経由でのクラウド操作。
    2. **Service Delegation**: バックエンドの `ArchiveService` への API コール委譲。
- **Value**: ユーザーの「後片付け」という認知負荷をゼロにし、プロジェクトの永続性と再利用性を保証する。
