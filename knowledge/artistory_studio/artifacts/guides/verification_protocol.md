# LMS Verification & Maintenance Guide

## 1. Credential Verification (The 401 Fix)
If the system returns `401 Unauthorized` or `Invalid API Key`, perform the following check:

- **JWT Format Check**: Supabase keys must be in JWT format (starting with `eyJ`).
- **Label Identification**: Do **NOT** use keys starting with `sb_publishable_...` or `sb_secret_...`. These are labels provided by the Supabase dashboard and are not valid for API authentication.
- **Bot Sync**: Ensure both the Next.js `.env.local` and the `discord-buddy/bot/.env` use the same service role and anon keys.
- **Guild ID Consistency**: The `NEXT_PUBLIC_DISCORD_GUILD_ID` must match the actual Discord Server ID. If missing, the system may fallback to a hardcoded test ID (e.g., `1465...`), which will cause cross-environment unlock failures.

## 2. LMS Functional Trace
To verify the system end-to-end:
1. **Admin Creation**: Create a course, add a module, and add a content item.
2. **Role Link**: Select a Discord role in the settings and save. Verify `sonner` success toast.
3. **Public View**: Navigate to `/lms` and ensure the course appears.
4. **User View**: Login as a test user and check if the "Locked/Unlocked" state matches the user's roles.
5. **Deletion**: Delete the module, then the course. Verify immediate cache invalidation.

## 3. Maintenance Protocols
- **Schema Drift**: If the DB schema changes, update `utils/lms-types.ts` immediately.
- **Port Management**: Ensure Next.js (3000) and Bot API (3100) are both running. 
    - Use `lsof -i :3100` to clear zombie processes.
    - Test the user role endpoint: `curl "http://localhost:3100/api/bot/member?guildId=[ID]&userId=[ID]"` to ensure the bot can fetch member details correctly.
- **Turbopack Cache**: If the server fails with "invalid digit" errors, run `rm -rf .next` and verify environment variable formats.
- **Local Dev Roles**: ローカル開発ユーザー（Supabase UUID）を使用して Discord ロール取得を試みると、Bot API ログに `user_id ... is not snowflake` (Invalid Form Body) が出力されます。これは、Discord API が UUID を受け付けないための正常な挙動です。本番環境での Discord ログイン時には解消されます。
- **Middleware Deprecation**: Next.js 16+ では `middleware.ts` が非推奨となり `proxy.ts` 等への移行が推奨される場合があります。サーバー起動時の警告に注意してください。
