# Local to Production Database Transition Patterns

This document outlines the strategy for moving a project from a local development environment (using Docker for persistence) to a production-ready cloud environment.

## 1. The "Simulator" Philosophy
In the Antigravity ecosystem, **Docker is viewed as a "simulator"** for the production environment. 
- It provides the same database technology (e.g., PostgreSQL 15) without polluting the host machine.
- It allows the agent to verify schemas, migrations, and query logic locally.

## 2. Environment Variable Abstraction
The application code should be agnostic of the database's physical location. This is achieved via the `DATABASE_URL` environment variable.

### Local Configuration (`.env.local`)
Points to the Docker container.
```bash
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/hype_buddy
```

### Production Configuration (Cloud Provider Secrets)
Points to the managed database service.
```bash
DATABASE_URL=postgresql+asyncpg://railway-server.net:5432/main_db?ssl=require
```

## 3. Transition Steps

### A. Cloud DB Provisioning
Select a provider (Railway, Supabase, Neon) and create a PostgreSQL instance.

### B. URL Swap
Update the environment variables in the production hosting provider (e.g., Vercel, Railway, or VPS). No code changes should be required if the `DatabaseManager` is correctly implemented.

### C. Schema Migration
Run the initialization or migration scripts against the production URL.
```bash
# Example: Running the seed script against prod (only once)
DATABASE_URL=prod_url uv run python -m scripts.init_db
```

## 4. Architectural Considerations
- **SSL Connection**: Production databases usually require SSL. Ensure the connection string or client configuration handles `ssl=require`.
- **Session Pooling**: If using serverless architectures (like Supabase), use a connection pooler (Transaction mode) to avoid exceeding connection limits.
- **Portability**: Keep the Docker setup in the repository so that new agents or contributors can start developing instantly without needing cloud credentials.
