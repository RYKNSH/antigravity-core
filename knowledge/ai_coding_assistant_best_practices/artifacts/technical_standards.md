# Technical Standards & Security

## 1. Absolute Type Safety
- **Rule**: "Strictly prohibit the use of `any`. Use generics or narrow types. If a type is unknown, use `unknown` and perform type guards."
- **Check**: "Always run a type-check (e.g., `tsc --noEmit`) before proposing complex refactors."

## 2. Dependency Hygiene
- **Rule**: "Before adding any new dependency, double-check if existing utilities can solve the problem. Favor standard libraries."
- **Prompt**: "Always use the latest stable versions mentioned in the `package.json` or project documentation."

## 3. Security (PII & Secrets)
- **Rule**: "Never output API keys, secrets, or PII (Personally Identifiable Information) in chat or in files. Use environment variables defined in `.env.example`."
- **Path Traversal**: "Ensure any file operations are scoped within the project directory. Prevent path traversal attacks by validating input paths."

## 4. Performance Patterns
- **React**: "Favor Server Components. Use `use` client directive only when necessary. Implement proper `Suspense` boundaries."
- **Database**: "Ensure all queries use indexes. Avoid N+1 problems by using batching or `include`/`join` properly."

## 5. First Principles Engineering
- **Rule**: "If a solution seems overly complex, re-evaluate from First Principles. Can we eliminate the requirement or simplify the system limits?"

## 6. High-Autonomy Command Execution
- **Interactive Prompts**: "When executing tools that generate interactive CLI prompts (e.g., `drizzle-kit push`, `npm init`), carefully review the options. Default actions in these tools can often be destructive (renaming/dropping tables). Always favor safe, non-destructive choices (e.g., 'create') in shared environments."
- **Background Tasks**: "Monitor full logs of background tasks. A 'Ready' status in the CLI dashboard is the only valid proof of success; do not rely on a lack of immediate exit errors."

## 7. Resource Awareness (Antigravity Platform)
### C. Atomic Commits
In high-autonomy sessions, perform atomic commits for major feature completions. This provides a "save point" for the user if the agent enters a regression loop.

### D. Shell Environment Awareness
When executing CLI commands (especially via background agents), do not assume common binaries (node, pnpm, rustc) are in the `PATH`. Proactively verify or use absolute paths for critical system tools.
- **Error: "Agent terminated due to error"**: This is often caused by memory pressure or concurrent session load.
- **Rule**: If `Load Average` is > 5 or physical memory is near zero, consolidate tasks into smaller sessions.
- **Hygiene**: Proactively check for massive `browser_recordings` if stability decreases. Use `find ~/.gemini/antigravity/browser_recordings -type f -mtime +7 -delete` as a recovery measure.
- **Context Management**: Avoid excessive `view_file` calls for large files (>1000 lines) within long-running sessions to prevent context bloat and termination.

## 8. Intent Resolution & Global Command Awareness
- **Ambiguity Check**: Brief commands (e.g., "記事配信", "チェックアウト") should be checked against existing Global Slash Commands (`/publish`, `/checkout`) before assuming a request to "build a new system".
- **Hallucination Prevention**: If a request is minimal and the current directory is empty, proactively search the Knowledge Base (especially `slash_commands.md`) to see if it's an invocation of an existing workflow or skill.
- **Workflow Fallback Rule**: "If a specific workflow file (e.g., `.agent/workflows/checkin.md`) is requested but not found in the local repository, do not fail. Proactively search the Knowledge Base for the standard protocol (e.g., in `antigravity_portable_dev_ecosystem` or `ai_coding_assistant_best_practices`) and execute the standard Phase 1-5 steps to ensure environment hygiene and context recovery."
- **Confirmation**: If intent is still unclear, ask for clarification instead of immediately generating large-scale implementation plans for a new project.
## 9. Atomic Refactoring & Dead Code Purging
- **Rule**: "When refactoring or moving complex logic (e.g., implementing windowing/chunking), ensure the old code paths and duplicate method definitions are physically deleted, not just commented out or bypassed."
- **Strategic Dependency Assessment**: "When refactoring to resolve build errors or technical debt, proactively assess whether a complex dependency (e.g., Remotion, heavy ML libraries) is still necessary. If the core problem can be solved with lightweight alternatives (e.g., standard FFmpeg, simple Canvas), favor simplification to improve environment hygiene."
- **Verification**: "Proactively use static checks (e.g., `python -m py_compile` or `ruff`) after major structural edits to identify duplicate definitions or unreachable code."

