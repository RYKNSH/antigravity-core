# Migration Best Practices (Idempotency)

## Handling "Relation Already Exists" Errors
In Supabase or generic PostgreSQL migrations, scripts should be designed to run multiple times without error (idempotency).

### 1. The "Clean Slate" Approach (Development)
During early development or when schema synchronization is prioritized over data retention, drop existing tables before creating them.
```sql
-- Safeguard against "already exists" errors
DROP TABLE IF EXISTS public.target_table;

CREATE TABLE public.target_table (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  -- pillars...
);
```

### 2. The "Safe Create" Approach (Production)
When data must be preserved, use `IF NOT EXISTS`.
```sql
CREATE TABLE IF NOT EXISTS public.target_table (
  id uuid PRIMARY KEY,
  -- pillars...
);
```

### 3. Schema Management
- Always include **Row Level Security (RLS)** by default.
- Define appropriate policies for `INSERT`, `SELECT`, `UPDATE`, and `DELETE`.
- Use `TIMESTAMPTZ` for `created_at` fields to handle timezones correctly. (Note: Avoid the common typo `timestampz`).

## Decoupled Schema Migration (Local-to-Cloud)
When migrating an application from local storage (IndexedDB) to a cloud backend (Supabase), you may encounter chicken-and-egg problems with foreign keys.

### Strategy: Late-Binding Constraints
If a peripheral feature (like Feedback) is being moved to the cloud before its parent entity (like Projects), consider:
1. **Initial Creation**: Create the table with plain IDs (e.g., `project_id uuid NOT NULL`) without a `REFERENCES` constraint.
2. **Migration Sync**: Once the parent table is migrated to the cloud, use an `ALTER TABLE` statement to add the foreign key constraint.
   ```sql
   ALTER TABLE public.slide_feedback
   ADD CONSTRAINT fk_slide_feedback_projects
   FOREIGN KEY (project_id) REFERENCES public.projects(id)
   ON DELETE CASCADE;
   ```
This allows iterative migration without breaking features that depend on a global schema that isn't fully ready in the cloud.

## Handling Realtime Publication Errors
When configuring Supabase Realtime in a migration script:
`ALTER PUBLICATION supabase_realtime ADD TABLE target_table;`

### The "Duplicate Member" Pitfall
If the table is already a member of the publication (due to a previous migration or manual UI toggle), the script will fail with:
`ERROR: 42710: relation "target_table" is already member of publication "supabase_realtime"`

### Idempotent Realtime Workaround
Since PostgreSQL doesn't support `IF NOT EXISTS` for `ALTER PUBLICATION`, use a PL/pgSQL block to verify existence before adding:
```sql
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'target_table'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE target_table;
    END IF;
END $$;
```

## 4. Query-Schema Synchronicity (PostgREST)
When using direct client-side queries (or server-side `supabase.from().select()`), keep in mind that PostgREST is strict about schema alignment.

### Missing Column Failure
If you add a new column (e.g., `guild_icon`) to a `.select()` query **before** the migration has been successfully applied to the target database, the entire query will fail with a `400 Bad Request`.
- **Symptom**: Dashboard data disappears or components crash.
- **Best Practice**:
    1. Apply database migrations *before* deploying code that depends on new columns.
    2. If developing locally, ensure the local DB (via `supabase start`) or the linked project has been updated before reloading the Dev Server.
    3. Use selective fetching rather than `select('*')` to maintain security and clarity, but verify column existence during refactors.

## 5. Data Remediation after Identifier Mapping Fixes
When code is updated to switch from external identifiers (e.g., Discord Snowflakes) to internal ones (UUIDs), existing data often becomes skewed or unreachable.

### The "Ideal State" (理想系) Goal
The goal is to move the database state to one where 100% of records adhere to the new canonical mapping.

### Remediation Workflow
1. **Audit**: Use the Supabase SQL Editor or REST API to find records that do not match the expected pattern.
   ```sql
   -- Find records in crew_agents where server_id is NOT a valid UUID 
   -- (Note: Only works if the column type allows non-UUID strings)
   SELECT * FROM crew_agents WHERE server_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
   ```
2. **Manual Purge**: For development environments, it is often faster to delete these "poisoned" records to force the application to re-create them correctly.
3. **Soft Migration**: In production, consider a migration script that resolves the IDs and updates the records rather than deleting them.

### Importance of Visibility
Always notify the user that **past data** created under the old system may require re-creation or migration to appear in the dashboard. This prevents "data loss" complaints during the transition phase.

## 6. Drizzle Kit Synchronization Patterns

### Handling Interactive Push Conflicts
When running `npx drizzle-kit push`, the CLI may detect existing tables in the database that are not yet tracked by the current schema context. It will ask if you want to **rename** an existing table to the new name or **create** a new table.

