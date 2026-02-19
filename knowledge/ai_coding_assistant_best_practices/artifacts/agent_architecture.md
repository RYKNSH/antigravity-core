# AI Assistant Architecture & Orchestration

This document consolidates high-fidelity orchestration patterns for specialized AI assistants, focusing on context efficiency, multi-agent reasoning, and evolutionary quality control.

---

## 1. Modular Configuration Patterns
Inspired by high-performance assistant setups, this pattern emphasizes modularity to maximize context efficiency and specialized reasoning.

### 1.1 Specialist Agent Definitions
Rather than a single monolithic system prompt, define virtual "Specialists" for specific tasks:
- **Planner**: Requirement analysis, task breakdown, dependency mapping.
- **Architect**: System design, database schema, long-term scaling.
- **TDD Guide**: Enforces Red-Green-Refactor cycles and test coverage.
- **Security Reviewer**: Vulnerability detection, secret management, input validation.

### 1.2 Categorized Rule Files
Break down global rules into domain-specific modules (e.g., `.mdc` or `.antigravity/agent/rules/`):
- `security.rules.md`: Passwords, API keys, and injection vulnerabilities.
- `performance.rules.md`: Caching, index optimization, and bundle size.
- `coding-style.rules.md`: Naming conventions, linting, and directory structure.

### 1.3 Context-Aware Activation
Use triggers to activate specific sets:
- **UI Specialists**: Activated for `src/components/*`.
- **Backend Specialists**: Activated for `src/api/*` or `database/`.
- **Deployment Specialists**: Triggered for `docker-compose.yml` or CI/CD config changes.

---

## 2. Multi-Persona Debate Pattern
A high-fidelity verification methodology where the AI assistant simulates a panel of experts before finalizing implementation.

### 2.1 The Debate Loop
Sequential critique-and-refine cycle:
1. **Initial Proposal**: Assistant generates a "Solo" solution.
2. **Persona Assembly**: Experts are recruited based on the task (DevOps, Security, UX).
3. **Sequential Critique**: Each persona reviews through their lens.
4. **Synthesis**: Consolidate feedback into a robust final design.

### 2.2 Core Expert Personas
- **The Architect**: Scalability, clean boundaries, system integrity. (Registered as Intern, 2026-02-04)
- **The Security Specialist**: Permission risks, secret exposure. (Registered as Intern, 2026-02-04)
- **The Skeptic**: (Core/Regular) Always active in standard /debate sessions. Challenges assumptions.

