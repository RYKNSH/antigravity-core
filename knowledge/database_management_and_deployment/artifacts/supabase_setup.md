## Implementation Guide

### 1. Project Setup
Ensure you have the required dependency installed:
```bash
npm install @supabase/supabase-js
```

### 2. Client Initialization (`src/lib/supabase.ts`)
In Vite projects, use `import.meta.env` and prefix keys with `VITE_`.
```typescript
import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase URL or Key is missing. Database features will be disabled.');
}

export const supabase = createClient<Database>(
  supabaseUrl || '',
  supabaseKey || ''
);
```

### 3. Node.js Bot Client Pattern (`src/utils/supabase.ts`)
For long-running Node.js processes (like Discord bots or headless agents), disable session persistence to avoid unnecessary filesystem/storage warnings.
```typescript
import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';

export const supabase = createClient(
    config.SUPABASE_URL || '',
    config.SUPABASE_KEY || '',
    {
        auth: {
            persistSession: false // Prevents storage errors in Node.js
        }
    }
);
```

### 4. Type Definitions (`src/types/database.ts`)
Centrally define database types and helpers.
```typescript
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      slide_feedback: {
        Row: {
          id: string
          project_id: string
          section_title: string | null
          original_json: Json | null
          revised_json: Json | null
          feedback_comment: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          // ... other fields
        }
      }
    }
  }
}

export type SlideFeedback = Database['public']['Tables']['slide_feedback']['Row'];
export type InsertSlideFeedback = Database['public']['Tables']['slide_feedback']['Insert'];
```

### 4. Service Layer Pattern (`src/services/slideFeedback.ts`)
Encapsulate database operations in service objects.
```typescript
import { supabase } from '../lib/supabase';
import { InsertSlideFeedback } from '../types/database';

export const slideFeedbackService = {
  async submitFeedback(feedback: InsertSlideFeedback) {
    try {
      const { data, error } = await supabase
        .from('slide_feedback')
        .insert(feedback)
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error submitting feedback:', error);
      return { data: null, error };
    }
  }
};

## Next.js Server Actions: The Trusted Admin Pattern

For administrative dashboards that require full CUD (Create, Update, Delete) capabilities while maintaining strict Row Level Security (RLS) for public users, use **Next.js Server Actions** combined with a **Service Role Client**.

### 1. Admin Client Setup (`utils/supabase-admin.ts`)
Create a client using the `SUPABASE_SERVICE_ROLE_KEY`. This key MUST be kept on the server and never exposed to the client. Use the `server-only` package to prevent accidental usage in client components.

**Install Required Deps:**
```bash
pnpm add server-only
```

```typescript
import { createClient } from '@supabase/supabase-js';
import 'server-only';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('❌ Missing Supabase credentials. Admin client cannot be initialized.');
}

export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceRoleKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);
```

### 2. Implementation via Server Actions (`app/actions/admin.ts`)
Define functions with `'use server'` that use the admin client. This effectively bypasses RLS safely because the logic runs in a trusted server environment.

```typescript
'use server';
import { supabaseAdmin } from '@/utils/supabase-admin';
import { revalidatePath } from 'next/cache';

export async function secureUpdateRecord(id: string, updates: any) {
  // 1. Optional: Implement your own session/role check here
  // const session = await auth(); if (!session?.user?.isAdmin) throw new Error('Unauthorized');

  // 2. Execute privileged operation
  const { error } = await supabaseAdmin
    .from('sensitive_table')
    .update(updates)
    .eq('id', id);

  if (error) return { success: false, error: error.message };

  // 3. Purge cache to reflect changes
  revalidatePath('/admin/dashboard');
  return { success: true };
}
```

### Benefits
- **RLS Independence**: Avoids the "policy hell" of trying to define complex Admin write permissions in SQL.
- **Security**: The `Service Role Key` stays on the server.
- **Bot-less Writes**: Unlike the "Proxy through Bot API" pattern, this doesn't require a separate Bot process to be running for simple DB updates.
```

## Environment and Role Responsibilities

### Environment Variables
For local development, create a `.env` file from the following template:

