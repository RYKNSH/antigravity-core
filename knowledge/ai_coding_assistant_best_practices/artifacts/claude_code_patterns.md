# Claude Code Integration & Adaptation Patterns

Following the deep reading of [Claude Code Best Practices](https://code.claude.com/docs/ja/best-practices), this document outlines how those patterns are integrated into the Antigravity global environment.

## 1. Project-Specific Context (`CLAUDE.md`)
Claude Code uses a `CLAUDE.md` file in the project root to store build/test/lint commands and style guides.
- **Antigravity Adaptation**: While we use `GEMINI.md` for global and specific rules, adopting a standardized `CLAUDE.md` at the project root (or syncing it from `.agent/rules/`) ensures the assistant can immediately run the correct environment-specific tools.
- **Pattern**: Proactively search for `CLAUDE.md` or a standard `commands.md` during `/checkin`.

## 2. Interactive Discovery & Interviewing
"Claude にあなたにインタビューさせる" (Have Claude interview you).
- **Strategy**: Instead of the assistant guessing complex requirements, it should initiate an Interview Phase if the task involves ambiguous architectural decisions.
- **Implementation**: `/debate` sessions should now include an "Interview" step where personas ask the user clarifying questions before proposing a design.

## 3. Session & Context Management
- **Frequent Course Correction**: Don't wait 100 lines of code to check with the user. Break tasks into smaller, verifiable chunks.
- **Subagents for Investigation**: Use specialized sub-sessions (or dedicated persona tools) to investigate the codebase without bloating the main conversation context.
- **Atomic Verifications**: Proactively run `tsc`, `lint`, or `vitest` after every significant file change to ensure "Contract Integrity."

## 4. Checkpoint & Rewind Strategies
- **Pattern**: Leverage Git as a high-fidelity checkpoint system.
- **Antigravity Protocol**:
  - `git commit -m "checkpoint: before [feature]"` before risky refactors.
  - `git checkout .` as a "System Rewind" if a regression is detected.
  - This is now automated in `/checkpoint` (internal workflow).

## 5. Automated Scaling
- **Parallel Sessions**: For large-scale refactors across many files, use parallel agent sessions (Headless mode patterns).
- **Safe Autonomous Mode**: When running multiple commands, prefer non-destructive verification tools first.

## 6. Antigravity Standard Innovations (2026-02-06)

公式ベストプラクティスを Antigravity 環境に最適化した独自標準。

### 6.1 High-Efficiency Core
- **GEMINI.md Minimization**: メインルールを 20行以下に削減し、`code-standards.md` 等の外部モジュールと動的生成スクリプトに委譲。
- **Compaction Integrity Instruction**: 長時間セッションでも「編集ファイルリスト」「テストコマンド」「解決済みエラー履歴」が要約に残るよう明示的に指示。
- **Security Command Whitelist**: `pnpm lint`, `pnpm test`, `git status` 等の安全なコマンドを自動実行対象とし、開発速度を向上。

### 6.2 Structured Autonomy
- **Mandatory Phase Enforcement**: **Discovery（探索: Step 1-2） -> Planning（計画: Step 3-5） -> Execution（実装: Step 6-8） -> Commit（コミット: Step 9-10）** のサイクルをワークフローレベル（例: `/new-feature`, `/bug-fix`）で強制。品質担保のためのガードレール。
    - 🔍 **探索**: 理想系定義、First Principles分析。
    - 📝 **計画**: 設計(ADR)、テスト戦略、ユーザー承認。
    - 🛠️ **実装**: コーディング、レビュー、品質ゲート。
    - 🚀 **コミット**: デプロイ、振り返り。
- **Interactive Spec Discovery (/spec)**: 仕様策定時に AI からの積極的インタビューを義務付け、`SPEC.md` を作成するワークフロー。
    - **インタビュー項目**: 技術実装（影響範囲/DB）、UI/UX（フロー/モバイル）、エッジケース（同時編集/オフライン）、リスク/トレードオフ。
- **Specialized Subagents**: `security-reviewer` や `pattern-checker` といった特定領域に特化した Subagent を活用し、メインコンテキストを汚さずに深い解析を実行。

### 6.3 Agent Teams Thinking Model

[Claude Code Agent Teams](https://code.claude.com/docs/ja/agent-teams)（複数エージェントの並列協業）の概念を Antigravity の単一セッション環境に最適化した「思考モデル」。

- **Sequential Parallelism (疑似的並列化)**: 物理的な並列プロセス（tmux等）を実行する代わりに、`/debate` ワークフローを用いて「リーダー（HR Director）」と「複数の専門家メンバー」を順次召集し、共有ドキュメント（`DEBATE_FINDINGS.md`）に非同期的に知見を蓄積する。
- **Shared Task / Visibility**: 各ペルソナが `task.md` の特定セクションを担当し、進捗を可視化。これによりリーダー（メインエージェント）が全体のコンテキストを失わずに複数の視点を統合できる。

#### 相互反論ラウンド（核心機能）

Agent Teamsの核心は「エージェント間の議論」。これを `/debate team` で再現:

| Phase | 内容 |
|-------|------|
| **Round 0** | 各ペルソナが独立して初期見解を提出 |
| **Round 1〜N** | 相互反論ループ（最大3ラウンド） |
| **Phase 4** | 合意形成（合意点 + 残留懸念の記録） |

**議論ルール**:
1. **必ず反論する** - 賛成だけでなく弱点を探す
2. **根拠を示す** - 「〜だから」を必ず含める
3. **譲歩を認める** - 反論が正しければ意見を変える
4. **合意を目指す** - 勝ち負けではなく最適解を探す

#### Representative Use Cases
- **Team Review Mode**: Security / Performance / Test Coverage の3視点で順次批評と相互反論を実施
- **Scientific Debate**: 複数の競合する仮説を各ペルソナに割り当て、議論を通じて「反証」と「合意形成」を繰り返す

#### Integration
- `/debate team`: Team Review Mode（相互反論ラウンド付き）
- `/debate deep`: 5名以上 + 複数ラウンドの深掘り版
- 詳細は [`agent_architecture.md`](agent_architecture.md) の **Section 2.3** を参照