- **The Rename Trap**: Choosing a rename can be dangerous in a multi-tenant or shared database environment. It may accidentally modify or drop tables belonging to other services or legacy versions of the app.
- **Best Practice (Create New)**: In tiered monorepo migrations where old "platform-wide" tables (e.g., `mkt_servers`) are being replaced by product-specific tables (e.g., `servers`), always choose to **create new tables** unless you are specifically performing a data-preserving rename migration.
- **The SD-Align Pattern (Schema-Database Alignment)**: When a code refactor results in "cleaner" table names that mismatch the actual production DB (e.g., code says `servers` but DB has `mkt_servers`), and you want to avoid interactive "Rename" risks or data loss from "Create":
    1. Update the local Drizzle schema definition (`pgTable` name) to match the **existing database table name**.
    2. **Field-Level Check**: If runtime errors indicate missing columns (e.g., `PostgresError: column "icon_url" does not exist` or `PostgresError: column "type" does not exist` at position X), inspect the physical table and sync the local field names. 
        - **Fix**: Use Drizzle's field mapping: `iconUrl: text('icon_url')` instead of just `iconUrl: text('iconUrl')`. 
        - **Symptom Logic**: A `500 Internal Server Error` on a previously working dashboard or bot startup crash immediately after a schema change usually points to a field mapping or column mismatch.
        - **Verification**: This ensures the bot can successfully select/insert data into legacy tables without crashing.
    3. This ensures instant compatibility with legacy data and avoids the destructive potential of interactive CLI prompts.
- **Drizzle Timestamp-to-Date Mapping**: When using Drizzle ORM with PostgreSQL `timestamp` or `timestamptz` columns, the result is automatically parsed into a JavaScript `Date` object.
    - **Mistake**: Assuming the field is a string and passing it to regex-based formatters or `new Date(field)` unnecessarily.
    - **Fix**: Update helper functions (e.g., `formatRelativeTime(date: Date | null)`) to accept `Date` objects directly.
    - **Symptom**: Runtime errors like `date.getTime is not a function` or invalid formatted output when the code expects a string but receives a `Date`.
- **SQL Position Error Debugging**: When PostgreSQL returns `PostgresError` with a `position X`, it refers to the exact character in the SQL string where the error occurred.
    - **Symptom**: `PostgresError: column "icon_url" does not exist at position 54`.
    - **Investigation**: Use structured logging to print the *exact* SQL query string being executed. Locate the character at the specified position.
    - **Common Cause**: In an `INSERT INTO table (col1, col2) VALUES (...)`, if the column name at that position is `icon_url` but the physical table has `iconUrl` (or vice-versa), the query will fail even if you "see" the column in a different CASE or if you just added it (check for active search path or caching).
- **The SQL Bridge Pattern**: For large-scale field alignment in production databases, use a structured `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` script to bridge the code's requirements with legacy tables.
    ```sql
    -- Example for mkt_servers and mkt_ai_actions
    ALTER TABLE mkt_servers ADD COLUMN IF NOT EXISTS icon_url TEXT;
    ALTER TABLE mkt_ai_actions ADD COLUMN IF NOT EXISTS type TEXT;
    ALTER TABLE mkt_sequences ADD COLUMN IF NOT EXISTS efficacy_score REAL DEFAULT 0;
    ```
    - **Discovery Logic**: Immediately after a table-level align, any `PostgresError: column "..." does not exist` at runtime defines the next "Bridge" requirement. Proactively add these to the migration script rather than waiting for individual crashes.
- **The Universal Node.js Migration Runner**: When standard CLI tools (`psql`, `drizzle-kit`) fail due to environment restrictions or package errors (e.g., `ERR_PACKAGE_PATH_NOT_EXPORTED`), use a standalone Node.js script with a direct driver (like `postgres-js`).
    - **Implementation**: Create a `run.ts` script that loads environment variables via `dotenv`, reads SQL statements from a file, and executes them line-by-line using a database driver.
    - **Advantage**: Bypasses complex toolchain dependencies and provides meaningful error handling (e.g., catching "column already exists" while allowing the script to continue).
    - **Usage**: `npx tsx migrations/run.ts`.
- **Physical Schema Verification via SQL**: When `drizzle-kit introspect` or other CLI tools fail due to dependency errors, use raw SQL queries to verify the reality of the database structure.
    - **Query**:
      ```sql
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'target_table_name'
      ORDER BY ordinal_position;
      ```
    - **Principle of "Source of Truth"**: Always trust the result of an `information_schema` query over the local schema file if runtime errors occur.