```env
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### Role Split
When integrating cloud services like Supabase:
- **AI Agent**: Handles code generation, type definitions, and service logic.
- **User**: Handles external dashboard actions (executing SQL scripts, retrieving API keys) and configuring production environment variables.

## Case Study: Persistent Agent Context

In multi-agent systems (like the Discord Orchestrator), Supabase is used to provide agents with "memory" that persists across sessions.

### 2. Table: user_context (AI Memory)
Designed for persistent AI context storage, ensuring the bot remembers users across different support tickets.

- **Storage**: `user_id` (Text, Primary Key) is the Discord User ID.
- **Context**: `context` (Text) holds the summarized history.
- **Strategy**: Per-User persistent memory provides continuity even across multiple, non-contiguous conversation threads.

### Schema: `user_context`
```sql
create table user_context (
  user_id text primary key, -- Discord User ID
  context text,             -- Summarized history/preferences
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- RLS Policy for Anon Key Usage
alter table user_context enable row level security;
create policy "Public Access" on user_context for all using (true) with check (true);
```

### Pattern: The Summarization Loop
Instead of storing every message in the DB, the system performs a "Summarize on Close" operation:
1. **Ticket Open**: Fetch `user_context` and inject into AI System Prompt.
2. **Conversation**: Normal chat (stateless or using short-term memory).
3. **Ticket Close**: 
   - Fetch the full thread history.
   - Send history to a Cheap/Fast model (e.g., Claude Haiku).
   - Generate a concise summary of new facts.
   - Upsert the new summary to `user_context`.

### Integration via MCP
By exposing Supabase logic as **MCP Tools**, any agent connecting to the platform driver can access persistent memory without native database drivers:
- `get_user_context(userId)`
- `save_user_context(userId, context)`

### Verification
Always verify the connection using a standalone script (e.g., `verify_db.ts`) to check for "Schema Cache" errors, which indicate the table exists but the cache hasn't updated, or the table is missing entirely.

## Workstation Credential Discovery

When working across multiple projects (Polyrepo) on a local workstation, credentials for shared services like Supabase can often be recovered from sister projects.

### Discovery Pattern
1. **Desktop Scan**: Search for any project containing `.env` files.
   - `grep -r "SUPABASE_URL" ~/Desktop --exclude-dir=node_modules`
2. **Project Naming**: Look for common project suffixes like `... APP` or `... BUDDY`.
3. **Variable Mapping**: Note that different frameworks use different prefixes:
   - Vite: `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (commonly found in projects like `CONTENTS BUDDY`)
   - Next.js: `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (commonly found in projects like `SLIDE BUDDY`)
   - Node: `SUPABASE_URL` / `SUPABASE_KEY`

## CLI Operations & Troubleshooting

### Executing SQL via CLI
If you need to verify database state from the terminal, use the `sql` command in the Supabase CLI.

**Incorrect**: `npx supabase db execute --sql "SELECT ..."` (Will result in "unknown flag: --sql" error)
**Correct**: `npx supabase sql query "SELECT ..."`

### Local vs. Remote
- **Local Development**: Ensure `supabase start` is running to use `npx supabase ...` against the local Docker instance.
- **Remote Production**: Use the `--linked` flag or ensure the project is correctly linked via `supabase link --project-ref <project-id>`.

## Troubleshooting: API Key Misconfiguration

A common failure mode in Supabase integration is misidentifying the correct API keys in the dashboard, leading to `401 Unauthorized` or `Forbidden use of secret API key in browser` errors.

### The "Secret Name vs. JWT" Pitfall
- **Invalid Key Format**: `sb_secret_UwbzOZh9...` or `sb_publishable_PI-4Wig...`
  - **Crucial**: These are often **Project API Key Labels** or internal identifiers shown in the dashboard. They are **NOT** the actual API keys.
- **Valid Key Format**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (a very long string)
  - All functional Supabase API keys (Anon and Service Role) are **JWTs** and **ALWAYS** start with `eyJ`. If your key does not start with `eyJ`, your application will return a `401 Unauthorized` or fail to boot.

### Retrieval Guide (Dashboard)
1. **API Settings**: Go to `Settings` -> `API`.
2. **Project API keys**:
   - **anon (public)**: Use this for `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Accessible from the browser.
   - **service_role (secret)**: Use this for `SUPABASE_SERVICE_ROLE_KEY`. **MUST** be kept server-side only. Requires clicking "Reveal" to view.

### Verification Steps
If requests fail with 401:
- Check if the key in `.env.local` starts with `eyJ`.
- Use `grep -r "sb_secret"` to find if the invalid identifier has leaked into the codebase.
- Verify `supabaseAdmin` is only used in Server Actions or API routes, never imported by Client Components.

## Manual Data Interaction (PostgREST API)
If CLI or UI access is limited, use `curl` to interact with the Supabase PostgREST API.

#### Headers Required:
- `apikey`: Your standard Supabase Key (Anon or Service).
- `Authorization`: `Bearer <Your_Service_Key>` (Required to bypass RLS).
- `Content-Type`: `application/json`
- `Prefer`: `return=representation` (If you want the created record in the response).

#### Example: POST (Create Record)
```bash
curl -X POST "${SUPABASE_URL}/rest/v1/table_name" \
  -H "apikey: ${SUPABASE_SERVICE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"column1": "value1", "column2": "value2"}'
```

#### Example: POST (Bulk Insert)
To insert multiple records at once, pass a JSON array.
```bash
curl -X POST "${SUPABASE_URL}/rest/v1/table_name" \
  -H "apikey: ${SUPABASE_SERVICE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d '[
    {"col1": "val1_row1", "col2": "val2_row1"},
    {"col1": "val1_row2", "col2": "val2_row2"}
  ]'
```

#### Example: PATCH (Update Record)
Update existing records using equality filters in the URL.
```bash
curl -X PATCH "${SUPABASE_URL}/rest/v1/table_name?column_name=eq.FILTER_VALUE" \
  -H "apikey: ${SUPABASE_SERVICE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"column_to_update": "new_value"}'
```

#### Example: GET (Filter Query)
```bash
curl -G "${SUPABASE_URL}/rest/v1/table_name" \
  -d "select=id,name" \
  -d "column1=eq.value1" \
  -H "apikey: ${SUPABASE_SERVICE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}"
```

## Python Supabase SDK Patterns

In the Python bot implementations, the `supabase` package is used for high-level interaction.

### 1. Upsert with Logic (Handshake Pattern)
When a bot joins a guild, it needs to link itself to that guild in the database.

```python
from supabase import create_client, Client

class Database:
    def __init__(self, url, key):
        self.client: Client = create_client(url, key)

    async def register_bot_on_server(self, guild_id: str, bot_name: str):
        # 1. Fetch internal UUID for the server
        res = self.client.table("tenant_servers").select("id").eq("guild_id", guild_id).execute()
        if not res.data:
            return  # Server not yet registered by dashboard auth
            
        server_id = res.data[0]["id"]
        
        # 2. Fetch UUID for this bot from the registry
        bot_res = self.client.table("bot_registry").select("id").eq("name", bot_name).execute()
        bot_id = bot_res.data[0]["id"]
        
        # 3. Establish the link in the junction table
        self.client.table("server_bots").upsert({
            "server_id": server_id,
            "bot_id": bot_id,
            "status": "active"
        }, on_conflict="server_id,bot_id").execute()
```
### 2. TypeScript/Node.js SDK Pattern (Handshake Sync)
When a bot enters a server, it must link its `guild_id` to the internal `tenant_servers.id`.

```typescript
import { supabase } from '../lib/supabase.js';

async function registerBot(guildId: string) {
    if (!supabase) return;

    // 1. Map Snowflake (Discord ID) to Internal UUID
    const { data: server } = await supabase
        .from('tenant_servers')
        .select('id')
        .eq('guild_id', guildId)
        .single();
    
    if (!server) return; // Server not registered yet

    // 2. Identify the bot
    const { data: botRegistry } = await supabase
        .from('bot_registry')
        .select('id')
        .eq('name', 'builder')
        .single();
    
    if (!botRegistry) return;

    // 3. Establish the link
    await supabase.from('server_bots').upsert({
        server_id: server.id,
        bot_id: botRegistry.id,
        status: 'active',
        updated_at: new Date().toISOString()
    }, { onConflict: 'server_id,bot_id' });
}
```

### 3. Debugging: Standalone Query Scripts
For rapid verification of database state without the overhead of the full bot/dashboard infrastructure, use a standalone TSX script. 

**Script Hygiene (Crucial)**: In ES modules, static `import` statements are hoisted and executed *before* `dotenv.config()` is called. This can cause the Supabase client to initialize with empty strings for credentials.

**The Definitive Solution: Dynamic Import Pattern**
Use dynamic `await import()` inside an async function to ensure environment variables are loaded first.

```typescript
// scripts/check_db_debug.ts
import dotenv from 'dotenv';
// Use relative path to ensure correct file is loaded in monorepo
dotenv.config({ path: '../.env' }); 

async function check() {
    // Dynamically import client AFTER env is loaded
    const { supabase } = await import('../src/lib/supabase.js'); 

    if (!supabase) {
        console.error('Supabase client failed to initialize');
        return;
    }

    const { data: servers } = await supabase.from('tenant_servers').select('guild_name, guild_id');
    console.log('Servers:', JSON.stringify(servers, null, 2));
}

check();
```
Execute with: `npx tsx scripts/check_db_debug.ts`

### 2. Identifier Mapping (Snowflake to UUID)
When creating project-specific records (like task runs or mission logs), always resolve the external Discord `guild_id` to the internal database UUID (`tenant_servers.id`) before persistence. It is critical to resolve both the **server_id** and the **tenant_id**, as most multi-tenant schemas use the `tenant_id` for Row Level Security (RLS) policies.

```python
async def create_project_run(self, guild_id: str, task: str):
    # RESOLVE: Map Snowflake string to internal UUID
    server_res = self.client.table("tenant_servers").select("id, tenant_id").eq("guild_id", guild_id).execute()
    if not server_res.data:
        raise ValueError("Server not registered")
    
    server_id = server_res.data[0]["id"]
    tenant_id = server_res.data[0]["tenant_id"]

    # PERSIST: Use internal UUIDs for foreign keys
    data = {
        "server_id": server_id,
        "tenant_id": tenant_id,
        "task": task,
        "status": "running"
    }
    return self.client.table("mission_runs").insert(data).execute()
```

### 3. Handling Discord Snowflakes
Discord IDs (Snowflakes) are often larger than standard integers and should be treated as **strings** in your filters to avoid precision errors or schema type mismatches.
- **Good**: `.eq("guild_id", str(guild_id))`
- **Verification**: If you receive a `Postgrest APIError: invalid input syntax for type uuid`, verify you aren't passing a Snowflake directly to a UUID column.

### 4. Hybrid Schema Design for Web/Chat Integration
When the same database table receives events from both a Chat platform (e.g., Discord) and a Web Dashboard, schema constraints must be designed for partial context.

- **Nullable Context Pattern**: Columns that capture platform-specific metadata (like `channel_id` or `thread_id`) must be **Nullable** if the table is also written to by the web dashboard, which lacks that context.
- **Constraint Resolution**: If a legacy schema has a `NOT NULL` constraint causing insert failures in hybrid mode, apply a migration to drop the requirement:
  ```sql
  ALTER TABLE your_table ALTER COLUMN platform_context_id DROP NOT NULL;
  ```
- **Consistent Ownership**: Ensure that even if context is partial, the **tenant/server ownership** (`server_id` or `tenant_id`) is strictly enforced to maintain data isolation across platforms.

### 4. Identity-Anchored Operations (Profiles & Sync)
When a platform (like Discord) acts as the primary source of truth for identity, use a `member_profiles` table to bridge platform state with operational data.

- **Anchor**: Use the platform's unique ID (e.g., Discord ID) as a unique key alongside a `guild_id`.
- **Flexible Metadata**: Store profile-specific info (Username, Avatar URL, Display Name) in a `JSONB` column to avoid schema fatigue while maintaining visibility.
- **Sync Protocol**:
    1.  **Trigger**: Dashboard or Bot initiates a "Sync" action.
    2.  **Logic**: Fetch all platform members and `upsert` them into the database with `onConflict: 'guild_id,discord_id'`.
    3.  **Outcome**: Provides the dashboard with a "Ready-to-Manage" list of users, including those who have never interacted with the system directly.

```typescript
// Upsert pattern for profile synchronization
const { error } = await supabase
    .from('member_profiles')
    .upsert(profiles, { onConflict: 'guild_id,discord_id' });
```

## Supabase Session Pooler Optimization (Next.js & postgres-js)

When using the Supabase Session Pooler (port 5432/6543) with the `postgres-js` library (often with Drizzle ORM) in a Next.js environment, common "Max Clients Reached" errors can occur due to connection leaks during development (HMR) or excessive connection attempts.

### 1. Connection Limits
Supabase Session Pooler has a limited `pool_size`. Each API request in Next.js might attempt to open a new connection if not handled correctly.
- **Pattern**: Set `max: 1` in the `postgres` client configuration. This forces the client to use a single connection per server instance, which is usually sufficient for serverless/Next.js API routes when using a pooler.
- **Critical Fix**: Set `prepare: false`. Session poolers generally do not support prepared statements across different sessions.

### 2. Next.js DB Singleton (surviving HMR)
During development, Next.js Hot Module Replacement (HMR) reloads modules, which can create multiple instances of the DB client and leak connections. Use `globalThis` to preserve the connection.

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const globalForDb = globalThis as unknown as {
    db: ReturnType<typeof drizzle<typeof schema>> | undefined;
    client: ReturnType<typeof postgres> | undefined;
};

export function getDb() {
    if (!globalForDb.db) {
        const connectionString = process.env.DATABASE_URL;
        if (!connectionString) throw new Error('DATABASE_URL is not set');

        globalForDb.client = postgres(connectionString, {
            max: 1,           // Optimized for Session Pooler
            prepare: false,   // REQUIRED for Session Pooler
            idle_timeout: 20,
            connect_timeout: 10,
        });
        
        globalForDb.db = drizzle(globalForDb.client, { schema });
    }
    return globalForDb.db;
}
```

### 3. Troubleshooting
- **Error**: `[PostgresError]: MaxClientsInSessionMode: max clients reached`
  - **Cause**: Too many open connections held by the application or stale connections from previous HMR cycles.
  - **Resolution**: Apply the singleton pattern above and reduce `max` connections to 1. Restart the dev server if needed.
- **Missing Env**: If `.env.local` is not being reflected after changes, perform a hard restart of the process (e.g., `lsof -ti:3002 | xargs kill -9`).

## Realtime Communication Bridge Pattern (Bot-Dashboard Interface)

The **Realtime Bridge Pattern** enables low-latency communication between a web dashboard and an autonomous bot/agent without direct networking dependencies. This is particularly effective for systems running in portable or fragmented environments (e.g., local SSD workstations).

### Core Mechanism
Instead of a standard REST/WebSocket API hosted by the bot, a Supabase table acts as a **mailbox**.
1. **Producer (Dashboard)**: Inserts a command/message into a table.
2. **Consumer (Bot)**: Subscribes to `INSERT` events via Supabase Realtime, processes the command, and inserts a response.
3. **Consumer (Dashboard)**: Receives the response via the same Realtime subscription.

### Schema Requirements
```sql
create table conversation_bridge (
    id uuid default gen_random_uuid() primary key,
    server_id text not null, -- Scoping ID (e.g., Discord Guild ID)
    sender text not null check (sender in ('user', 'bot')),
    content text not null,
    created_at timestamp with time zone default now()
);

-- MUST enable realtime for the table
alter publication supabase_realtime add table conversation_bridge;
```

### Advantages for Agents
- **No Port Forwarding**: The bot initiates the outbound WebSocket to Supabase; no ingress required.
- **Reliability**: If the bot is offline, messages remain in the DB and can be processed upon reconnection (if implemented).
- **Audit Log**: The database table provides an automatic history of all interactions for debugging and "reflection" tasks.

### Next.js UI Integration (Client-Side)
```typescript
useEffect(() => {
    const channel = supabase
        .channel('bridge_channel')
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'conversation_bridge' 
        }, (payload) => {
            // Update UI state with NEW message
        })
        .subscribe();
    return () => { supabase.removeChannel(channel); };
}, []);
```

---
*Verified Implementation: Server Builder Phase 4 (January 2026)*
