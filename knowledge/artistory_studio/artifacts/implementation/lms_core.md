# LMS Core: Implementation & Logic

ARTISTORY STUDIO implements a "Hybrid LMS" that combines deep Discord integration with an easy-to-manage web CMS.

## 1. Data Model Hierarchy
The system uses a four-tier relationship in Supabase:
1. **Course**: Maps 1:1 to a Discord progression role via `discord_role_id`.
2. **Module**: Logical chapters with `unlock_criteria` (JSONB).
3. **Content**: Individual lessons (`video`, `article`, `mission`, `discord_thread`).
4. **User Progress**: Junction table tracking `(user_id, content_id)` with status (`completed`, `in_progress`).

## 2. Trusted Admin Pattern (Security)
To manage data safely without complex RLS, we utilize Server Actions:
- **`utils/supabase-admin.ts`**: Initialized with `SUPABASE_SERVICE_ROLE_KEY` and guarded by `import 'server-only'`.
- **`app/actions/lms-admin.ts`**: High-privilege CUD operations (Create/Update/Delete course elements).
- **`app/actions/lms-progress.ts`**: Managed upserts into `user_progress` using the Service Role.
- **Client Usage**: The standard `supabase` (Anon Key) is used for read-only `SELECT` queries where RLS allows public access.

## 3. Unlock & Progress Logic (`utils/lms-progress.ts`)
The intelligence layer determines what a user can see:
- **Role-Based Check**: `checkUnlockStatus` matches the user's Discord role list against the module's `unlock_criteria`. It converts numeric role IDs to strings for robust matching.
- **Progress Calculation**: `calculateCourseProgress` aggregates completed content items from the `user_progress` table to provide a percentage (0-100%).
- **UI State**: 
    - **Locked**: Modules and contents display a 🔒 icon. Links are disabled via `pointer-events-none`.
    - **Completed**: Content items display a green checkmark (`CheckCircle`). Courses on the list page show a "✅ Completed" overlay when reaching 100%.

## 4. Discord Integration Layer (Bot Bridge)
- **Role List**: `utils/discord.ts::fetchDiscordRoles` calls `GET /api/bot/roles` to populate the Admin Role Picker.
- **User Verification**: `utils/discord.ts::fetchUserRoles` calls `GET /api/bot/member` (Port 3100) to fetch the current user's role list in real-time.
- **Cache Strategy**: User role fetches use Next.js `fetch` with a short revalidation period (e.g., 60s) to balance freshness and performance.
- **Access Control**: Linking a Discord Role ID to a Course or Module ensures that only authorized users can interact with the protected content.

## 5. UI/UX Standards (120% Quality)
- **Feedback**: `sonner` toasts for all atomic actions.
- **Safety**: "Danger Zone" confirms destructive deletions with absolute transparency.
- **Clarity**: Type-specific icons for lessons (📺 for video, 🎯 for missions).
- **Loading**: Centered spinners and persistent state feedback to minimize layout shifts.

## 6. User-Facing Content View (`app/lms/[courseId]/content/[contentId]/page.tsx`)
The final stage of the learning loop:
- **Dynamic Media Rendering**:
    - **Video**: Embeds YouTube/Vimeo URLs using standard iframe patterns.
    - **Mission**: Features a high-contrast `indigo` UI with a direct link to the mission brief.
    - **Article/Text**: Logic for rendering HTML/Markdown body.
- **Interaction Flow**:
    - **Page-Level Protection**: Re-verifies `checkUnlockStatus` using `fetchUserRoles` before rendering to prevent URL-direct access to locked content.
    - **Completion Action**: A "Mark as Complete" button triggers the `updateProgress` server action, which persists the state and revalidates the cache to update progress bars instantly.
    - **Breadcrumbs**: Unified header with a back button to the Course Detail and the current Module title.
## 7. Submission & Approval Workflow (Upcoming Architecture)
To balance student privacy with high-quality progression, the system is evolving from a "Self-Check" model to a "Moderated Submission" model:

- **Privacy Layer**: Students submit assignments (links, images, text) through a private form on the Content View page. These are stored in a `submissions` table, visible only to the student and Admins.
- **Admin Moderation**: Admins review submissions in the `/admin` dashboard.
- **Hybrid Unlock Logic**:
    - **Module Level**: Approval of a module's "Level-up Task" unlocks the next module in the LMS (Self-contained in Web).
    - **Course Level**: Approval of the final module triggers the **Discord Role Assignment** via the Bot API, unlocking new community channels as a reward for course completion.
- **Discord Privacy**: Students do not have to share "unripe" work in public Discord threads. Only the successful "Role Level-up" is visible to the community, maintaining a high-quality vibe in public channels.

## 8. Drag-and-Drop Reordering Persistence
To provide a premium administration experience, the LMS supports intuitive reordering of modules and content:
- **Backend Persistence**: `reorderModules` and `reorderContents` (in `lms-admin.ts`) accept an array of `{ id, order_index }`. They perform batched parallel updates using `Promise.all` for efficiency, ensuring the database state matches the visual order.
- **Frontend Integration**: Utilizes `@hello-pangea/dnd` for fluid drag animations.
- **Optimistic UI**: The `AdminCourseEditPage` updates React state immediately on `onDragEnd` and uses `toast.promise` to provide real-time feedback while the server actions execute in the background.
- **Nested Context**: Droppable IDs are mapped to Module IDs, allowing the system to distinguish between module-level and content-level drag events reliably.
