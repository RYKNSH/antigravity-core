# Operational Hygiene & Reliability Protocol

High-autonomy agents must maintain both information integrity and workspace cleanliness to ensure long-term focus and system performance.

## 1. Information Reliability & Discovery

Agents are responsible for "Trusting User Statements and Autonomous Rediscovery."

### A. Trusting User Statements & Manifest-First Discovery
When a user says "X is provided" or "X is at path Y":
1. **Manifest Audit**: Always check the central inventory (e.g., `MANIFEST.md`) to verify the paths of global workflows, skills, and scripts.
2. **Holistic Discovery**: Scan potential locations (`.env`, `config`, `.antigravity/`) before asking for clarification.
3. **No Redundant Confirmation**: Avoid re-asking for information already present in the context or filesystem.

### B. Autonomous Restoration & Integration
- **Root-of-Trust Fallback**: Automatically check global settings (e.g., `$ANTIGRAVITY_DIR/.env` or `~/.antigravity/.env`) if local project config is missing.
- **Service Integration Integrity**:
    - **Notion**: Title normalization (stripping `#` headers) is mandatory to prevent broken search keys.
    - **Scripts**: Prefer calling scripts from the global path (`$ANTIGRAVITY_DIR/agent/scripts/`) to ensure the latest logic is used.
- **Self-Correction**: If a discrepancy exists (e.g., "7 articles expected, 1 found"), dump the internal state to the user and identify causes (e.g., Status filter: `Ready`).

## 2. Workspace Hygiene (Brain Clutter Management)

### A. Artifact Lifecycle Management
- **Temporary Visuals**: Delete `.webp` screenshots immediately after visual verification loop completes.
- **Milestone Pruning**: Delete older `.resolved.x` files once the final `task.md` or major milestone is reached.
- **Knowledge-First Extraction**: Consolidate technical insights into Knowledge Items (KIs) during wrap-up, then purge the temporary implementation logs.

### B. OS-Specific Hygiene (macOS/SSD)
- **Resource Fork Cleanup**: macOS `._*` (AppleDouble) files can corrupt Git indexes and panic Rust build engines.
    - **Prevention**: Mandatory entry in `.gitignore`.
    - **Cleanup**: `find . -name "._*" -delete`.
- **Lightweighting**: Execute the "Lightweight Operation Protocol" when high load is detected. This involves monitoring Memory Pressure and the **Compressor (CMPRS)** metric to prune swap, caches, and browser storage (see `operational_protocols.md` in the ecosystem KI for details).

## 3. API Resilience & Output Determinism

AI エージェントが大規模なデータ解析を行う際、出力の不確実性とトークン制限を管理することは、システムの安定稼働に不可欠です。

### A. Token-Budgeting Workflow
- **Symptom**: `LengthFinishReasonError` による出力の途切れ。
- **Resolution**: 
    - 解析プロンプトにおいて `max_tokens` を明示的に設定し、レスポンスの最大長を予測可能にします。
    - 1回のリクエストあたりの提案候補数（例: `max_candidates=10`）を制限し、各項目に対して十分な「思考トークン」と「構造化トークン」を割り当てます。

### B. Conciseness Injection
- **Pattern**: 大規模な JSON/Pydantic オブジェクトをパースする際、LLM が冗長な理由付けを出力すると、構造化データの途中でトークン制限に達するリスクが高まります。
- **Strategy**: プロンプトに「簡潔な応答 (Keep responses concise)」という制約を物理的に追加し、情報の密度を高めてパースエラーを防ぎます。

## 4. Continuity & Evolution: Mandatory Completion of Improvements

To prevent "stagnation" and ensure continuous agent evolution, any workflow or rule enhancements explored during a session must be formalized before checkout.

- **Rule**: If a better prompt, a new slash command, or a more efficient rule is discovered or proposed during the session, the agent **MUST** implement it (e.g., updating `.mdc` files, global rules, or `.agent/workflows`) before the final checkout.
- **Goal**: Closing the feedback loop immediately ensures that the "wisdom" gained in one session is available for the next, preventing the accumulation of "mental debt."
- **Verification**: The `/checkout` or `/fbl` workflows should include a check for these pending rule updates.

## 5. Context Compaction Integrity
長時間におよぶセッションでコンテキストウィンドウが圧縮（Compaction）される際の情報の質を保証するためのルール。
- **Mandatory Preservation**: コンパクションの要約において、以下の項目を必ず保持させる指示を `GEMINI.md` や `/compact` 指示に含める。
    1. **Modified Files**: 編集済みの全ファイルパス。
    2. **Execution Context**: 実行したテストコマンドとその結果（特にエラー）。
    3. **Resolution History**: 直面したエラーとその具体的な解決策。
- **Pruning Strategy**: 関連のない過去の探索ログや、すでに解決した初期段階の試行錯誤は積極的にパージし、最終的な解決策までのパスを強化する。

## 6. Interactive Discovery (User Interviews)
暗黙的な前提による誤った実装を防ぐため、高度な設計決定においてユーザーへのインタビューを義務化する。
- **Threshold**: 複雑度が 7/10 を超える、あるいはアーキテクチャ上のトレードオフが発生する場合、エージェントは自ら推論するのを止め、ユーザーにインタビュー（逆質問）を仕掛けるフェーズに入る。
- **Pattern**: 「Claude にあなたにインタビューさせる」パターンを用い、技術的実装、UI/UX、エッジケース、懸念事項を網羅的にヒアリングした上で `SPEC.md` を作成する。

---
*Consolidated from: Information Reliability Standard (2026-01-27) & Claude Code Best Practices (2026-02-06).*
