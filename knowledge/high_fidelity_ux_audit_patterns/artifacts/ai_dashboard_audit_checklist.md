# AI Dashboard UX/UI Audit Checklist (50 Points)

This checklist is designed to transform a "functional" AI dashboard into a "120% Premium" experience, focusing on trust, clarity, and aesthetic polish.

## 1. Visual Polish & Branding (10 Points)
- [ ] **Ambient Depth**: Is there a non-flat background? (Use blurred gradient blobs or mesh gradients).
- [ ] **Emissive Elements**: Do active elements (progress bars, status dots) appear to emit light? (Use glows/box-shadows).
- [ ] **Glassmorphism Consistency**: Is `backdrop-filter: blur()` used consistently across modals and cards?
- [ ] **Dynamic Gradients**: Are branding elements (titles, primary buttons) using high-quality multicolor gradients?
- [ ] **Typography Scale**: Is there a clear hierarchy between Job IDs (Mono) and Status labels (Bold/Caps)?
- [ ] **Iconography Cohesion**: Are all icons from the same set (e.g., Lucide) and using consistent stroke weights?
- [ ] **Subtle Borders**: Are borders semi-transparent (`border-white/10`) to let background ambient colors bleed through?
- [ ] **Selection Highlighting**: Does the text selection color match the brand accent (`selection:bg-cyan-500/30`)?
- [ ] **Empty State Illustration**: Do "No Jobs" states have a subtle SVG illustration or themed graphic instead of just text?
- [ ] **Loading Shimmer**: Do skeletal loaders or active progress bars have a moving shimmer effect?
- [ ] **Action Minimization**: Can a user complete the core workflow (Ingest to Approval) with less than 3 clicks?

## 2. Interaction & Feedback (15 Points)
- [ ] **Reactive Activity**: Does the UI "pulse" or spin ONLY when there is actual background activity?
- [ ] **Hover Affordance**: Do interactive cards have a distinct hover state (e.g., border color change or background glow)?
- [ ] **Click Feedback**: Is there a visual response (e.g., slight shrink or flash) when a button is clicked?
- [ ] **Toast Notifications**: Are non-critical errors (e.g., "Copied to clipboard") shown in a toast instead of a modal/alert?
- [ ] **Direct Drop Zones**: Can files be dropped anywhere on the screen, or is the drop zone too small?
- [ ] **Upload Progress**: Is there a percentage or granular progress bar for the *upload* phase itself?
- [ ] **Navigation Smoothness**: Are section transitions using `framer-motion` for opacity/Y-axis shifts?
- [ ] **Modal Entry**: Do modals "spring" or "fade-scale" in rather than appearing instantly?
- [ ] **Context Menus**: Do complex items (Job cards) have right-click or triple-dot menus for advanced actions?
- [ ] **Drag States**: Is there a clear "Ready to Drop" visual state for the entire dashboard?
- [ ] **Keyboard Shortcuts**: Can users navigate or close modals using `Esc`, `J/K/L` (for video), or `Enter`?
- [ ] **Tooltips**: Do icon-only buttons have descriptive tooltips on hover?
- [ ] **Scroll Snapping**: In long lists or horizontal galleries, is scroll snapping used for "clean" alignment?
- [ ] **Audio/Video Feedback**: Are video play/pause/mute actions accompanied by subtle UI overlays?
- [ ] **Confirmations for Deletion**: Are "Reject" or "Delete" actions guarded by a confirmation state (not just a generic alert)?
- [ ] **Non-Blocking Handlers**: Are asynchronous handlers (like "Approve" or "Export") free of browser-native `alert()` or `confirm()` calls that block the event loop and create a "perceived hang" in the UI? (Use toasts or descriptive modals instead).
- [ ] **Child-Friendly Intuition**: Can a non-technical elementary school student understand the primary function of every screen within 5 seconds without a manual?
- [ ] **Celebration Loops**: Are successful interactions (e.g., upload complete) celebrated with subtle animations or temporary festive icons (🎉, ✨)?
- [ ] **Geometric Confetti Logic**: 成功報酬的なインタラクションとして、特定の操作完了時にその要素の座標からパーティクルを発生させるパターンを導入。
- [ ] **Onboarding Overlays**: If a complex area (like a Studio canvas) is empty, does it display an overlay with clear instructions and quick-start buttons?
- [ ] **Anti-Silent Success Trap**: Do non-terminal status changes (like "Reject" or "Archive") trigger a radical visual state change (e.g., card grayscale + 60% opacity)? If the UI looks identical before and after an action, the user will perceive a failure even if the backend returns 200 OK.
- [ ] **AI Feedback Contribution**: Does the UI explicitly allow the user to evaluate AI accuracy (Good/NG) to help the model learn? (Pattern 30)
- [ ] **Persistent Learning State**: Once feedback is sent, is the button state locked/updated to show the data was contributed to the model?


