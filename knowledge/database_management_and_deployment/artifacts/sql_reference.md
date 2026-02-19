# SQL Reference: Slide Feedback Loop

This script is used to create the `slide_feedback` table. It includes idempotency patterns to avoid "already exists" errors.

```sql
-- STAGE 3 Part 3: Slide Feedback Loop
-- Records user edits to improve future generation.

-- Ensure the UUID extension is enabled (Common source of "function uuid_generate_v4() does not exist" error)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing table to ensure clean state and avoid synchronization errors
DROP TABLE IF EXISTS public.slide_feedback;

CREATE TABLE public.slide_feedback (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  section_title text, -- Context for the feedback (optional)
  
  -- The detailed change
  original_json jsonb, -- The content BEFORE edit
  revised_json jsonb, -- The content AFTER edit (Good Example)
  
  -- Admin context
  feedback_comment text, -- "More concrete numbers needed", "Too aggressive", etc.
  
  created_at timestamptz DEFAULT now()
);

-- Row Level Security (RLS)
ALTER TABLE public.slide_feedback ENABLE ROW LEVEL SECURITY;

-- Policy (adjust as needed, currently allowing authenticated insert)
CREATE POLICY "Allow authenticated insert"
  ON public.slide_feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
```

## Troubleshooting

### Error: "function uuid_generate_v4() does not exist"
**Cause**: The PostgreSQL extension `uuid-ossp` is not enabled in your database.
**Fix**: Run `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";` (included in the script above) in the Supabase SQL Editor.

### Error: "type 'timestampz' does not exist"
**Cause**: `timestampz` is not a valid PostgreSQL type.
**Fix**: Use `timestamptz` (Time Stamp with Time Zone).

### Error: "relation 'projects' does not exist"
**Cause**: The `slide_feedback` table has a foreign key reference to a `projects` table which may only exist in the local IndexedDB but not yet in the cloud Supabase schema.

**Fix (The "Chicken and Egg" Workaround)**:
When migrating a peripheral feature (like feedback) to the cloud before the core schema (like projects), remove the `REFERENCES` constraint and use a plain `uuid` for the column. 

```sql
-- Modified table creation without foreign key constraint
CREATE TABLE public.slide_feedback (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id uuid NOT NULL, -- Plain UUID without REFERENCES public.projects(id)
  -- ... other fields
);
```

**Post-Migration Note**: Once the `projects` table is migrated to the cloud, add the constraint back via:
```sql
ALTER TABLE public.slide_feedback
ADD CONSTRAINT fk_projects
FOREIGN KEY (project_id) REFERENCES public.projects(id)
ON DELETE CASCADE;
```

### Error: "syntax error at or near 'verbose'"
**Cause**: `verbose` is a reserved word in PostgreSQL. Using it as a raw column name in a `CREATE TABLE` statement will trigger a syntax error.

**Fix**: Enclose the column name in double quotes: `"verbose"`.

```sql
-- Before
verbose BOOLEAN DEFAULT true,

-- After
"verbose" BOOLEAN DEFAULT true,
```

## SQL Reference: Multi-Tenant Task Execution (crew_runs)

Example of a table using internal UUIDs for multi-tenant isolation, as resolved from platform IDs (Snowflakes).

```sql
-- CrewAI Task Execution Logs (crew_runs)
-- server_id and tenant_id are internal UUIDs
CREATE TABLE IF NOT EXISTS crew_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  server_id UUID REFERENCES tenant_servers(id) ON DELETE CASCADE,
  
  -- Context
  channel_id TEXT NOT NULL, -- Discord Channel ID (Snowflake)
  thread_id TEXT,           -- Discord Thread ID (Snowflake)
  started_by TEXT NOT NULL, -- Discord User ID (Snowflake)
  
  -- Task Definition
  agent_ids UUID[] NOT NULL,
  task_description TEXT NOT NULL,
  
  -- Status & Results
  status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  result TEXT,
  error_message TEXT,
  
  -- Evaluation
  human_rating INT CHECK (human_rating BETWEEN 1 AND 5),
  ai_score INT CHECK (ai_score BETWEEN 0 AND 100),
  ai_feedback TEXT,
  
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);
```

### Key Design Choice: ID Separation
The table stores **Discord Snowflakes** (`channel_id`, `started_by`) in `TEXT` columns because they are external references, but uses **Internal UUIDs** (`server_id`, `tenant_id`) for foreign keys. This prevents the Dashboard from needing to know or filter by Discord Snowflakes, which simplifies logic and improves data integrity.

