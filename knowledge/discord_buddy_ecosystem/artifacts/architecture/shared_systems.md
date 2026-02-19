# Shared Systems & Ecosystem Standards

## 1. Product Directory Structure (Bot Sub-package)
To maintain consistency across the ecosystem, all products follow a standardized directory layout.

- **Base Directory**: `products/[product-name]`
- **Agent Root**: The actual workspace package (with `package.json`, `src/`, etc.) is located in the `bot/` subdirectory.
- **Example**: `products/server-builder/bot/`
- **Naming Convention**: `@discord-buddy/[product-name]-bot`

## 2. Infrastructure for "Always-On" Agents
High-autonomy and instant response are achieved through a tiered hosting model:

- **Interactive Layer (Railway)**: Container-based hosting for the Discord Client. Maintains WebSocket connection for instant Button/Interaction responses.
- **Webhook Layer (GAS)**: Google Apps Script acts as the 24/7 entry point for external webhooks. Forwards data to the Bot's embedded API server.
- **Control Tower (Hybrid API)**: An embedded Express server within the bot process. Allows for real-time monitoring (`/health`) and remote orchestration (`/api/admin/setup`).
- **Persistence Layer (Supabase)**: Unified DB for multi-tenant state and rule management (RuleManager).

## 3. Granular Interaction Patterns

### Private Thread Unlock Pattern
Used for private, 1-on-1 step-by-step content delivery.
- **Mechanism**: Agent creates a Private Thread for a specific user.
- **Outcome**: Maintains clean public channels; strictly individual workspace.

### Role-Based Progressive Access (Phased Role-Gate)
The preferred pattern for community-wide learning progression (proven in `artistory_studio`).
- **Mechanism**: Agent assigns "Progression Roles" to users based on achievements.
- **Outcome**: Channels appear/disappear dynamically. Scales better for shared discussions within a specific learning stage.
- **Premium Standard**: Progression roles should be localized with thematic icons (e.g., `🔓｜Step 2 解放`) to enhance the user's sense of achievement (120% UX).

### Sanctuary Protocol (Noise Control)
A high-end community management pattern focused on minimizing "notification fatigue."
- **Default Notifications**: Force server-wide settings to "Mentions Only."
- **Mention Restriction**: Restrict `@everyone` and `@here` permissions to administrative roles only (e.g., `👑｜管理者`).
- **Outcome**: Ensures that when a notification DOES happen, it is of high value, maintaining a premium/curated atmosphere.

### Tiered Administrative Delegation
Enables operational assistance while maintaining server structural integrity.
- **Pattern**: Create a secondary moderator role (e.g., `✏️｜編集者`) that mirrors the permissions of an Administrator but explicitly **lacks "Manage Channels"**.
- **Use Case**: Allows trusted members to manage users, messages, and events without the risk of accidental or malicious channel deletion/restructuring.
- **Outcome**: Balances community autonomy with top-down vision control.

- **Integrated Dashboard Strategy (Hybrid Data Fetching)**:
    - **Direct DB Phase (Static/Theory)**: For data that lives purely in the database (e.g., Course metadata, Article content), the dashboard uses **Next.js Server Actions** with a `supabaseAdmin` client (Service Role) to perform CUD operations. This bypasses RLS safely on the server and reduces the load/dependency on the Bot API.
    - **Bot Bridge Phase (Live/Social)**: For data or actions that require the live Discord context (e.g., fetching Server Roles, Member status, or assigning Roles), the dashboard calls the Bot's embedded API endpoints.
        - **Standard Endpoints**:
            - `GET /api/bot/server-stats`: High-level community health metrics.
            - `GET /api/bot/roles?guildId=...`: Lists all server roles for UI selection/mapping.
            - `POST /api/bot/unlock-course`: Triggers role assignment and private thread creation.
- **Outcome**: Seamlessly connects Web-based user flows with real-time Discord structural updates and secure data access while maintaining a decoupled and high-performance architecture.

### Integrated OpsOS (Editor Control Tower)
A browser-based "Operating System" for server owners and administrators (proven in `artistory_studio`). It sits above Discord to orchestrate the community lifecycle.
- **Mechanism**: A Next.js application (with NextAuth.js) communicating with the Bot's Bridge API.
- **The 4 Pillars**:
    1. **Security & Identity**: Discord OAuth2-based login (NextAuth.js v5) restricted by server role verification (Editor/Admin).
    2. **CRM & Analytics**: Funnel visualizations, retention monitoring, and proactive action triggers (DM reminders).
    3. **LMS & CMS**: Web-based course creation and an assignment approval loop (Submit -> Review -> Unlock -> Reward).
    4. **Economy**: Global treasury management and transaction auditing.
- **Design Standard**: "Vision Design System" - high-immersion dark themes with glassmorphism and neon accents.

### Full User-Base Sync (Supabase Alignment)
Ensures that the external database (e.g., Supabase) reflects the actual state of the Discord server.
- **Pattern**: Provide a `/sync-members` endpoint that triggers a full `guild.members.fetch()` and upserts the data into the database.
- **Purpose**: Populates the Control Tower Dashboard with users who may not have interacted with the Bot yet, enabling proactive management.
- **Outcome**: Resolves the "Hidden User" problem where only active users appear in system tables.