## 3. Information Architecture & Content (15 Points)
- [ ] **Technical Reassurance**: Is there a "Mini Log Viewer" for users who want to see the underlying process?
- [ ] **Status Clarity**: Are status labels specific (e.g., "Demixing Audio", "Generating Subtitles") rather than just "Processing"?
- [ ] **Time Estimates**: Does the UI provide an "Estimated Time Remaining" based on previous similar jobs?
- [ ] **Relative Timestamps**: Are times shown as "2 mins ago" with the absolute time available on hover?
- [ ] **Log Filtering**: Can users filter logs into "Info", "Warning", and "Error"?
- [ ] **Deep Linking**: Does each job have a unique URL permalink for sharing/bookmarking?
- [ ] **Breadcrumbs**: In the Review/Studio view, is there a clear path back to the Dashboard?
- [ ] **File Metadata**: Are file sizes, resolutions, and durations shown explicitly in the review view?
- [ ] **Navigation Context Persistence**: When jumping from a dashboard to a specialized editor (e.g., Telop Designer), is the context (`jobId`, `shortIndex`) automatically passed via query parameters to prevent the user from having to re-select their project?
- [ ] **Relative Timeline Mapping**: When previewing a trimmed/extracted sub-clip (e.g., a "short" from a long clip), does the metadata overlay (telops, etc.) correctly map its absolute source timestamps back to the sub-clip's relative 0-index timeline?
- [ ] **Visual Alignment Overlay**: In a template-based editor, can the user overlay the original design reference (e.g., PSD preview) with adjustable opacity to ensure pixel-perfect alignment of edited elements?
- [ ] **Error Explainability**: When a job fails, does the UI explain *why* in plain language (e.g., "Unsupported Video Codec")?
- [ ] **Localized Technical Logs**: Are the mini-logs and status messages presented in the user's primary language (e.g., Japanese) to reduce cognitive load?
- [ ] **Step-to-Label Mapping**: Are technical backend enums (e.g., `INGEST`, `RENDERING`) mapped to user-friendly localized labels (e.g., "取込中", "書き出し中") in the UI?
- [ ] **Action Prioritization**: Is the "Primary Action" (e.g., Approve) significantly more prominent than the "Secondary Action" (e.g., Reject)?
- [ ] **Progress Persistence**: Does the progress bar value persist or recover gracefully if the browser is refreshed?
- [ ] **Batch Actions**: Can users approve or delete multiple jobs at once?
- [ ] **Search & Filter**: Can users search for a Job ID or filter by Status (Completed/Processing/Failed)?
- [ ] **Accessibility (Aria)**: Are all interactive elements labelled correctly for screen readers?
- [ ] **Friendly Design Language**: Does the UI feel "warm" and approachable (e.g., rounded corners, friendly copy, soft accent colors) rather than a sterile "Admin Dashboard"?
- [ ] **Friendly Localization**: Are state labels (Queue, Status) presented in plain, friendly language (with emojis) to reduce technical anxiety for non-experts?
- [ ] **Responsive Grid**: Does the layout collapse gracefully from 2 columns to 1 on smaller screens?

