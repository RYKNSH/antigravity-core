# Vercel Postgres and Environment Configuration

## Database Setup
1. **Create Database**: Use the Vercel dashboard to create a new Postgres database instance.
2. **Environment Variables**:
   - `POSTGRES_URL`: The primary connection string.
   - `JWT_SECRET`: Used for authentication.
   - `VITE_ANALYTICS_ENDPOINT` & `VITE_ANALYTICS_WEBSITE_ID`: For client-side analytics.

## Schema Migration
- Ensure the database schema is pushed to the production instance before deploying the logic that depends on it.
- Use tools like `drizzle-kit push` or similar depending on the ORM used.

## Configuration Checklist
- [ ] `POSTGRES_URL` matches the production instance.
- [ ] All necessary env vars are defined in both Vercel settings and local `.env`.
- [ ] Database schema is up to date.