- **Schema Completeness Auditing**: When dealing with large legacy tables (e.g., 20+ columns), performing a column count audit is essential.
    - **Symptom**: Some API endpoints work while others fail with `PostgresError` even after fixing "obvious" mismatches.
    - **Resolution**: Compare the column listing from `information_schema` with the local Drizzle schema. Ensure every column in the database is represented in the Drizzle file, even if currently unused by the UI, to prevent "Missing Column" errors during `db.select().from(...)` operations.
- **The Double Column Collision Pattern**: In legacy production databases, you may find multiple columns serving the same purpose (e.g., `last_active_at` and `last_activity_at`).
    - **Resolution Strategy**: Map **both** in the Drizzle schema to ensure no runtime crashes during selection (`SELECT *`), even if the application code only uses one.
    - **Example**:
      ```typescript
      lastActiveAt: timestamp('last_active_at'),
      lastActivityAt: timestamp('last_activity_at'),
      ```
- **The Absence Alignment Pattern**: In some cases, a refactored schema assumes a column is required (e.g., `direction: text().notNull()`) but that column is physically absent from the legacy table.
    - **Symptom**: The API returns a 500 error or empty data silently because the ORM cannot complete the `SELECT` statement mapping.
    - **Fix**: Remove the non-existent column from the local schema or make it optional (`.nullOnly()`) after an `information_schema` audit. Always align the code to the *physical* reality of the database when restoration is the goal.
- **Environment Context**: Ensure `drizzle.config.ts` is correctly loading the target environment variables (e.g., `.env.local`) to avoid pushing schemas to the wrong database cluster.
- **Drizzle Runtime Safety & Typing**:
    - **Date Object Strictness**: `timestamp` カラムの `lte`/`gte` 比較において、`toISOString()` で生成した文字列を渡すと型エラーや意図しない動作の原因となる。Drizzle ORM を使用する場合は、`new Date()` オブジェクトを直接渡すこと。
    - **JSONB Casting Pattern**: `jsonb` カラム（`tags`, `metadata` など）を操作する際は、`unknown` を経由した 2 段階のキャスト（例: `result.tags as unknown as string[]`）を行うことで、TypeScript の型チェックを確実に通し、ランタイムの `undefined` アクセスを防止する。
    - **Node.js Type Awareness**: モノレポ内のサブパッケージ（特に `composite: true` 設定時）で `process.env` を参照する場合、`tsconfig.json` の `compilerOptions.types` に `["node"]` を含めないとコンパイルエラー（`Cannot find name 'process'`）が発生する。

## 7. Service Stability & Cache Mitigation (Next.js 16)

### Turbopack Persistence Errors
In high-concurrency monorepo environments, Next.js 16's Turbopack may encounter "persistence errors" or cache-related crashes.
- **Symptom**: `Turbopack persistence error` or failure to start despite no code errors.
- **Resolution**:
    1. **Cache Purge**: Remove the `.next` directory (`rm -rf apps/my-app/.next`).
    2. **Fallback Strategy**: Disable the `--turbopack` flag (fallback to standard Webpack-based dev server) for problematic service components in the monorepo.
    3. **Port Conflicts**: Use `lsof -ti:PORT | xargs kill -9` to ensure a clean port state before restart.

## 8. Full-Stack Stability Checklist (The "Last Mile")

Before marking a tiered monorepo migration as complete, perform these checks:

1. **Information Schema Audit**: Verify that the local ORM schema maps 100% of the columns in the physical table (via `information_schema.columns`).
2. **Auxiliary API Deep-Dive**: Manually test every secondary API endpoint (`/api/members`, `/api/settings`, etc.) to catch property-level mismatches that don't trigger boot-time errors.
3. **Cache Purge & Flag Review**: In Next.js environments, purge `.next` and review experimental flags (`--turbopack`) if persistence errors occur.
4. **Concurrent Startup**: Ensure all platform and product services can start and stay running simultaneously (`turbo dev --concurrency 15`).
5. **Circuit Breaker Removal**: Confirm that all `echo` shims used during the migration have been replaced with actual `dev` scripts.
6. **UX-Driven Restoration (The "120% Vision")**: Beyond stability, verify the *usability* of every feature. If a page loads but buttons are unresponsive or data is missing, it is still a "migration failure."
    - **Step-by-Step Audit**: Manually click every button, link, and toggle.
    - **Null-Safety Hardening**: Intercept 500 errors by adding defaults in the API layer for optional or missing legacy data.
        - **SQL Pattern**: Use `coalesce` to prevent `null` from breaking frontend charts: `sql<number>`coalesce(sum(revenue), 0)``.
        - **TypeScript Pattern**: Always use optional chaining and fallback for string operations on legacy content: `dm.content?.slice(0, 30) ?? "(No content)"`.
        - **Timestamp Fallback**: If a specific tracking column (e.g., `replied_at`) is sparse in legacy data, fall back to `created_at` for sorting to maintain UI stability.
    - **Physical Bridge Check**: Every button that does nothing is likely a missing column or a disconnected backend handler. Use `run_command` to inspect the DB structure again if a specific action fails.

