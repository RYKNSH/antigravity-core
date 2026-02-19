# Discord Buddy: Server Synchronizer Engine

The Server Synchronizer Engine (`ChannelManager.ts`) is a core ecosystem capability that translates a JSON-based "Ideal Reality" (`schema.json`) into a live Discord Guild structure.

## 1. Schema-Based Orchestration

A single `schema.json` defines categories, channels, and roles. The engine applies these in a logical sequence to maintain parent-child relationships.

### Functional Sequence
1. **Roles**: Created/synced first for permission references.
2. **Categories**: Created/synced to act as parents.
3. **Channels**: Created/synced within categories.

## 2. Capability: "Synchronizer Mode" (Idempotency)

Unlike simple "creation" scripts, the Synchronizer enforces the schema on existing items.
- **Identity**: Matches by Name.
- **Topic Sync**: Updates `topic` (description) if it differs.
- **Permission Sync**: Re-applies `permissionOverwrites`.
- **Position Sync**: Re-orders channels and categories to match the array index in the schema.

## 3. High-Engagement Content Seeding

The engine supports `initialMessages` to post visions, rules, or guides immediately upon channel creation.

### Forum Channel Logic
Since `send()` is not supported on forum channels, the engine automatically:
1. Creates a pinned thread (default name: `📌 チャンネル案内`).
2. Posts the `initialMessages` into that thread.

## 4. Technical Resilience (Fallback Pattern)

Specialized channel types depend on the "Community" feature being enabled on the Guild. If creation fails, the engine falls back to standard types to ensure structural integrity.

| Requested Type | Fallback Type | Failure Code |
| :--- | :--- | :--- |
| `GUILD_ANNOUNCEMENT` | `GUILD_TEXT` | 50035 (Invalid Form Body) |
| `GUILD_STAGE_VOICE` | `GUILD_VOICE` | 50024 (Cannot execute action) |

- **Standard**: Keys must be in `PascalCase`.
- **Logic**: `PermissionsBitField.Flags[name as keyof typeof PermissionsBitField.Flags]`.

### TypeScript Overload Resolution (Gotcha)
When using recursive creation or fallbacks, the `guild.channels.create` method often fails to match its complex overloads (e.g., when the `type` is a dynamically resolved variable).
- **Issue**: TypeScript cannot guarantee that a `ChannelType` variable matches the specific requirements of a `GuildChannelCreateOptions` union.
- **Fix**: Cast the `type` property to `any` within the options object to satisfy the router: `await guild.channels.create({ name, type: fallbackType as any, ... })`.

## 6. Strict Schema Enforcement (Pruning & Cleanup)

To eliminate "Experience Drift" or "Clutter", the engine integrates cleanup logic directly into the setup flow.
- **Channel Cleanup**: The `cleanupChannels()` method scans each category and deletes orphan channels using **Fuzzy Identity Matching** (`areChannelNamesEqual`: combines direct and slugified matches).
- **Identical Duplicate Suppression**: To handle cases where multiple channels have the same or equivalent names, the engine uses a **Claiming Pattern**. It iterates through schema definitions, "claims" the oldest matching channel (based on `createdTimestamp`) for each definition, and marks any extra matches for deletion. This ensures a 1:1 mapping between schema items and server channels while preserving the original channel's history.
- **Category Cleanup**: The `cleanupCategories()` method identifies entire categories (and their children) on the server that are not present in the current `schema.json` and purges them. This is critical for structural rebrands where category names have changed.
- **Strategic Sequence**:
    1.  **Sync**: Create/Update roles, categories, and channels.
    2.  **Channel Cleanup**: Prune within valid categories.
    3.  **Category Cleanup**: Prune unknown categories and their descendants.
- **Safety & Silent Failures**:
    - **Race Conditions**: During mass cleanup, the engine might attempt to delete a channel that was already removed as part of a category purge. The implementation should explicitly catch and ignore `DiscordAPIError [10003]: Unknown Channel` to prevent script crashes while still logging legitimate failures.
    - **Gotcha**: If `Collection` is used for filtering but not imported from `discord.js`, the cleanup logic may fail with a `ReferenceError`. In `tsx` environments, this can cause a silent failure where the main sync appears successful but the structural purge is skipped, leaving duplicate "Experience Drift" clutter.

Previously, this was handled by a standalone `prune_channels.ts` script, but it is now an atomic part of `applySchema()` for better reliability.

## 7. Operational Modes

### Direct Injection Protocol
A standalone script (`force_apply_schema.ts`) that bypasses the main bot event loop to apply the schema directly using a dedicated client. Used for emergency syncing or hard resets.

### Remote Operation (Control Tower)
The administrative Express endpoint (`POST /api/admin/setup`) invokes the `ChannelManager.applySchema()` logic, enabling "management sessions" from IDEs or management dashboards.

## 8. Pinned Vision Layer (Persistent Onboarding)

To ensure the server's vision is never buried by user conversation, the engine implements a **Pinned Vision Layer**:
- **Automatic Pinning**: Every `initialMessage` sent to a text-based channel is automatically pinned by the bot.
- **Forum Pinning**: For forum channels, the "Channel Guide" thread itself is pinned.
- **Sync-Time Repair**: During synchronization, the engine checks recent messages and pins. If an initial message exists but isn't pinned, it is retroactively pinned. If it's missing entirely, it is re-posted and pinned.
- **Benefit**: Maintains a 120% UX where the "Standard of Truth" exists at the top of every channel, regardless of community activity level.

## 9. Guild Setting Synchronization (Advanced)
Beyond channel structures, the synchronizer is capable of managing global Guild-level properties to maintain ecosystem standards.

### Notification Defaults
- **Operational Standard**: The ecosystem recommends and enforces `ONLY_MENTIONS` (1) as the default notification level.
- **Logic**: `guild.setDefaultMessageNotifications(GuildDefaultMessageNotifications.OnlyMentions)` is called during the setup/sync phase.
- **Goal**: Prevent "Notification Fatigue" in large creator communities, ensuring that only `@everyone` or personal mentions trigger alerts.