### 2.3 Agent Teams Thinking Model (Simulated Parallelism)
Implemented in 2026-02-06, this pattern adapts the [Claude Code Agent Teams](https://code.claude.com/docs/ja/agent-teams) (physical parallel sessions) to a single-session environment using a "Thinking Model."

#### Execution Protocol (`/debate team`)
1. **Leader (HR Director)**: Analyzes the task and recruits a 3-persona team (e.g., Security + Performance + Test).
2. **Round 0: Initial Findings**: Each persona independently submits their findings to `DEBATE_FINDINGS.md`.
3. **Round 1-N: Mutual Argument Loop (The Core)**:
    - Personas review each other's claims.
    - **Dynamics**: Disproving assumptions, highlighting trade-offs, making concessions, or reinforcing valid points.
    - **Rules (The 4 Pillars)**:
        1. **Always Argue**: Don't just agree; must proactively look for weaknesses or alternative viewpoints.
        2. **Provide Evidence**: Every claim must be supported by specific code examples, logs, or documentation.
        3. **Sincere Concession**: Acknowledge valid counter-arguments and adjust viewpoints if the evidence warrants it.
        4. **Aim for Consensus**: The goal is not winning the argument, but converging on the optimal 120% solution.
4. **Phase 4: Consensus Building**: The leader (HR Director) synthesizes all rounds into a final report, marking "Points of Agreement" and "Remaining Concerns."

#### Team Contribution Scoring (Reward Shaping)
To incentivize high-fidelity team behavior, a specialized scoring system is used:
| Action | Score |
|-----------|--------|
| **RED Finding (Critical Issue discovered)** | +5 |
| **YELLOW Finding (Warning discovered)** | +2 |
| **Synergy (Building on/improving others' points)** | +3 |
| **Counter-evidence (Disproving a flaw)** | +4 |
| **Synthesis Contribution** | +2 |

This ensures personas focus on finding unique risks and collaborating on a consolidated output rather than repeating the same "Architectural" generic advice.

---

## 3. Current Agent Roster (as of 2026-02-04)

The Persona Orchestration system maintains defined profiles in `.antigravity/agent/skills/persona-orchestration/personas/`.

| Rank | Persona | Primary Focus | Status |
|------|---------|---------------|--------|
| **Core** | **HR Director** | Team assembly, 5-axis analysis | Pre-configured |
| **Regular** | **The Skeptic** | Critical challenge, anti-bias | Permanent Skill |
| **Intern** | **Storyteller** | Metaphors, narrative-driven technical writing | Registered |
| **Intern** | **Empathy Coach** | User alignment, emotional resonance | Registered |
| **Intern** | **Closer** | Actionability, CTA optimization | Registered |
| **Intern** | **The Architect** | Structural integrity, 3-year vision | Registered (2026-02-04) |
| **Intern** | **Security Specialist** | Risk mitigation, least privilege | Registered (2026-02-04) |
| **Intern** | **Bug Hunter** | Error analysis, debugging (FBL) | Registered (2026-02-04) |
| **Intern** | **Browser Inspector** | Visual verification, UX audit (FBL) | Registered (2026-02-04) |
| **Intern** | **Full-Stack Verifier** | DB/API/E2E Data flow (FBL) | Registered (2026-02-04) |

---

## 4. Vision Audit Pattern: Human-Centric Fidelity
A verification pattern specifically for media pipelines and UI products. It bridges the gap between technical "Job Success" (200 OK) and qualitative "UX Integrity."

### 4.1 The Principle: Trust Pixels, Not Logs
Internal statuses (e.g., "Rendering 100%") often mask regressions:
- **Aspect Ratio Distortion**: Stretched/squashed media due to filter conflicts.
- **Compositional Drift**: Centering vs. Alignment mismatches (e.g., video centered when design requires upper-alignment).
- **Style Dropouts**: Missing fonts or default color fallbacks.
- **Layer Masking**: Burned-in "ghost text" in source assets or incorrect render order masking dynamic content.
- **Contract Integrity**: Silent backend failures (500 errors) during approval flows that prevent pixel output entirely due to schema mismatches.

### 4.2 Implementation (The /v (Vision) Loop)
- **Pixel Sampling**: Capture screenshots at specific milestones (0s, 5s, 10s).
- **Direct Verification**: Access raw output via browser subagents.
- **Audit Checklist**: Verify proportions, contrast, and style consistency. Check console logs and server responses for **Contract Integrity** (ensuring the logic correctly accesses data attributes).

---

## 5. Persona Orchestration & Darwinian Evolution
A framework to manage AI personas based on their real-world contribution.

### 5.1 Persona Hierarchy (The Path to Regularization)
- **Intern**: Newcomer generated ad-hoc or for the first time. Profile exists but is not yet a "Skill."
- **Regular**: Stable contributor with **3+ session adoptions**. Promoted to a permanent skill artifact.
- **Core**: Mission-critical intelligence (e.g., Skeptic, Architect) that is **default-active** in most debates.
- **Graveyard**: Retired profiles that failed to adapt or were superseded.

### 5.2 Contribution Score (Persona Darwinism)
Automatic and user-driven scoring to determine survival:
- **Major Adoption**: +5 (A recommendation that leads to a significant refactor).
- **Minor Adoption**: +2 (A suggestion that improves wording or adds a specific check).
- **Narrative/Analogy Adoption**: +3 (A specific metaphor or story that makes it to the final blog).
- **User Praise**: +10.
- **Direct User Dismissal**: Immediate demotion or "Firing" (-20).

### 5.3 The HR Director (Meta-Persona)
Automates the team assembly using **5-axis Task Analysis**:

| Axis | Analysis Item | Description |
|------|---------------|-------------|
| **Target** | Audience | technical level (Beginner vs. Expert) |
| **Risk** | Impact | Impact of failure (High Risk = Security/Infrastructure; Low Risk = Engagement/Quality) |
| **Emotion** | Resilience/Connection | Narrative requirement (High = Storyteller/Empathy Coach required) |
| **Action** | Goal orientation | Clarity of next steps (Need for a 'Closer' or 'Pragmatist') |
| **Domain** | Expertise | Specific domain knowledge (Media, DB, Music, etc.) |

**Mandatory Logic**: Minimum 3 personas + The Skeptic are always included in a `/debate deep` session.

---

## 6. Integrated Claude Code Patterns (Terminal-First Autonomy)
Patterns adapted from official [Claude Code Best Practices](https://code.claude.com/docs/ja/best-practices).

### 6.1 Project Intelligence (`CLAUDE.md`)
- **Standard**: Every Antigravity project should have (or sync) a `CLAUDE.md` in the root for environment-specific command mapping (Build/Test/Lint).
- **Adaptation**: Use `/checkin` to ensure assistant-ready command registries (e.g. `GEMINI.md`) are hydrated.

### 6.2 Interactive Discovery (User Interviews)
- **Principle**: "Interview the User" (Claude にあなたにインタビューさせる).
- **Pattern**: When tasks reach 7/10 complexity or structural ambiguity, personas must shift from "Suggesting" to "Interviewing" to refine the reference frame before implementation.

### 6.3 Antigravity Innovations (ROADMAP 2026-02-06)
- **GEMINI.md Minimization**: Modularizing rules into `@import` files and offloading discovery to scripts.
- **Compaction Resilience**: Instruction to explicitly preserve "Modified Files" and "Error/Resolution History" during context compaction.
- **Safe Command Whitelist**: Automated approval for non-destructive commands (`lint`, `test`, `status`, `diff`).

### 6.4 High-Fidelity Checkpoints
- **Strategy**: Before significant refactors, create a Git-based restore point.
- **Protocol**: `git commit -m "checkpoint: pre-refactor"` followed by `git checkout .` on regression.

### 6.5 Specialized Subagents (Implemented 2026-02-06)
Beyond global personas, Antigravity uses file-based Subagent definitions for targeted deep-dives:
- **`security-reviewer`**: A senior security engineer persona.
    - **Checks**: Injection (SQL/XSS/Command), Auth flaws, Secrets (hardcoded keys), Insecure data handling (unencrypted storage).
    - **Format**: Severity (Critical to Info), File/Line table, Detailed mitigation.
- **`pattern-checker`**: A senior architect persona.
    - **Checks**: Naming conventions (kebab-case/camelCase), Directory structure (Barrels/Index), API Design (RESTful/Paging), Error handling (Custom classes).
    - **Format**: Fidelity score (✅ Total Match / ⚠️ Minor / ❌ Deviation), Recommendation list.
- **Usage**: Invoked via `use [subagent] subagent to review [target]`.

---

## 7. Case Studies in Evolutionary Orchestration

#### The Skeptic's Promotion (2026-02-02)
In February 2026 experiments, the **Skeptic** persona was promoted to **Regular** after maintaining a **100% adoption rate** across 4 diverse sessions. Its consistent ability to identify "unknown unknowns" proved indispensable for high-fidelity output.

- **Outcome (Phase 1)**: 初期議論に基づきスタイルマッピングとシリアライズ不備を修正。エージェントは「解決」と判断。
- **Verification Failure (Feb 2026)**: ユーザーから「変化なし」と報告を受け、エージェント側の Positive Bias が露呈。
- **Phase 2: Live Verification**: `browser_subagent` による実機検証と FFmpeg ログの再精査の結果、プレビュー（React/CSS）は White なのにレンダラー（FFmpeg/drawtext）は依然として Orange を出力しているという **Visual Conflict** を客観的事実として捕捉。
- **Phase 3: Deep Root Cause**: ログとコードの乖離を追跡した結果、`renderer.py` における **First-Item Bias**（配列の先頭インデックス 0 を固定参照している問題）を発見。修正済みのはずのスタイル同期が機能していなかった「真の理由」を特定した。
- **Phase 4: Persistence Paradox Discovery**: さらに `browser_subagent` で「Approve ボタン押下直後のリセット」をリアルタイム監視。送信される API ボディに `telop_config`（スタイル）はあるが、編集された `segments`（テキスト内容）が欠落していることを特定。
- **Lesson**: ログ上の「成功」は「価値の提供」を意味しない。真の解決には、ブラウザレベルでの **Closing the Loop**（実データ送信の監視と実体験の検証）が不可欠である。

#### strategic Meta-Planning (2026-02-03)
A session used `/debate deep` to analyze project-wide progress for blog theme extraction, demonstrating orchestration's effectiveness for high-level strategy.

#### Global Environment Design Upgrade (2026-02-06)
A `/debate deep` session was conducted to overhaul the global ecosystem. HR Director analyzed the task and assembled a 5-persona team: **The Architect, Security Specialist, The Skeptic, DevOps Engineer, and Knowledge Curator**. This "Expert Panel" configuration proved highly effective in identifying hidden risks in secrets management (Pattern 172-177) and infrastructure bloat (Pattern 178), leading to the implementation of automated usage tracking and dynamic resource discovery. This session solidified the **5-Persona Roster** as the Gold Standard for mission-critical architectural decisions.

#### Claude Code Deep Reading & Innovation (2026-02-06)
Integrated official best practices for terminal-based assistants into the Antigravity core. This introduced **Interactive Discovery (Interview Pattern)** and **CLAUDE.md Command Registry** as standard global environment components, further bridging the gap between autonomous execution and developer intent.

---

## 8. High-Fidelity UX: The 1.5-Command Principle

2026-02-06 の `/debate deep` で定義された、AI アシスタントのための究極の操作体系デザイン。

### 8.1 構造的認知負荷の分離
- **Intrinsic Load (本質的負荷)**: 「今どのフェーズ（実装か検証か）にいるか」という開発者の意識。これは品質維持に必要であり、AI が勝手に進めすぎると「制御喪失感」を生む。
- **Extrinsic Load (外在的負荷)**: コマンド名、環境セットアップ、SSD 同期などの「作業の付帯事項」。これらは開発者にとって「覚える価値のない知識」であり、AI が 100% 肩代わりすべきである。

### 8.2 1.5コマンドの実装
1. **Entry Point (1 command)**: `/go "task"`
   - 明示的な「開始儀式」により、AI とユーザーのコンテキストを同期。
   - 内部で `checkin` -> `dev` -> `work` -> `verify` を自律的に連鎖。
2. **Terminal Point (0.5 command)**: 自然言語 (Natural Language Trigger)
   - 「終わり」「また明日」といった日常語を作業終了の合図として認識。
   - AI から `/ship` (デプロイ) や `/checkout` を提案させることで、開発者の主導権（Agency）を損なわず、かつ手順の漏れを防止。

### 8.3 Command as Guidelines, AI as Proactive Agent
2026-02-06 の最終的な到達点。
- **ガイドラインとしてのコマンド**: 従来のコマンド（/work, /verify 等）を「ユーザーが叩くトリガー」ではなく、AI が自律的に参照し、適したプロセス（フェーズ）を選択するための「実行マニュアル」として再解釈。
- **自律提案 (Proactive Suggestion)**: ユーザーが「何をすべきか」を判断するのではなく、AI が状況（コンテキスト）から最適な次の一手を提案し、ユーザーは「承認/却下」のみを行う。
- **LLM ポテンシャル最大化**: LLM のパターン認識能力を「どのコマンドを提案すべきか」の判断に全振りすることで、開発者の脳を「課題の定義と設計」という高次元の活動に解放する。

---
*Updated: 2026-02-06. Refined with Proactive Suggestion & LLM potential maximization.*