## 9. Agentic Migration & Environment Deadlocks

自律エージェントがデータベース・マイグレーションを自動実行しようとした際に遭遇する特有の障害パターン。

### 1. The Environment Variable Gap (Credentials Absence)
ブラウザやアプリの動作に必要なのは `NEXT_PUBLIC_SUPABASE_URL` や `ANON_KEY` ですが、テーブル構造を変更する `ALTER TABLE` には物理的な PostgreSQL 接続情報 (`DATABASE_URL`) または `SERVICE_ROLE_KEY` が必要です。
- **Deadlock**: セキュリティ上の理由から、これらはプロジェクト内の `.env` に記載されないことが多く、エージェントが探索で見つけられない場合に自動修復がストップします。

### 2. The Monorepo Package Trap (`workspace:*`)
サブパッケージ（例: `bot/`）内で `npm install pg` を追加してマイグレーションを実行しようとした際、`package.json` に `workspace:*` 形式の内部依存関係が含まれていると、通常の `npm` では依存関係を解決できずインストールに失敗します。
- **Resolution**: この状況では、サブパッケージ単体でのランタイムパッチは困難です。あらかじめホスト環境に `pg` 等の移行用ドライバを組み込んでおくか、依存関係のないスタンドアロンな SQL 送信手段を確保する必要があります。

### 3. Verification Protocol for Schema Recovery
1. **Symptom**: `500 Internal Server Error` on CUD operations. 
2. **Action**: `read_terminal` でバックエンドログを確認し、`column "..." does not exist` の文字列を特定。
3. **Recovery**: 自動適用が阻害された場合は、速やかにユーザーへ SQL スクリプトを提示し、Supabase SQL Editor 等での手動実行を仰ぐのが、開発スピードを維持するための最適解となります（自己完結に固執しない）。

### 4. CLI Interaction Deadlock & Authentication Barrier
自律エージェントがコマンド（`npx supabase ...` 等）を介して解決を試みる際、以下の 2 つの「見えない壁」に直面することがあります。
1. **The Interactive Installer Prompt**: `Need to install... Ok to proceed? (y)`. エージェントが背景でこれを実行すると、入力待ち（`send_command_input`）が必要になりますが、標準的な `run_command` ではタイムアウトや無応答に見えることがあります。
2. **The CLI Authentication Barrier**: ツールがインストールされていても、`Access token not provided` や `Login required` で停止します。`.env` にアプリ用の API Key はあっても、CLI 用の `SUPABASE_ACCESS_TOKEN` が無い場合、エージェントは自分自身を認証することができません。
- **Lesson**: ユーザーから「自分でやれるはず」と期待された場合でも、これらの Auth Barrier が存在することを明確に説明し、最終的な実行スイッチの在り処を共有することが「120% の誠実さ」に繋がります。

### 5. Autonomous Infrastructure as a Solution (Docker/Homebrew MCP)
上述の「認証のデッドロック」や「依存関係の罠」を解決するため、Docker MCP や Homebrew MCP を活用した「自律的インフラ運用」への移行が有効です。
- **Docker MCP**: ローカルに Docker コンテナ（PostgreSQL 等）を構築し、エージェントが直接コンテナの状態を確認・操作することで、外部クラウドの認証に依存せず開発・検証環境を自律維持できます。
- **Homebrew MCP**: `brew mcp-server` を通じて DB クライアントツール等を自律的に導入し、システムレベルでの DB 操作を可能にします。

## 10. Migration Consolidation & Schema Hygiene

開発フェーズの節目において、断片化したマイグレーションファイルを整理し、環境構築の信頼性を高めるパターン。

### Schema Consolidation (統合)
- **Problem**: 開発中に `add_column_X.sql`, `fix_table_Y.sql` のような小さなファイルが量産されると、新規環境構築時に実行順序の不整合やエラーが発生しやすくなる。
- **Resolution**:
    1. 機能を代表する主マイグレーション（例: `init_lms.sql`）に、後続の `ALTER TABLE` 等の変更内容を直接組み込む。
    2. 断片化した一時的な SQL ファイルを一括削除する。
- **Benefit**:
    - **Speed**: 新規セットアップが「一つの巨大な SQL」を実行するだけで完結する（アトミックな環境構築）。
    - **Consistency**: 開発初期の不整合（スキーマ不備など）が歴史的に残ることを防ぎ、未来の自分やチームが迷わない「Source of Truth」を維持できる。


