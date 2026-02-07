# Railway MySQL + Vercel Hybrid Deployment Pattern

This pattern is used when a project requires a persistent MySQL database (which Vercel does not natively provide as a simple "Storage" option like Postgres) and a frontend/API hosted on Vercel.

## 1. Provisioning Railway MySQL

1. **Dashboard**: Go to [Railway App](https://railway.app/).
2. **Setup**: "New" -> "Database" -> "Add MySQL".
3. **Internal vs Public**:
   - Railway provides both internal (for services inside Railway) and public (for Vercel) connection strings.
   - Use the **Public Connection URL** (e.g., `mysql://root:password@host:port/railway`) for Vercel environment variables.

## 2. Environment Variables in Vercel

```bash
# Add the DATABASE_URL to Vercel production
vercel env add DATABASE_URL production
# Input the URL when prompted
```

## 3. Database Migrations (Drizzle Example)

When running migrations from a local environment or a GitHub Action to the Railway instance:

```bash
# Local execution using the temporary shell variable
DATABASE_URL="mysql://root:password@host:port/railway" pnpm run db:push
```

## 4. Key Learnings & Troubleshooting

- **Project Quotas**: Railway may block new database creation with "Project Limit Reached". Resolve this by deleting unused projects and selecting **"Delete Immediately"** to bypass the 48-hour grace period.
- **Vite Build Cache**: When updating `DATABASE_URL` (or any `VITE_` variables) on Vercel, you **MUST** redeploy and **Uncheck "Use existing Build Cache"**. Vite performs static replacement at build time; if the cache is used, the old strings may persist in the build artifacts.
- **Nixpacks Detector**: If also deploying the backend to Railway, Railway's Nixpacks will automatically detect the database and inject connection variables if the services are in the same project.