## 10. Multi-line Replacement Integrity & Recovery
47: - **Corruptive Squashing**: Code-replacement tools can occasionally fail when handling complex multi-line blocks, resulting in "squashed" lines where actual newlines are replaced by literal `\n` character combinations. This leads to immediate `SyntaxError`.
48: - **Prevention**: "Avoid replacing extremely large blocks (e.g., >50 lines) in a single chunk. Break refactors into smaller, verifiable changes."
49: - **Recovery (String Surgery)**: If a file is corrupted by literal `\n` or `\\n` escaping, standard regex-based replacement tools often fail to match the target. Perform "String Surgery" using a one-off Python script to read the raw content and perform exact string replacement:
50:   ```python
51:   # Example Recovery Script
52:   with open('file.py', 'r') as f: content = f.read()
53:   # Search for literal escape sequence
54:   broken = "original_v.append(...)n            original_a.append(...)"
55:   if broken in content:
56:       content = content.replace(broken, fixed_multiline_string)
57:       with open('file.py', 'w') as f: f.write(content)
58:   ```
59: - **Sanity Check**: "Never proceed to the next task until the `SyntaxError` or `ModuleNotFoundError` introduced by a refactor is resolved. A corrupted file in the foundation will invalidate all subsequent analysis."

## 11. Modular Rule Configuration (Specialist Agents)
In high-performance assistant setups, modularize rules to maximize context efficiency:
- **Specialist Agents**: Define virtual personas (Planner, Architect, TDD Guide) with scoped toolsets.
- **Domain-Specific Rules**: Categorize guidelines into separate files (e.g., `security.md`, `performance.md`) to be activated based on file paths or task contexts.
- **Contextual MDC Triggers**: Use `.mdc` files or path-based triggers to ensure the agent only consumes rules relevant to the current file.

## 12. Multi-Persona Debate Pattern
For complex designs or environment-sensitive tasks, simulate a panel of experts before implementation:
- **Roles**: Architect (System design), DevOps (Environment/ExFAT stability), Security (Vulnerability/Isolation), Skeptic (Simplicity/Alternatives).
- **Workflow**: Generate a solo draft, subject it to persona critique, and synthesize the results into a final ڈیزائن.
- **Result**: Proved superior in Feb 2026 experiments for uncovering OS-specific "unknown unknowns" (e.g., ExFATリソースフォーク issues) and mandatory security permissions.

## 13. High-Fidelity Interaction & Hydration Stability

Next.js 等の SSR (Server-Side Rendering) 環境において、UI インタラクションが「無反応」になるサイレント・フェイラー（Silent Failure）の防止と修正に関する標準。

### A. Hydration Gap Analysis
- **Symptom**: ボタンにホバー効果（CSS）があり、他の要素に覆われていない（Hit-testing 正常）にもかかわらず、React の `onClick` ハンドラが発火しない。
- **Cause**: `Hydration Mismatch`（サーバー側とクライアント側の初期 HTML 不一致）が発生すると、React はコンポーネントのハイドレーションを停止、または一部のイベントリスナーのアタッチをスキップすることがあります。
- **Rule**: UI の無反応を検知した際は、単なる `z-index` 不備やイベントのバブリング停止を疑う前に、ブラウザコンソールでハイドレーション警告を確認し、**「ログ付きハンドラ」**を注入してハイドレーションの導通を強制的に検証すること。

### B. Controlled Interaction Verification
- **Atomic Logs**: 全ての重要なハンドラ (`handleApprove`, `handleReject`, `onSave`) の冒頭に、識別可能な絵文字付きログ (`🔥`) を挿入し、ビルド後のクライアント側での接続を 100% 証明します。
- **Browser Hooking**: 自動化テスト中、`confirm()` や `alert()` などのネイティブダイアログがハングの原因になる場合は、`window.confirm = () => true` のように JS インジェクションで振る舞いを固定し、API 呼び出しフェーズへの到達を確実に検証します。

## 14. Rule Modularization (Rule-splitting Pattern)
エージェントへの指示（Global Rules）の肥大化を防ぎ、コンテキスト効率を最大化するための設計。
- **GEMINI.md Minimization**: メインのルールファイルは 20行以下に抑え、具体的な技術標準、禁止事項、エイリアスのみに限定する。
- **External Module Reference**: 詳細な実装ガイドラインや環境固有の設定は、個別の `.md` ファイル（例: `code-standards.md`, `compaction.md`, `safe-commands.md`）に分離し、必要に応じて `@import` やパス参照で読み込ませる。
- **Discovery delegation**: 固定のリソース一覧（ワークフローやスキルのリスト）をルールに含めず、`list_resources.sh` 等のスクリプトによる動的生成に委譲する。

## 15. Safe Command Whitelist (Autonomous Execution)
検証作業のオーバーヘッドを削減するため、承認なしで実行可能な「安全なコマンド」を定義する。
- **Whitelist Categories**:
    - **Read-only**: `ls`, `grep`, `cat`, `git diff`, `df -h` 等。
    - **Safe Verification**: `pnpm lint`, `pnpm typecheck`, `vitest` 等の非破壊的なツール。
- **Danger Policy**: `--dangerously-skip-permissions` や破壊的コマンド（`rm -rf` 等）は常に手動承認を要求し、ルール内でホワイトリスト外であることを明示する。