## 4. Performance & Reliability (10 Points)
- [ ] **Optimistic UI Updates**: Does the UI reflect an "Approve" action instantly before the server confirms?
- [ ] **Connection Status**: Is there a visible "System Online/Offline" indicator with an auto-reconnect countdown?
- [ ] **SSE Endpoint Precision**: Is the SSE/API endpoint explicitly set to `127.0.0.1` (IPv4) rather than `localhost` to avoid IPv6 (`::1`) resolution conflicts on macOS/Node.js?
- [ ] **Hybrid Initial Load**: Does the UI fetch the full state via REST (GET) on mount *before* or *alongside* establishing the SSE connection to ensure data is visible even if the socket handshakes slowly?
- [ ] **Asset Caching**: Are thumbnails and small assets cached locally to prevent flickering on reload?
- [ ] **Video Buffer Visibility**: Is the video player's buffer state visible to the user?
- [ ] **Granular Media Error Feedback**: Does the video player provide specific error messages for Network, Decode, or Unsupported formats rather than a generic "Failed to Load"?
- [ ] **Zero-Copy Feedback**: Does the UI acknowledge files manually moved into `input/` via the filesystem?
- [ ] **Ingest Path Guidance**: Is the local watch folder path visible with a "Copy" button to facilitate Zero-Copy ingestion for large files?
- [ ] **Latency Source Transparency**: If a 3-5s stability check is required (Watcher), does the UI explain *why* (e.g., "Ensuring file transfer completion...") to avoid the "broken" feeling?
- [ ] **Data Defensiveness**: Is the UI guarded against undefined properties (e.g., optional chaining `?.length`, fallbacks `|| []`) when API results are partial or slow to populate?
- [ ] **Encoding Resilience**: Are Job IDs or filenames with non-ASCII (Japanese, Emoji, etc.) characters handled safely via `encodeURIComponent` in all dynamic API request paths?
- [ ] **State Staleness Resilience**: Does the UI provide a way to "Refresh State" from the disk/backend, or does the backend automatically push state changes via SSE/WebSockets to prevent the user from acting on outdated (Stale) data?
- [ ] **Persistence & Restoration**: Does the backend scan the disk on startup to restore previous jobs/states (avoiding data loss on restart)?
- [ ] **Graceful Degradation**: If a high-res preview fails, does it fall back to a low-res draft or static frame?
- [ ] **Instant Look-and-Feel Preview**: Before committing to a final render (Approval), can the user see an instant snapshot of the design template (background/branding) applied to the video frame to avoid "re-render anxiety"?
- [ ] **Coordinate Integrity Audit**: Does the rendered output (telops, images) align perfectly with the template design? (Verify using `browser_subagent` and compare with template `preview.png` to detect coordinate drifts).
- [ ] **Unicode Normalization Integrity**: Does the system handle multibyte (Japanese/Emoji) paths correctly using NFC normalization to avoid cross-platform 404 errors?
- [ ] **Boilerplate Safety (Hardcoded ID Check)**: Do components have robust fallback/demo IDs (e.g., `demo-blueprint`) that are explicitly replaced by real data, avoiding "Silent Failures" where stale/hardcoded data is sent back to the server?
- [ ] **Memory Hygiene**: Are large video objects/URLs revoked correctly to prevent browser memory leaks?
- [ ] **Latency Mitigation**: Are API calls (like `/result`) debounced or pre-fetched when a card is hovered?
- [ ] **Build Info**: Is the current version/commit hash visible (subtly) for debug reporting?
- [ ] **First Paint Speed**: Is the critical dashboard path (Header + Active Queue) rendered server-side or via extreme thinning of the main bundle?
- [ ] **Design-Driven Config Inheritance**: Does the system automatically inherit high-fidelity defaults (fonts, positions) from a selected template to maintain professional quality while reducing active user clicks?
- [ ] **Robust Resource Fallback**: In asset-heavy pipelines, do preview APIs handle potentially missing intermediate files (e.g., `_draft.mp4`) by transparently falling back to source artifacts (`.mp4`) instead of presenting a 404 to the user?
- [ ] **Temporary Asset Isolation**: Are temporary preview assets uniquely keyed (e.g., hash or index+timestamp) to prevent cross-segment collisions and visual ghosting in multi-item lists?
- [ ] **UI Logic Consistency**: For repetitive list components (like video segments), does the rendering logic ensure identical UI availability (e.g., dropdowns, buttons) for all items in the same logical state?
- [ ] **Unified Snapshot Submission (Pattern 190)**: Are complex state updates (e.g., styles + content) sent as a single atomic snapshot to prevent partial persistence and data reset on re-fetch?
- [ ] **Contextual Style Indexing (Pattern 246)**: In multi-item renders, does the engine use specific IDs/indices to fetch styles (avoiding "First-Item Bias")?
- [ ] **Traceable Verification Markers (Pattern 247)**: Are unique marker strings used specifically for persistence testing to distinguish between successful saves and cache-hits?
- [ ] **System Font Audit**: Is there a backend verification that fonts used in the UI actually exist as physical files in the rendering environment (Pattern 239/260)?
- [ ] **Artifact Integrity Guard**: Does the download process verify the Content-Type to prevent saving error pages (HTML) as media files (Pattern 259/262)?
- [ ] **Calculated Layout Integrity (Pattern 309)**: Are fallback coordinates and font sizes calculated relative to the video dimensions (e.g., `Height * 0.8`) rather than using hardcoded absolute pixels (e.g., `1600`)? Hardcoded values create "Static Reference Traps" that break on resolution changes.

## 5. Artifact & Metadata Integrity (NEW - 2026-02-04)
- [ ] **Non-Zero Duration Check**: Do produced shorts have valid durations (>0s) in the dashboard metadata?
- [ ] **Score Propagation**: Are detailed scores (Quotability, Curiosity Gap) correctly mapped and visible, or are they all defaulted to 0?
- [ ] **Timestamp Accuracy**: Does the displayed start/end time match the actual content of the video?
- [ ] **Placeholder Recovery**: If an asset (thumb/preview) is missing, does the UI show a "Processing..." or "Refetching" state instead of a broken image icon?
- [ ] **Atomic-to-Blueprint Sync**: Is there internal validation that ensures analyzed segments' indices remain valid after blueprint restructuring?
- [ ] **Long-Action State Locking**: During slow external API calls (e.g., Archiving to Notion), is the button physically locked (`disabled`) and visually faded to prevent double-triggering or "Perceived Resignation" from the user?
- [ ] **Destructive Impact Confirmation**: For actions with permanent or local file side-effects (e.g., draft cleanup during archive), is `window.confirm` used with clear bullet points explaining the impact?
