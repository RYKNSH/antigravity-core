# Vercel Deployment Workflow (CLI Fallback)

This document outlines the workflow for deploying Next.js dashboards within a monorepo to Vercel using the Vercel CLI, particularly when automated MCP (Model Context Protocol) integration is unavailable.

## 1. CLI Installation
If the `vercel` command is missing, install it globally via npm:
```bash
npm install -g vercel
```

## 2. Monorepo Considerations
When deploying an application from a **Turborepo** or monorepo structure:
- **Project Linking**: Link the local directory to a Vercel project once.
  ```bash
  vercel link
  ```
- **Root Directory**: Ensure Vercel is configured to look at the specific application subdirectory (e.g., `apps/dashboard`). This is usually handled in the Vercel Dashboard settings or via `vercel.json`.

## 3. Deployment Triggers
### Development (Preview)
Deploy a preview instance without finalizing:
```bash
vercel
```

### Production
Push the current local state to the production domain:
```bash
vercel --prod
```

## 4. MCP Server Fallback Logic
If an AI agent attempts to use a `vercel` MCP server and receives a "server name vercel not found" error:
1.  **Stop** trying to use specialized MCP tools.
2.  **Verify** the environment by checking for `vercel` in the PATH.
3.  **Execute** using standard terminal commands (`run_command`) to complete the deployment autonomously.

## 5. Environment Synchronization
- Ensure all Supabase environment variables (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`) are added to the Vercel Project settings.
- Use `vercel env pull .env.local` to sync production environment variables back to the local development environment if needed.

## 6. Authentication Troubleshooting
### Device Login Flow
If the CLI reports an invalid or expired token:
1.  Run `vercel login`.
2.  Choose the default login method.
3.  The CLI will display an 8-character **Device Code** (e.g., `XXXX-XXXX`).
4.  Visit `https://vercel.com/device` and enter the code.
5.  After browser confirmation, the CLI will automatically sync the new token.
6.  Retry the deployment command with `--prod`.

### Non-Interactive Deployments
For CI/CD or fully automated environments, use the `VERCEL_TOKEN` environment variable to bypass the interactive login prompt.

## 7. Turborepo / Monorepo Root Configuration
When deploying a sub-package (e.g., `apps/dashboard`) that depends on workspace packages (e.g., `packages/bot-utils`), the default Vercel build may fail if it tries to run `npm install` inside the sub-package directory.

### The "Sub-directory install" Failure
Attempting to fix this by setting `installCommand` to `cd ../.. && npm install` in `apps/dashboard/vercel.json` often fails with `npm error Tracker "idealTree" already exists` due to Vercel's isolated build environment and lockfile tracking.

### The "Root Configuration" Pattern
The most robust solution is to place the `vercel.json` at the **monorepo root** and explicitly filter the build to the target package.

**File: `vercel.json` (at Root)**
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "cd apps/dashboard && npm run build",
  "outputDirectory": "apps/dashboard/.next",
  "installCommand": "npm install",
  "framework": "nextjs"
}
```
This pattern ensures:
1. `npm install` is run at the root (resolving all workspace dependencies).
2. The build command enters the specific sub-application directory to execute the framework build.
3. Vercel correctly locates the `.next` output in the sub-project directory via `outputDirectory`.

### The Evolved "Prefix-based" Pattern (Most Robust)
If the hybrid `cd` command still fails due to environment or Turborepo conflicts, use the explicit `--prefix` pattern. This is the battle-tested configuration for the Discord Buddy monorepo.

**File: `vercel.json` (at Root)**
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npm install --prefix apps/dashboard && npm run build --prefix apps/dashboard",
  "outputDirectory": "apps/dashboard/.next",
  "installCommand": "npm install",
  "framework": "nextjs"
}
```

This ensures:
1. The root `npm install` handles shared workspace dependencies.
2. The `apps/dashboard` specific dependencies are explicitly handled via prefix.
3. The build command executes without changing the working directory, avoiding relative path resolution bugs.

## 8. GitHub-Triggered Automatic Deployment
If the Vercel CLI reports permission errors (e.g., "Git author must have access to the team"), the recommended path is to use the GitHub integration.

### Steps:
1.  **Configure `vercel.json`**: Ensure the monorepo root contains the `vercel.json` with the Hybrid Command (see Section 7).
2.  **Commit and Push**:
    ```bash
    git add vercel.json
    git commit -m "chore: add root vercel.json for monorepo"
    git push origin main
    ```
3.  **Vercel Auto-Detection**: Vercel will detect the push and automatically trigger a build using the settings in `vercel.json`.

## 9. Environment Variable Migration
To quickly set up production environment variables in Vercel using values from your local `.env`:

