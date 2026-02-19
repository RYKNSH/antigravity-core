# Discord Buddy: Bot Bootstrap Patterns

Standardized architectural patterns for initializing "Always-On" bots and headless agents within the ecosystem.

## 1. ESM Entry Point Protection

In ESM environments, identifying if a script is the main entry point (similar to `if __name__ == "__main__":` in Python) requires path normalization to handle platform differences and volume-based paths (e.g., on External SSDs).

### Implementation
```typescript
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const entryFile = process.argv[1];

if (entryFile === __filename) {
    main().catch((error) => {
        console.error('An unexpected error occurred:', error);
        process.exit(1);
    });
}
```

## 2. Dynamic Component resolution (Loader Pattern)

To avoid manual registration of every command and event, the ecosystem uses a `glob`-based loader that is sensitive to both development (`.ts`) and production (`.js`) environments.

### Key Logic
- **Path Resolution**: Use `import.meta.url` to resolve paths relative to the loader, ensuring compatibility when running from `src/` or `dist/`.
- **Extension Awareness**: Explicitly skip `.ts` files when the loader itself is running as `.js` (to avoid Node.js extension errors in production).
- **Normalization**: Ensure glob patterns use forward slashes even on Windows.

### Reference Implementation (`src/handlers/loader.ts`)
```typescript
const commandsPath = path.join(__dirname, '..', 'commands');
const pattern = `${commandsPath.replace(/\\/g, '/')}/**/*{.ts,.js}`;
const commandFiles = await glob(pattern);

for (const file of commandFiles) {
    if (file.endsWith('.ts') && path.extname(__filename) === '.js') continue;
    const commandModule = await import(file);
    // ... registration logic
}
```

## 3. Hybrid Bot + Express API

Every agent provides an embedded management API for health checks, remote operation (Control Tower), and receiving external webhooks (e.g., from Google Apps Script).

### Endpoints
- **`GET /health`**: Returns bot online/offline status.
- **`POST /api/webhook`**: Receives event data from GAS or external platforms.
- **`POST /api/admin/setup`**: Triggers the `ChannelManager` remotely to sync server structure.

### Server Lifecycle
The Express server is passed a reference to the `Discord.Client`, allowing HTTP requests to trigger Discord interactions (sending messages, creating threads).

### Persistence & Shared Managers
To enable webhooks and remote orchestration to interact with the database, the `Client` class should serve as the central registry for shared utilities.
- **Pattern**: Instantiate `SupabaseClient` and domain managers (e.g., `MarketManager`) in the `Client` constructor.
- **Access**: Endpoint handlers can then access these via `client.supabase` or `client.market` without re-initializing or creating circular dependencies.

## 4. Graceful Shutdown Protocol

To prevent zombie processes and port conflicts (`EADDRINUSE`), bots must handle termination signals by closing both the HTTP server and the Discord WebSocket connection.

### Implementation
```typescript
const shutdown = async (signal: string) => {
    console.log(`🛑 Received ${signal}. Shutting down...`);
    if (serverInstance) serverInstance.close();
    await client.destroy();
    process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
```

## 5. Build-Aware Verification

Changes in `src/*.ts` are not reflected in the bot's behavior until a build (transpilation to `dist/`) occurs. 
- **Dev Mode**: `pnpm dev` (usually `tsx watch`) for instant feedback.
- **Prod Verification**: `pnpm build && pnpm start`.
- **Zombie Management**: If port conflicts occur, use `lsof -i :3000` and `pkill -f "node dist/index.js"` to clear previous instances.
