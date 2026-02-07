# Discord Buddy Product Registry

This document serves as the central directory for all specialized AI agents within the Discord Buddy ecosystem.

## 1. Server Builder (The Architect)
The **Architect** (建築家) focuses on community structure, automation, and "Instant Genesis."

- **Mission**: Automate the "Creation of the World" so that creators can start their communities instantly without fighting with permission bitfields.
- **Key Pattern**: **Persistent Learning Loop**. The agent analyzes failures/successes and stores learned rules in `public.agent_learned_rules` (Supabase).
- **Multi-tenancy**: Uses `RuleManager` for strict `guild_id` isolation, ensuring that "intelligence" gained in one server does not bleed into another.
- **Frontend**: Full Markdown support (`react-markdown`) and auto-scrolling chat in the Admin Dashboard.

## 2. Attender (The Concierge)
The **Concierge** (受付) focuses on user onboarding, LMS content delivery, and community hospitality.

- **Mission**: Guide users through private, clutter-free learning experiences.
- **Key Pattern**: **Course Unlock & Private Threads**. Creates dedicated private workspaces for users to work through assignments.
- **Backend Synergy**: Integrated with the common dashboard for lesson management and progress tracking.

## 3. Antigravity Agent (The IDE Assistant)
The **IDE Agent** is a headless product designed for deep integration with development workflows.

- **Mission**: Highly autonomous operation via CLI/MCP, serving as a reference implementation for "Immortal Agents" (long-running sessions).
- **Implementation**: Strictly follows the **Bot Sub-package Pattern** and leverages the [Server Synchronizer Engine](../architecture/server_synchronizer_engine.md). **Backend system fully implemented and stabilized as of Jan 2026.**
- **Product Features**: 
    - **Control Tower API**: Administrative endpoints (`POST /api/admin/setup`) for remote orchestration.
    - **Marketplace Pattern**: Secure server currency transactions (THEO/POINTS) using Supabase atomic updates.
    - **Webhook Unlocking**: Integrated `UnlockManager` for automated course access via external triggers (GAS).

## 4. Hype Buddy (The Orchestrator)
**Hype Buddy** focuses on community "vibe" engineering and KPI-driven autonomous interaction.

- **Mission**: Create a lively, high-energy environment by orchestrating multiple AI-driven NPCs that guide human behavior towards specific community goals.
- **Key Pattern**: **Single Bot - Multi Persona (Webhook)**. Emulates a crowd of users using a single bot token.
- **Intelligence**: Combined sensing of Text, Voice (STT), and Screen (Vision) to feed a "Goal-Oriented Brain" that manages the conversation flow.
- **Feedback Loop**: Continuously optimizes persona behavior based on real-world KPI tracking (Vibe Scores, clicks, reactions).
- **Dashboard Status**: Integrated into the **Bot Catalog** within the Admin Dashboard, enabling one-click invitation and multi-persona setup.

---

## Shared Implementation Insights (Across All Products)

### Permission Resolution
A custom utility (`src/utils/channelHelper.ts`) is used to convert string-based permission names into Discord's bitfield format.
- **Standard**: Keys must be in `PascalCase` (e.g., `Administrator`).
- **Implementation**: Uses dynamic property access on `PermissionsBitField.Flags`.

### JSON Imports in ESM
- **Requirement**: Use import attributes `with { type: 'json' }` (Node 20+).
- **Robustness**: For dynamic paths, `fs.readFileSync` with `JSON.parse` is preferred.

### Vitest Mocking Patterns
- **Discord.js Mocks**: Construct manual mock objects mimicking the cache and thread structures.
- **Supabase Fluent Mocks**: Use `vi.fn().mockReturnThis()` for chainable calls like `.from().select().eq()`. Final call in chain returns a resolved Promise of `{ data, error }`.
- **Vitest Path Resolution**: ESM projects often require `.js` extensions for imports in test files.