## 4. Development Standards
- **Strict TypeScript**: `noImplicitAny: true` and strict mode are mandatory.
- **Testing**: Vitest with AppleDouble (`._*`) exclusion on ExFAT drives.
- **Lifecycle**: Managed via `immortal` scripts in `.agent/supervisors/run.sh`.
## 5. Stateful OAuth & Multi-App Redirection

To support a seamless multi-tenant experience where one dashboard manages multiple bots from different Discord applications, several advanced patterns are employed.

### Unified Callback Pattern (Centralized Routing)
Instead of registering separate redirect URIs for every bot, use a single, centralized callback endpoint.
- **Endpoint**: `/api/auth/callback`
- **Mechanism**: The initial authorize URL includes a `state` parameter containing a Base64-encoded JSON object with the final destination (`returnTo`).
- **Benefit**: Simplifies Discord Developer Portal configuration (only one URI to whitelist per app).

### Critical OAuth Integration Gotchas
Precision is required to avoid `token_exchange` or `redirect_uri_mismatch` errors:
1. **Redirect URI Strict Equality**: The `redirect_uri` passed to the Authorization request MUST be character-for-character identical to the one passed in the Token Exchange POST body. Even a trailing slash or `localhost` vs `127.0.0.1` mismatch will cause failure.
2. **Client ID / App ID Mismatch**: In a multi-app environment, a `code` issued for App A cannot be exchanged by the Client Secret of App B. 
3. **Scope vs. Route Logic**: If a bot invite requests `scope=bot`, the callback route must NOT attempt to fetch user-level data (`/users/@me`) if only the `bot` scope was provided, as the `access_token` might not have permission.

### Graceful Session Fallback (The "Pass-through" Pattern)
To resolve the Multi-App Mismatch (Gotcha #2) during bot invites:
- **The Pattern**: If the token exchange fails, check if the user already has a valid dashboard session.
- **Logic**: If `tokenResponse.ok` is false BUT a valid session cookie exists AND a `state` with `returnTo` is present, assume this was a successful "Bot Addition" flow by an already authenticated user.
- **Outcome**: Redirect the user to `state.returnTo` instead of showing an error. This provides the "Face-pass (顔パス)" experience where the system recognizes the user's status and bypasses redundant exchange steps.

### Discord OAuth Integration Checklist
Use this checklist during implementation to prevent common auth loop failures:
1. **Client ID Match**: Verify that the Frontend is using the correct App ID and the Backend is using the corresponding Client Secret. (Crucial in multi-app dashboards).
2. **Scope Verification**: Ensure `identify` and `guilds` are included even when inviting a bot, if the callback logic depends on fetching user/guild data.
3. **Graceful Fallback**: Always implement a session-check fallback in the callback route to rescue users who have valid sessions but encounter token exchange errors (Face-pass).
4. **Redirect URI Equality**: Double-check for character-level matches (ports, trailing slashes, localhost vs 127.0.0.1).
## 6. Platform Development Health

### Turbopack Cache Management (Next.js)
In portable development environments using **exFAT/External SSDs**, Next.js Turbopack may encounter persistence errors.
- **Symptoms**: `Failed to open database` or `invalid digit found in string` during startup.
- **Cause**: Corrupt `.next` directory.
- **Standard Fix**: Delete inhibited cache and restart: `rm -rf .next && pnpm dev`.

## 7. Bot Registry Health & Audit

In a multi-product monorepo (Discord Buddy), the central `bot_registry` table is the source of truth for the Admin Dashboard. Maintaining its integrity is critical for UX.

### The Audit Script Pattern
When the dashboard fails to display a bot or links to an incorrect app, the standard procedure is to run a registry audit.
- **Implementation**: A standalone Node.js script (e.g., `check_all_bots.cjs`) using the Supabase Service Role key.
- **Core Checks**:
    1. **Identity Mapping**: Ensure `name` (code-internal slug) matches the expected `display_name` (user-facing brand).
    2. **ClientID Verification**: Confirm `default_config.discord_client_id` matches the specific bot token used by the product's backend.
    3. **Permission Audit**: Validate that the OAuth2 scopes and permissions bitmask in the registry provide the necessary access (e.g., `8` for Admin, `2147559424` for Hype Buddy).

### Recovery Workflow
1. Run audit script to identify mismatches.
2. Use a specialized update script (e.g., `update_hype_name.cjs`) to patch metadata without manually performing SQL queries, reducing human error.
3. Reload Dashboard to verify dynamic retrieval logic.

## 8. Webhook & API Integration Patterns

### Forum Channel Integration (Thread Creation)
When using Webhooks to notify Discord Forum Channels, regular message payloads will fail with a `400 Bad Request (Error Code: 220001)`.
- **Requirement**: The payload MUST include `thread_name` (to create a new thread) or `thread_id` (to post to an existing one).
- **Example Payload**:
  ```json
  {
    "content": "Message content...",
    "thread_name": "Title of the Post"
  }
  ```
- **Outcome**: Successfully creates a new forum post with the webhook's personality.
