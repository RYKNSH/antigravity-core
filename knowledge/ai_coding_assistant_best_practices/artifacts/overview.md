# AI Coding Assistant Best Practices & Global Rules

## Overview
This KI captures the "Ideal State" for AI pair programming configurations, specifically focusing on Global Rules (e.g., `.cursorrules`, `GEMINI.md`) and context-aware rules (`.mdc` files). It synthesizes research from top GitHub repositories and developer communities to provide a "最強" (strongest) framework for AI orchestration.

## Key Insights
1. **Modularization over Monolith**: Splitting rules into global base rules and task-specific `.mdc` files (Next.js, UI, Test) prevents context confusion.
2. **Noise Reduction**: Explicitly banning common AI "chatter" (apologies, unnecessary summaries) increases developer velocity.
3. **Self-Correction Loop**: Updating rules in real-time when the AI makes a mistake ensures the system "learns" project-specific constraints.
4. **Vibe Coding Patterns**: Using high-level visions while keeping technical constraints strict (e.g., "Always use `uv`", "Ban `any` type").

## 1. Rules Structure & Categories
To achieve the "strongest" ruleset, organization must be hierarchical and intention-clear.

### Global Base Rules (`.cursorrules` / `GEMINI.md`)
These are always active and define the AI's "personality" and baseline knowledge.

| Layer | Focus | Example |
| :--- | :--- | :--- |
| **Identity** | Professionalism & Clarity | "Expert Full-stack Engineer. Concise, efficient." |
| **Noise Control** | Reducing Loquacity | "No apologies. No summaries of changes." |
| **Tech Stack** | Primary Tools | "Next.js 15, TypeScript, Tailwind 4." |
| **File Handling** | Workflow Ethics | "Plan first. Edit whole blocks. Verify imports." |
| **Interaction** | Workflow Triggers | "Map natural language aliases (e.g., 'Breaktime') to slash commands." |

### Context-Aware Rules (`.mdc` / Markdown Context)
Modern AI assistants (like Cursor) use `.mdc` files with YAML front-matter to apply rules only when relevant. Recommended categories include `nextjs.mdc`, `ui.mdc`, `test.mdc`, and `db.mdc`.

## 2. Context Management & .mdc Optimization
Managing the AI's "attention" is as important as the rules themselves.

### Using `.mdc` Files
These files allow you to provide documentation snippets to the AI only when it touches certain files.

### The "Fresh Context" Strategy
- **Practice**: Start a new chat for every new feature or major bug to prevent "Context Drift".
- **Reference Injection**: Explicitly `@` reference the `architecture.md` when starting a task.

## 3. Reference Injection & MCP
- **MCP (Model Context Protocol)**: Use MCP servers for GitHub, Slack, or local file indexing to fetch the latest state.

## References
- PatrickJS/awesome-cursorrules (Star: 37k+)
- steipete/agent-rules (Star: 5.5k+)
- sanjeed5/awesome-cursor-rules-mdc
- Reddit: r/cursor, r/ClaudeAI, r/ChatGPTCoding
