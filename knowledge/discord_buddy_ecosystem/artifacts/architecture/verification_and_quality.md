# Verification & Quality Assurance (120% Loop)

## 1. The 120% Quality Loop (Feedback Loop / FBL)
The "120% Quality Loop" is a SoloProStudio/Antigravity standard requiring that every feature is not only "functional" but "verified and polished" to exceed expectations. 

### /fbl Command Workflow
As of Jan 2026, the `/fbl` command triggers a formalized 4-step autonomous loop:
1.  **User Experience Verification (Browser)**: Use `browser_subagent` to verify all screen transitions, interactions, and animations. Identify "intuitive discomfort" or "lack of premium feel."
2.  **Review Documentation**: Update `docs/review.md` (or relevant artifact) with:
    - **Current Status**: Facts from verification.
    - **Issues**: Factors hurting UX (bugs, roughness, inconsistency).
    - **Solutions**: Specific implementation plans to exceed expectations.
3.  **Solution Implementation**: Execute the defined solutions with atomic implementations and strict quality (TypeScript strict, etc.).
4.  **Autonomous Feedback Loop (Target: 120 points)**: Repeat steps 1-3 autonomously until all issues are resolved and the experience reaches "感动 (emotionally moving)" levels (120% quality).

## 2. Mock Session Bypass Pattern (Face-pass)

When standard Discord OAuth2 authentication becomes a bottleneck for local development and rapid verification, the **Mock Session Bypass** pattern is used to simulate a logged-in user state.

### Implementation Pattern (Next.js)
In the dashboard's authentication library (e.g., `lib/auth.ts`), the `getSession` function is temporarily patched to return a hardcoded session.

```typescript
export async function getSession(): Promise<Session | null> {
    // MOCK SESSION FOR VERIFICATION (Face-pass Pattern)
    return {
        user: {
            id: '392284572118810635', // Primary Developer / Super Admin ID
            username: 'admin',
            displayName: 'Dev Admin',
            avatar: 'https://cdn.discordapp.com/embed/avatars/0.png'
        },
        accessToken: 'mock_token',
        refreshToken: 'mock_refresh',
        expiresAt: Date.now() + 100000000
    };
}
```

### Strategic Benefits
1. **Network Independence**: Test protected routes without a working internet connection or Discord API availability.
2. **Rate Limit Avoidance**: Bypass Discord OAuth2 rate limits during intensive UI testing.
3. **Identity Stability**: Ensure testing occurs under a specific, stable User ID that is already mapped to tenants/servers in the development database.
4. **Transition Testing**: Allows the `Browser Subagent` to navigate the entire dashboard (Server List -> Detail -> Bot Settings) autonomously to verify 120% quality.

### Important: Cleanup Protocol
This is a **High-Risk Temporary Patch**. 
- It MUST be reverted before any non-local deployment.
- It should be clearly marked with `// MOCK SESSION FOR VERIFICATION`.
- The `requireSession` function should still be used throughout the app to ensure that once the patch is removed, the security posture returns to normal.

## 4. Automated Verification (Browser Subagent)

For large-scale monorepo dashboards, manual verification becomes unsustainable. The **Browser Subagent** is used to perform end-to-end (E2E) journey audits.

### Standard Test Pattern
1.  **Preparation**: Apply the **Mock Session Bypass** to avoid OAuth bottlenecks.
2.  **Navigation**: Direct the agent to `http://localhost:[port]/dashboard`.
3.  **State Inspection**: Instruct the agent to capture screenshots at key transition points (e.g., `dashboard_loaded`, `server_selected`, `invite_button_visible`).
4.  **Attribute Audit**: Use the agent to extract specific DOM attributes (like `href` or `data-client-id`) to verify backend-to-frontend data integrity.
5.  **Evidence Collection**: Screenshots and recordings serve as the verification proof for the "120% Quality" requirement.

### Verified Pattern: Bot Invite Audit
A recurring audit pattern involves verifying that bot invitation links in a multi-tenant dashboard are logically correct and point to the right App ID.
- **Agent Logic**: Click into a server -> Scroll to Bot List -> Extract Bot Invite URL -> Compare `client_id` against the product's expected ID.
- **Success Anchor**: `client_id=1459752090279612519` confirmed for Hype Buddy on 2026-01-28.