### 1. Extract Values
Use `grep` to extract necessary keys (e.g., Supabase, Discord coefficients):
```bash
cat .env | grep -E "^(SUPABASE_|DISCORD_CLIENT_)"
```

### 2. Required Variables for Dashboard
Ensure the following are set in the Vercel Project Settings (**Settings > Environment Variables**):
- `SUPABASE_URL`
- `SUPABASE_KEY` (anon)
- `SUPABASE_SERVICE_KEY`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `NEXTAUTH_URL` (The final Vercel production URL)

## 10. Forcing a Redeploy (Empty Commit)
When you update environment variables or project settings in the Vercel Dashboard, Vercel does not always automatically trigger a new build. To force a redeploy without making code changes:

```bash
git commit --allow-empty -m "trigger: redeploy after env update"
git push origin main
```

This is the most reliable way to ensure that the latest dashboard-side configurations are incorporated into the production build.

## 11. Type Definition Safety and Dependency Placement
When adding new libraries (e.g., `uuid`, `lodash`) to a sub-application in a TypeScript monorepo:
- **Strict Checking**: Next.js builds on Vercel will fail if type definitions are missing.
- **Dependency Placement**: While typically installed in `devDependencies`, Vercel monorepo builds sometimes skip these during production cycles.
- **The Fix**: If the build fails to find types despite being in `devDependencies`, move them to **`dependencies`**:
  ```bash
  npm install @types/uuid --prefix apps/dashboard
  ```
- **Verification**: Run `npm run build` locally within the sub-app directory to catch these errors before pushing to production.

## 12. Subdomain Management during Restructuring
When transitioning from a sub-directory project link (`apps/dashboard`) to a root-monorepo link (`/`):
- **Project Re-linking**: Vercel may create a separate project entry in your dashboard for the new structure.
- **Vanity URL Orphans**: Previous domains (e.g., `dashboard.vercel.app`) may still be associated with the old sub-directory project and will return 404s if the new project has not yet claimed them.
- **Verification Flow**: 
    1. Check build logs for the explicitly assigned `Production:` URL.
    2. Visit the Vercel Dashboard for the *new* project.
    3. Manually re-alias the production domain in **Settings > Domains** if necessary.

## 13. Invalidating Build Cache (Manual Redeploy)
If a build continues to fail with errors related to missing dependencies or stale code after a fix has been pushed:
- **Default Behavior**: Vercel attempts to speed up builds by caching `node_modules` and previous build results.
- **The Fix**: Trigger a clean redeploy from the Vercel Dashboard:
    1. Go to the **Deployments** tab.
    2. Click the three dots (`...`) on the latest deployment.
    3. Select **Redeploy**.
    4. **CRITICAL**: Uncheck **"Use existing Build Cache"**.
    5. Click **Redeploy**.
- **When to use**:
    - After adding `@types/` packages that weren't being picked up.
    - After major refactorings that change the project's root context.
    - When environment variable updates don't seem to take effect even after an empty commit.

## 14. Native API Preference for Build Stability
To minimize "Module not found" and "Type error" failures in cloud-based builds:
- **Strategy**: Whenever possible, replace external utility libraries with built-in Node.js or Web APIs.
- **Example**: Replace `uuid` with `crypto.randomUUID()`.
- **Benefits**:
    - **No Installation**: Built-in APIs are always available.
    - **Native Types**: No `@types/` packages required; types are standard across environments.
    - **ESM Friendly**: No interoperability issues between CommonJS and ES Modules.
- **Case Study**: In the Discord Buddy monorepo, the dashboard build persistently failed on Vercel due to `uuid` type resolution errors despite various package-level fixes. Switching to `crypto.randomUUID()` was the only measure that consistently bypassed these cloud-specific build bottlenecks.
- **Implementation**:
    ```typescript
    // Before: import { v4 as uuidv4 } from 'uuid';
    // After: (No import needed or import from 'node:crypto')
    const id = crypto.randomUUID();
    ```

## 15. IDE Stability and Platform Conflicts
When executing Vercel-specific tasks in high-complexity monorepos, the **Antigravity IDE** may occasionally crash. This is typically observed when:
1.  Running `vercel --prod` from the integrated terminal.
2.  Rapidly switching between large configuration files while a build is running.

**Resolution**: Use a **standalone terminal** outside of the IDE environment for all deployment-related CLI operations to ensure both the IDE and the deployment process remain stable.

**Note on PATH Resolution**: When switching to a standalone terminal, ensure your environment is correctly loaded (e.g., `source ~/.nvm/nvm.sh`) if commands like `npm` or `vercel` are not found.
