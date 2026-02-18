# Fault-Tolerant AI Dashboard Implementation Patterns

In complex AI pipelines (video processing, analysis, long-running tasks), the frontend must handle a high degree of uncertainty. These patterns ensure the UI remains stable even when data is missing, processing is ongoing, or identifiers contain non-standard characters.

## 1. Defensive Data Access (Optional Chaining)

AI dashboards often deal with deeply nested JSON return from the backend (e.g., `ProjectResult -> Blueprint -> timeline`). During processing, some of these arrays or nested objects might be `null` or `undefined`.

### Pattern: The "Double Shield"
Always use optional chaining on dynamic list lengths AND the mapping function itself. Provide a local fallback value.

```tsx
// ❌ Dangerous: Crashes if bits of the object are missing
return <div>{project.shorts.length} Candidates</div>;

// ✅ Safe: Survives partial data states
return (
    <>
        <h3>Shorts Candidates ({project?.shorts?.length || 0})</h3>
        <div className="grid">
            {project?.shorts?.map((short, idx) => (
                <ShortCard key={short.video_id} data={short} />
            ))}
        </div>
    </>
);
```

## 2. Encoding Resilience (Multibyte Identifiers)

When Job IDs are derived from filenames (common in video pipelines), they frequently contain Japanese characters, emojis, or spaces. If these are used as URL path parameters, they must be explicitly encoded.

### Pattern: Path Parameter Protection
Always wrap dynamic path components in `encodeURIComponent`. Failure to do so results in `404 Not Found` errors or broken asset links on the backend, even if the file exists.

```tsx
// ❌ Dangerous: Fails on "表現者の時代になる"
const url = `http://127.0.0.1:8000/jobs/${job_id}/result`;

// ✅ Safe: Correctly handles all character sets
const encodedJobId = encodeURIComponent(job_id);
const url = `http://127.0.0.1:8000/jobs/${encodedJobId}/result`;
```

**Note**: This also applies to `video` tag `src` attributes.

```tsx
<video src={`/content/${encodeURIComponent(filename)}`} />
```

## 3. Strict API Response Validation

Standard `fetch` calls only reject on network failure, not on HTTP error codes (like 404 or 500).

### Pattern: The "Ok-Or-Throw" Chain
Check `res.ok` before attempting to parse JSON. This prevents the application from setting an "Error Object" (returned by the backend) into a "Data State" (expected by the UI), which usually leads to `TypeError` downstream.

```tsx
fetch(url)
    .then(res => {
        if (!res.ok) {
            // Log the text body for debugging
            return res.text().then(text => {
                throw new Error(`API Error: ${res.status} - ${text}`);
            });
        }
        return res.json();
    })
    .then(data => setProject(data))
    .catch(err => {
        console.error("Critical Fetch Error:", err);
        setLoading(false);
    });
```


## 4. Hybrid Initialization (REST + SSE)

In real-time dashboards where standard job lists are pushed via SSE (Server-Sent Events), relying solely on the socket connection creates a "Double-Offline" failure state. If the connection is slow to establish or fails, the user sees an "OFFLINE" indicator AND an empty project list, even if the backend is perfectly healthy.

### Pattern: Fast-Fetch then Sync
Fetch the complete state once via a standard REST GET request on component mount, then use SSE only for incremental or full-state updates.

```tsx
// 📂 apps/dashboard/src/hooks/useJobs.ts (Logical Implementation)
useEffect(() => {
    // 1. Initial REST Fetch (Instant feedback)
    fetch('/api/jobs')
        .then(res => res.json())
        .then(data => setJobs(data));

    // 2. Continuous SSE Sync (Real-time updates)
    const sse = new EventSource('/api/events');
    sse.onmessage = (e) => {
        const updatedJobs = JSON.parse(e.data);
        setJobs(updatedJobs);
    };
    
    return () => sse.close();
}, []);
```

**UX Benefit**: Users see current data immediately upon landing, regardless of SSE handshake latency.

## 5. Ingest/Output Path Synchronization

A common point of failure is a mismatch between where the **Worker** (Background processor) saves files and where the **API** (Frontend entry point) looks for them.

### Pattern: Config-Driven Pathing
Centralize all path logic in a single `settings` or `config` object shared between the API and the Workers.

- **Workers**: Save project metadata to a structured project directory (e.g., `backend/projects/[job_id]/[job_id]_project.json`).
- **API**: Mount the same structured directory (defined by `PROJECTS_DIR` in `backend/core/config.py`) as a static file server and point the `/result` endpoint to that exact same path logic.

Consistency check:
1. Does the Job ID in the database match the directory name?
2. Does the API endpoint encode the Job ID correctly before looking it up on the filesystem?

## 6. State Restoration (Continuity Pattern)

AI dashboards that handle long-running jobs must survive backend restarts (e.g., during code updates or system crashes) without losing the user's progress or the list of completed work.

### Pattern: The "Disk-to-Memory" Hydration
Instead of relying solely on an in-memory queue, the backend orchestrator should scan the persistent project storage on startup and repopulate the job registry.

```python
# 📂 Logical Backend Implementation (Python/FastAPI)
async def _restore_state(self):
    """Scan the projects directory to recover jobs from disk."""
    if not settings.PROJECTS_DIR.exists():
        return

    # Look for project metadata files
    for project_dir in settings.PROJECTS_DIR.iterdir():
        if not project_dir.is_dir():
            continue
            
        job_id = project_dir.name
        metadata_file = project_dir / f"{job_id}_project.json"
        
        if metadata_file.exists():
            try:
                # Reconstruct JobStatus and recover original timestamp
                with open(metadata_file, "r") as f:
                    data = json.load(f)
                    created_at_str = data.get("created_at")
                    # Handle ISO 8601 parsing
                    created_at = datetime.fromisoformat(created_at_str) if created_at_str else datetime.now()

                job = JobStatus(
                    job_id=job_id,
                    state=JobState.COMPLETED,
                    created_at=created_at,
                    message="Restored from disk"
                )
                self.jobs[job_id] = job
                logger.info(f"Recovered job: {job_id}")
            except Exception as e:
                logger.error(f"Failed to recover {job_id}: {e}")
```

**UX Benefit**: Users don't feel "punished" by technical restarts. Their historical work remains accessible in the Review list immediately upon reconnecting.

## 7. Narrative Editorial Filtering (AI as Director)

When using AI to extract highlights from long-form content, simple "topic detection" often results in fragmented, nonsensical clips.

### Pattern: The "Viral Director" Prompt
Upgrade the LLM's persona from a "summarizer" to a "director" with specific constraints on narrative structure and production quality.

- **Contextual Integrity**: Force the LLM to select segments that form a complete thought (Beginning -> Middle -> End).
- **Hook-First Sequencing**: Specifically demand the first segment be a high-energy "hook."
- **Resolution**: Prohibit "dangling endings"—the video must resolve the narrative or land a punchline.
- **Storytelling Critique**: Require the LLM to output a `critique` or `narrative_score` to force internal reasoning about the clip's coherence.

## 8. Midpoint Boundary Resolution (Overlap Mitigation)

In video pipelines that use "padding" or "margins" for segments, naive implementation causes adjacent clips to overlap, leading to audio stuttering or repeated visuals.

### Pattern: Staggered Midpoint Split
Instead of simply clamping or ignoring overlaps, resolve them by finding the mathematical midpoint between the collision points. This ensures every millisecond of the original content is preserved exactly once across the combined timeline.

```python
# 📂 Logical Backend Implementation (Python)
def resolve_overlaps(segments):
    for i in range(len(segments) - 1):
        curr, next_seg = segments[i], segments[i+1]
        
        if curr['end'] > next_seg['start']:
            # Calculate midpoint of the overlap region
            mid = (curr['end'] + next_seg['start']) / 2
            
            # Stagger boundaries to the midpoint
            curr['end'] = mid
            next_seg['start'] = mid
    return segments
```

## 9. Silent Artifact Management (Disk Scaling)

Media and AI pipelines generate massive amounts of intermediate files (stems, chunks, logs). If not managed, these "ghost artifacts" lead to disk exhaustion, which often presents as cryptic "I/O Errors" or system slowdowns.

### Pattern: Logical vs. Physical Reconciliation
Don't just rely on your database to know what exists. Periodically audit the filesystem against the application's logical state.

- **The Structured Workspace**: Move from a flat `output/` folder to a job-centric `projects/{id}/` hierarchy. This makes it trivial to delete all artifacts related to a single job.
- **Legacy Cleanup Protocol**: Specifically identify and document "Graveyard" directories (e.g., an old `output/` folder used during earlier versions) that should be purged during transitions.
- **The Size Audit**: Implement or document a manual `du -h -d 1` check as part of the standard troubleshooting workflow to reveal "invisible" bloat from caches (e.g., `__pycache__`, `.next`, or ffmpeg temps).
- **Auto-Deletion of Intermediaries**: Ensure the pipeline worker explicitly deletes temporary chunks and images *immediately* after the final `concat` step, rather than waiting for a global cleanup script.

**UX Benefit**: Prevents the "Invisible Wall" where a user's upload fails simply because the developer's SSD is full of ghost files from 100 failed test runs.

## 10. Hygiene-First Checkpoint Pattern (State Discipline)

In high-speed iterative development, logic changes often invalidate physical caches. A "Hygiene-First" mindset ensures that before a developer claims "it works" or performs a final checkpoint, the system is verified to work from a cold start with zero legacy state.

### Pattern: The Cold-Start Audit
- **Cleanup as a Prerequisite**: Before committing a major fix (e.g., overlap resolution), manually purge all intermediate directories (`temp/`, `output/`).
- **Input Re-Trigger**: Physically move or update the timestamp of source files (`touch`) to force the intake watcher to re-evaluate the media with fresh logic.
- **Confirmation of Truth**: Verify that the logical state (e.g., job list in the UI) matches the current physical state on disk. If a job is gone from disk but shows in UI (or vice-versa), the orchestrator's restoration logic needs a "Hygiene Fix."

**Developer Benefit**: Eliminates the "It works for me because I have the old cache" syndrome, ensuring reproducible results for the end-user.

## 11. The "Celebration Flow" Pattern
Creative tools should provide a sense of achievement when a hurdle (like an upload) is cleared. This reduces the friction of recursive tasks.

### Geometric Confetti Logic
Instead of a random burst, triggering the celebration from the *specific UI element* that completed the task creates a stronger visual link to the achievement.

```tsx
import confetti from 'canvas-confetti';

const triggerConfetti = (element: HTMLElement | null) => {
    if (!element) return;
    
    // Calculate normalized origin (0.0 - 1.0) based on viewport
    const rect = element.getBoundingClientRect();
    const x = (rect.left + rect.width / 2) / window.innerWidth;
    const y = (rect.top + rect.height / 2) / window.innerHeight;
    
    confetti({
        particleCount: 100,
        spread: 70,
        origin: { x, y },
        colors: ['#00ff00', '#00cc00', '#66ff66', '#00ff88'], // Match the success theme
        zIndex: 9999,
    });
};
```

**UX Benefit**: Provides instant dopamine feedback and psychological closure for a sub-task without adding UI clutter.

## 12. The "Declarative Tooltip" Pattern
Complex AI dashboards often use specialized terminology (e.g., "Ingest", "Blueprint", "Orchestration"). Contextual tooltips allow for discovery-based learning without cluttering the interface.

### Pattern: Wrap-and-Reveal
A lightweight, zero-dependency tooltip implementation focused on performance and positioning.

```tsx
export const Tooltip = ({ content, children, position = 'top' }) => {
    const [isVisible, setIsVisible] = useState(false);

    // Positioning classes (simplified)
    const pos = {
        top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
        bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
        // ... left/right
    };

    return (
        <div 
            className="relative inline-block"
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
        >
            {children}
            {isVisible && (
                <div className={`absolute z-50 ${pos[position]} animate-fadeIn`}>
                    <div className="bg-gray-800 text-white text-xs px-3 py-2 rounded-lg shadow-lg">
                        {content}
                    </div>
                </div>
            )}
        </div>
    );
};
```

**UX Benefit**: Reduces "technical anxiety" by providing on-demand explanations for complex features.

## 13. The "Parallel Pipeline" Pattern
For applications involving multiple heavy computations (e.g., AI analysis, media processing), sequential execution creates unnecessary idle time. Parallelizing independent steps significantly improves perceived performance.

### Pattern: Concurrent Task Gathering
Group independent I/O-bound or CPU-bound (if asynchronous) tasks to execute simultaneously.

```python
async def run_pipeline(data):
    # Group independent steps
    results = await asyncio.gather(
        analyze_content(data),
        generate_metadata(data),
        extract_features(data),
        return_exceptions=True # Resilience: don't let one fail the whole pipeline
    )
    
    # Process results with fallback for failed steps
    content, meta, features = results
    if isinstance(content, Exception):
        content = fallback_value
        
    return finalize(content, meta, features)
```

**UX Benefit**: Directly reduces completion time for multi-stage workflows, leading to a "snappier" and more responsive system.

## 14. The "Guided Empty State" Pattern
A "blank canvas" can be intimidating. High-fidelity tools should provide immediate, actionable guidance in empty views.

### Pattern: Canvas Onboarding Overlay
Instead of a simple "No data" message, use a centered overlay with:
1. **Encouraging Headline**: e.g., "Start Creating! ✨"
2. **Instructional Text**: Briefly explain what to do first.
3. **Quick-Action Buttons**: Direct shortcuts to the 2-3 most common start actions (e.g., "Add Text", "Upload Media").

```tsx
const EmptyStateOverlay = ({ onAddText, onAddMedia }) => (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/5 backdrop-blur-sm">
        <div className="bg-white/90 p-8 rounded-2xl shadow-2xl text-center border border-indigo-100 animate-in fade-in zoom-in duration-300">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Start Creating! ✨</h2>
            <p className="text-gray-600 mb-6">Add text, images, or videos to get started.</p>
            <div className="flex gap-4 justify-center">
                <button onClick={onAddText} className="...">Add Text</button>
                <button onClick={onAddMedia} className="...">Add Media</button>
            </div>
        </div>
    </div>
);
```

**UX Benefit**: Removes "where do I start?" friction and bridges the gap between the Dashboard and the Studio.

## 15. The "Path Guidance" Pattern (Zero-Copy)
For tools handling large files (like 4K video), browser uploads are often suboptimal. Guiding users to the *backend filesystem path* enables professional "Zero-Copy" workflows.

### Pattern: Copy-to-Ingest Tooltip
Provide the specific local file path where the system's "Watch Folder" resides, along with a "Copy Path" button.

- **Pro Tip**: Use a localized "PRO TIP" label to signal advanced but helpful functionality.
- **Copy Feedback**: Change the button text (or show an emoji like ✅) temporarily after the path is copied.

**UX Benefit**: Empowers power users to bypass browser bottlenecks, reinforcing the tool's "professional" capability.

## 16. The "Defensive File Finding" Pattern
In multi-stage pipelines where files are moved, renamed, or converted, hardcoded paths lead to fragile systems. A defensive search pattern ensures the system can recover even if the exact file location shifts.

### Pattern: Prioritized Candidate Search
Instead of `assert path.exists()`, use an array of potential candidates (ordered by probability/freshness) and iterate with a multi-extension fallback.

```python
def resolve_source(job_id, original_name):
    candidates = [
        # Search the project-specific "safe" storage first
        PROJECT_DIR / job_id / "source" / f"{job_id}.mp4",
        # Fallback to the ingest/input folder
        INPUT_DIR / f"{original_name}.mp4",
    ]
    
    for path in candidates:
        # Check primary path
        if path.exists(): return path
        
        # Check common video extensions
        for ext in ['.mov', '.mxf', '.mts']:
            alt = path.with_suffix(ext)
            if alt.exists(): return alt
            
    raise FileNotFoundError(f"Source not found for {job_id}")
```

**UX Benefit**: Prevents "Processing Failed" errors caused by internal file housekeeping, making the system feel "smart" and resilient to its own internal state changes.

## 17. The "Artifact Integrity" Pattern
In persistent dashboards, simply having a database entry isn't "completion." The presence of valid, playable artifacts defines the final state.

### Pattern: Post-Render Validation
Before marking a job as `COMPLETED`:
1. **Verify File Existence**: Confirm the output file exists at the expected path.
2. **Verify File Size**: Ensure the file is not 0 bytes (a common sign of a crashed renderer).
3. **Lazy Integrity Check**: On dashboard load, if an artifact is missing but the state says "Completed," downgrade the state to "Error" or "Requires Re-render."
4. **Defensive Cleanup**: When resetting or retrying a job, ensure that the deletion of old artifacts is wrapped in error handling. A "File Not Found" error during a cleanup phase should never crash the retry request itself.

**UX Benefit**: Prevents the frustration of clicking a "Completed" project only to find a broken video player, and ensures that "Retry" buttons always work even if the internal state is inconsistently partially deleted.

## 18. The "Robust Identifier Handling" Pattern
When systems allow User-defined filenames as internal IDs (common in pro-sumer tools), characters from different locales (Japanese, Emojis, etc.) introduce silent failures due to encoding mismatches or Unicode normalization differences.

### Pattern: Canonical ID Sanitization
Ensure IDs are globally consistent and URI-safe before they enter the processing pipeline.

1. **Normalize Unicode**: Always convert string IDs to a canonical form (NFC) using `unicodedata.normalize('NFC', id)` (Python) or `string.normalize('NFC')` (JS). This prevents "File Not Found" errors on macOS vs. Linux environments.
2. **Path Encoding**: Sanitize IDs for URL contexts. Never concatenate raw non-ASCII strings into URLs; use `encodeURIComponent` (JS) or `quote` (Python).
3. **Internal vs. Display ID**: If robustness is critical, generate an internal UUID for the pipeline and map the user's high-fidelity filename as a "Display Title" only.

**UX Benefit**: Ensures that a user's creative filenames (e.g., "違和感はどこにある？") don't break the ability to review, retry, or export their work due to technical "invisible characters" or encoding bugs.
## 19. The "Graceful Functional Degradation" Pattern
In AI-heavy tools, some features rely on fragile environments (specific CUDA versions, missing Python libs like `soundfile`). A high-fidelity tool ensures that the failure of a "bonus" feature (like high-quality audio separation) doesn't brick the core feature (like video cutting and transcription).

### Pattern: Best-Effort Delivery
If a non-critical enrichment step fails, log it as a warning and fall back to the raw source data.

1. **Isolation**: Run heavy AI tasks in isolated subprocesses or wrappers that catch all environment-related errors.
2. **Raw Data Fallback**: If an "Enhanced" artifact cannot be generated, serve the "Original" artifact as the substitute.
3. **Status Transparency**: Communicate through the log or status indicator that "Enhanced processing skipped," while still allowing the user to proceed with the base result.

**UX Benefit**: Prevents a "hard crash" for the user. They would rather have a draft video with original audio than no video at all because a background library was missing.

## 20. The "Interleaved Stream Construction" Pattern
Technical pipelines that generate complex command-line arguments or scripts (e.g., FFmpeg Filter Graphs, SQL multi-joins, or Mesh shaders) often fail due to strict ordering requirements that are invisible during simple string concatenation.

### Pattern: Typed Interleaving
Instead of grouping elements by type (e.g., all inputs, then all filters), build your script objects in the order the processor's state-machine expects.

1. **Ordering Constraints**: In media processing, filters like `concat` require streams to be interleaved (`[V0][A0][V1][A1]...`).
2. **Deterministic Sequence Builder**: Use a loop that specifically creates a tuple or array of required inputs for each unit of work, ensuring metadata and data streams are always paired.
3. **Explicit Labeling**: Use uniquely identifiable labels (e.g., `[v{n}_final]`) rather than implicit ordering to make errors easier to debug when the sequence is violated.

**UX Benefit**: Eliminates cryptic low-level errors (like "Media type mismatch") that are unintelligible to users and difficult for telemetry to pinpoint. This ensures smooth multi-segment rendering for high-fidelity editors.

## 21. The "Technical Reassurance Retry" Pattern
In long-running pipelines, deterministic failures (like syntax errors) and transient failures (like API timeouts) both stop the work. A "Retry" button that does more than just "re-running the same code" provides technical reassurance.

### Pattern: Fresh Start Override
The retry logic should have the option to "Clear Previous State" to avoid being stuck in a corrupted cache loop.

1. **Purge Intermediaries**: The backend endpoint should attempt to delete partial results (e.g., a half-finished `project.json` or small temp files).
2. **Re-submit to Ingest**: Instead of just retrying the failed step, re-submit the source file to the start of the pipeline (Orchestrator) to ensure all side-effects (transcription, demuxing) are verified.
3. **UI Feedback**: Change the "Error" status to a "Retrying" status (transitioning back to "Processing") to show the system hasn't given up.

**UX Benefit**: Gives the user a "Magic Fix" button when something goes wrong, reducing the need for manual support or "deleting the project and starting over."
## 22. Digital Asset Accessibility Diagnostics (The 0:00 Problem)
In web dashboards for media pipelines, a successful finishing signal followed by a broken playback experience creates deep user frustration.

### Pattern: Path Over Status Verification
If the backend signals "Success" but the player shows a **0:00 duration** or a persistent loading spinner, the system should treat this as a "High-Priority Path Mismatch" rather than a "Processing Error."

1. **HTTP 404 vs 500**: Distinguish between "The file doesn't exist at this path" (404) and "The file exists but is corrupt/invalid" (Format error).
2. **Path Sanitization Check**: If the asset name contains multibyte characters (NFC/NFD mismatch) or complex encoding, the UI should offer an "Access Log" or "Diagnostic Path" to verify the exact string being requested.
3. **UI Signal**: Instead of just showing a broken player, detect the 404 error via the `onError` handler of the video tag and show a specific message: "Asset found in storage but inaccessible via URL. Check path configuration."

**UX Benefit**: Accelerates debugging by pinning the error to "Delivery/Pathing" rather than "Generation/Rendering," saving technical users hours of repetitive re-processing.

## 23. High-Fidelity Preview (Single-Frame Template Check)

In complex editing pipelines where final rendering (9:16 crop + multiple layers) takes significant time (minutes), users need a way to verify the "Look and Feel" instantly before committing resources.

### Pattern: Instant Snapshot Simulation
Instead of a low-res proxy or a full render, generate a single-frame "Composite Snapshot" using the same rendering engine (FFmpeg) with optimized parameters.

1. **Deterministic Frame Extraction**: Use `-vframes 1` and `-ss` to extract a single representative frame from the draft video.
2. **Dynamic Layer Simulation**: Use the FFmpeg `movie` filter to load template assets (Background, Overlay) directly into the filter graph on-the-fly, avoiding the need for multiple inputs or complex process management.
3. **Aspect-Aware Padding Logic**: Apply the exact same `scale` and `pad` filters used in the final render to ensure the "Preview" is 100% faithful to the final output's positioning.
4. **Temporary Asset Serving**: 
    - Mount a dedicated `temp/` directory (e.g., `app.mount("/temp", ...)`).
    - Return a direct URL to the preview image in the API response.
    - Generate unique filenames (UUID) to avoid browser caching of the "latest" preview.
5. **Aspect Ratio Integrity Handling**:
    - If the placeholder (e.g., 1080x960) has a different aspect ratio than the source (e.g., 16:9), the rendering logic must explicitly decide between "Crop to Fill" or "Pad to Fit".
    - **Pattern**: Standardize on `force_original_aspect_ratio=decrease` plus `pad` with a specific color (black) to ensure the 16:9 source is always visible and un-deformed, even if it creates intentional black bars within the designer's designated placeholder area.

**UX Benefit**: Provides a 1:1 visual guarantee in sub-second time. This "instant verification" loop eliminates the anxiety of waiting for a long render only to find a logo misaligned or a background missing.
## 24. Direct Artifact Export (Download-as-Verification)

In complex editing or AI pipelines where the frontend dashboard might misrepresent the actual state (e.g., due to SSE lag, path mismatches, or UI-only styling), providing a direct download link for the "Source of Truth" file is critical for auditing.

### Pattern: The "Verify Source" Button
- **Placement**: Add a prominent "📥 Download" button next to the "Approve/Reject" controls.
- **URL Purity**: The link should lead directly to the filesystem-backed artifact URL (e.g., `.../projects/[id]/shorts/final.mp4`) rather than a proxy that might transform the data.
- **Workflow**: Encourage users to download and check the file in professional players (VLC, QuickTime) if the dashboard preview seems suspicious.

## 25. The "Vision-First" Audit Cycle

Relying on "the code looks correct" or "unit tests pass" is insufficient for media quality. Final verification must be visual and evidence-based.

### Pattern: Ground Truth Capture
- **Subagent Screen Audit**: Use `browser_subagent` to navigate to the *direct file URL* and take screenshots at specific timestamps (e.g., 5s, 10s).
- **Comparative Analysis**: Compare the screenshot against the source aspect ratio (e.g., Is 16:9 preserved?) and the template design (e.g., Are subtitles styled as intended?).
- **Feedback Loop**: If the visual evidence (screenshot) contradicts the internal status ("Completed"), reset the state and investigate the rendering parameters (FFmpeg filters) immediately without assuming the dashboard state is correct.

## 26. Transformation Conflict Resolution (Atomic vs. Compositional Filters)

In complex processing pipelines, transformations applied to individual components (Atomic) can inadvertently corrupt the state required by global layout engines (Compositional).

### Pattern: Pass-Through Preservation
- **Identify the Anchor**: Determine which layer is responsible for the "Final Aspect Ratio" or "Final Coordinate Space."
- **Disable Local Shortcuts**: If a global layout engine (like a template manager) is active, disable local segment-level transformations (such as auto-cropping to 9:16) that assume a specific output target.
- **Unified Logic**: Move all transformation logic (scaling, padding, cropping) to the final composition pass where the full context (placeholder size, background dimensions) is available.

**Real-world failure case**: A video segment was auto-cropped to 9:16 to "save bandwidth," but then fed into a template that expected a 16:9 source to center within a wide placeholder. The resulting "stretch" distorted the content because the aspect-ratio metadata was lost at the atomic level.

## 27. Heuristic System-Font Resolution

Application configurations often use logical font names (e.g., "Hiragino Sans") while the underlying OS requires absolute paths (e.g., `/System/Library/Fonts/Hiragino Sans GB.ttc`). Hardcoding these paths makes deployment fragile.

### Pattern: The Gradient Search
- **Define Candidates**: Create a list of standard system directories and common file extensions (`.ttf`, `.ttc`, `.otf`).
- **Family-to-Path Mapping**: Implement a helper that attempts to concatenate the requested family name with known directory paths.
- **Graceful Fallback**: If the heuristic fails, fall back to a guaranteed system default (e.g., `Arial.ttf`) rather than crashing the render job.

## 28. Baked-in Branding (Intermediate Overlay PNGs)

FFmpeg's internal text rendering (`drawtext`) is powerful but difficult to use for complex brand-aligned styling (multiple strokes, specific kerning, area-based centering).

### Pattern: Pre-pass Overlay Generation
- **Separation of Concerns**: Use a specialized graphics library (like Python's Pillow) to generate transparent PNGs for text elements.
- **Coordinate Mapping**: Passing a `bounding_box` from the layout engine to the image generator ensures that text is centered or aligned relative to a logical area rather than the whole screen.
- **Atomic Burning**: Instead of complex filter chains with 100 inputs, load these intermediate PNGs using the `movie` filter inside the segment filter-complex. This significantly reduces the complexity of the global `filter_complex_script`.

## 29. Transparency Masking (Dynamic vs. Static Text Conflict)

In multi-layer templates, visual assets (PNGs) for backgrounds or branding overlays often include "sample text" or "placeholder labels" from the original design (e.g., PSD). If these are not removed before export, they will overlap with the real dynamic text injected by the engine.

### Pattern: The "Text-Clear" Zone Audit
- **Asset Integrity**: Ensure that all template assets have 100% transparency in the designated "Caption Area."
- **Layer Sorting**: If text must appear behind a specific element (like a glass-morphism panel), ensure the panel is semi-transparent and the text is not burned into the panel image itself.
- **Diagnostic Signal**: If the rendered video shows the correct branding (fonts, colors) but the *content* is static or wrong, inspect the `OVERLAY` or `BACKGROUND` source assets for "ghost text" burned into the image.
## 30. The "Active Feedback Loop" (Learning Loop)

AI-generated content (highlights, titles, themes) is inherently probabilistic. To move from "hit-or-miss" to "reliable," the UI must actively solicit human judgment to build a high-quality dataset for future refinement.

### Pattern: Rapid Binary Feedback (Thumbs Up/Down)
Integrate simple, low-friction rating buttons directly into the review workflow.

- **Non-Intrusive Placement**: Place buttons near the "Approve/Render" actions. They should feel like a natural part of the "Review" step.
- **Visual Persistence**: Once a vote is cast, show a "Sent/Stored" state (e.g., green/red solid color) and disable the buttons to prevent double-voting.
- **Optimistic UI & Loading States**: Use local state (`feedbackLoading`) to disable buttons during the API call and `shortFeedback` to reflect the selection immediately or upon success. This prevents "click-spamming" and provides immediate visual reassurance.
- **Contextual Snapshotting**: On the backend, don't just store "Good/Bad." Store the complete prompt variables (the specific segments, the AI's internal scoring, the theme) that led to that generation.
- **Score Visibility**: Show the AI's internal confidence/quality score (e.g., "Quality: 85") to the user. This creates a "Calibrated Expectation" where the user can see if their subjective judgment aligns with the AI's math, helping the developer tune the thresholds.

**UX Benefit**: Transforms the user from a passive victim of AI mistakes into an active contributor to the system's intelligence. It provides the developer with "Ground Truth" data required for performance auditing and fine-tuning.

## 31. The "Action-Event Completeness Audit"
In complex review modals, UI density can lead to "Silent Buttons"—elements that look interactive but lack an associated logical trigger (e.g., `Reject` button that does nothing).

### Pattern: The 3-Point UI Verification
Before committing a UI feature, audit every unique action button for:
1. **Visual State**: Hover, Active, and Disabled styles.
2. **Event Mapping**: Is the `onClick` handler explicitly linked to a service/API call?
3. **Optimistic Feedback**: Does the UI provide an instant "Action processing" message or loading spinner to reassure the user that the system is responding?

**Observation (Videdit Case)**: The `Reject` button was present in the DOM but had no handler. A recurring audit of the event-to-service mapping prevents these "dead points" from reaching the user.

## 32. The "Unified Central Vision" (Preview Proximity)
When a secondary action (like choosing a template) triggers a visual result (design-mix preview), placing that result in a lateral or distant area causes user confusion. Users instinctively look at the "Main Player" and assume the action failed if that player doesn't update.

### Pattern: Proximity-Based Preview
- **The "Player Sync" Rule**: If a choice (template) changes the *nature* of the media, the main preview area should either update or explicitly visually link to the new preview.
- **Visual Connection**: Use arrows, clear labels (e.g., "🎨 DESIGN MIX PREVIEW"), or a "Switch to Template View" toggle in the main player to bridge the mental gap.
- **Contextual Status**: If the main 16:9 player remains as the "source check" and a 9:16 vertical preview appears elsewhere, ensure the triggering dropdown displays a "Preview generated below" tooltip to guide the user's attention.

**UX Benefit**: Eliminates the "It's not working" frustration by ensuring that every user-driven state change is reflected exactly where the user is looking.

## 33. The "Verification Readiness" Protocol
In automated or agent-led UI audits, the most frequent failure point is the environment, not the feature logic. A "Silent Failure" occurs when the auditor (browser sub-agent) cannot reach the feature due to infrastructure gaps.

### Pattern: The Pre-Audit Checklist
Before initiating an automated browser audit, the system or developer must ensure:
1. **Endpoint Reachability**: Verify the backend list/ping endpoint is responsive from the dashboard terminal/host.
2. **Mock Data Seeding**: If the database/cache was cleared (e.g., SSD cleanup), re-ingest a small test artifact to provide "Interactable Elements" for the auditor.
3. **Internal vs. Localhost**: Ensure the tool's browser context uses the same hostname scheme as the API (e.g., both use `127.0.0.1` vs `localhost`). Some agents or browsers default to IPv6 (`::1`) when using `localhost`, while the dev server might only be listening on IPv4 (`127.0.0.1`), leading to intermittent "OFFLINE" false positives.

**Observation (Videdit Case)**: A complete fix for the `Reject` button could not be verified initially because the browser sub-agent reported "OFFLINE" at `http://localhost:3000`. Switching specifically to `http://127.0.0.1:3000` bypassed this DNS ambiguity and allowed the verification to proceed. This underscores the necessity of the "Verification Readiness" step.

## 34. The "Cold Boot Diagnostics" (Recovery Logic)
In modern web frameworks (like Next.js with Turbopack), local caches can become corrupted after unexpected shutdowns or I/O interruptions, especially on external SSDs. This results in "Silent Startup Failures" where the dev server process is visible but the application is unreachable.

### Pattern: Recursive Cache Purging
When the dev server fails with "Internal Error" or "invalid digit found in string":
1. **Aggressive Cleanup**: Don't just restart; recursively delete the `.next`, `.turbo`, and `/tmp/next-*` directories.
2. **Unified Restart Command**: provide a project-level `clean-dev` command that combines `port-cleanup` and `cache-purging`.
3. **Status Reassurance**: If the UI is reachable but the backend is not, the dashboard should show a "Server Recovering" or "System Booting" state rather than a generic "OFFLINE" message if possible.

**Developer Benefit**: Saves time by codifying the "Delete .next and restart" ritual into a single action, preventing frustration during iterative cycles.

## 35. Visual De-emphasis (The Gray-Out State)
When an item in a list is "rejected," "archived," or "deleted" but still visible for historical context, the UI must immediately reflect this state to prevent accidental double-interaction and to provide psychological closure.

### Pattern: Contrast-Based Exclusion
- **Opacity Reduction**: Lower the opacity of the entire card or its primary media component (e.g., to 0.4 or 0.6).
- **Grayscale Filter**: Apply a `grayscale(1)` CSS filter to the video/image preview.
- **Badge Locking**: Change the status badge to a muted color (e.g., zinc/gray) and clearly label it (e.g., "REJECTED").
- **Explicit Status Overlay**: Inject a centered text banner (e.g., "🚫 REJECTED" or "ARCHIVED") over the media component. This serves as a definitive visual "seal" on the item's state.
- **Action Disabling**: Visually hide or disable the primary "Approve" buttons to signal that the item is no longer an active candidate.

**UX Benefit**: Users can scan a list and instantly differentiate between "work to be done" and "completed/discarded work," reducing cognitive load in large-scale review sessions.

## 30. Recursive Learning Loop (Pattern 140)
A system that treats manual user corrections as "Ground Truth" to improve its algorithmic intelligence over time.

### 1. Atomic Edit Logging
Instead of just saving the final state, capture the **Delta**.
- **Edit Types & Detection Heuristics**:
    - `SPLIT`: New text length is noticeably shorter (<80%) than before, implying a segment was divided.
    - `MERGE`: New text length is noticeably longer (>120%) than before, implying segments were combined.
    - `TEXT_EDIT`: Significant content change but within ±20% of original length.
    - `TIMING_SHIFT`: Start or end time adjusted by more than a perceptual threshold (e.g., >0.1s).

### 2. Heuristic Pattern Detection
Analyze accumulated logs for statistical significance.
- **Anchor Detection**: Identify characters or words that consistently trigger a manual split.
- **Parametric Drift**: Track if the user's preferred limit (e.g., 10 chars) consistently deviates from the system default (e.g., 18 chars).

### 3. Human-in-the-Loop Governance
To prevent a "Feedback Loop Collapse" (where bad user habits or one-off edits degrade the global model), use an **Observation -> Suggestion -> Approval** flow.
- Suggestions are stored as `PENDING` rules.
- Developers or power users review and `APPROVE` or `REJECT` the learned rules before they are baked into the core engine.

**Outcome**: The UI becomes a partner that "learns your style," converting the user's manual correction effort into long-term product value.


## 36. Design-Driven Config Inheritance (The "Skeptic's Choice")

When a user selects a "Template" or "Design Style" in a high-fidelity editor, the tool must decide how much control to give the user over sub-elements (like text style, colors, and positions).

### Pattern: The Automatic Inheritance Protocol
Instead of exposing every parameter (which increases cognitive load and development cost), the system automatically inherits the **Optimized Default** from the design template.

- **The Logic**: 
  1. User selects `Template_A`.
  2. System fetches `Template_A.caption_config` (font, size, y-coordinate).
  3. These values are automatically injected into the `Job.telop_config` on the backend.
  4. The user only edits the **Content** (text string), while the **Form** (visual style) remains perfectly aligned with the designer's intent.
- **Debate Conclusion (Videdit Case /debate deep)**: A specialized "Drag-and-Drop Editor" for every telop was considered but rejected in favor of this inheritance pattern. 
- **UX Benefit**: Ensures a professional "Walled Garden" experience where the user cannot accidentally break the design aesthetics, while maintaining a very low time-to-completion (TTC).

### Pattern: The Fallback Discovery (Robust Mapping)
When dealing with multiple asset versions (e.g., `_draft.mp4` vs `.mp4`), the backend should never fail on a "Single Guess."

- **Implementation**: Wrap the file resolution in a prioritized list check. If the preferred performance-optimized artifact (`_draft`) is missing, transparently fall back to the heavy original (`.mp4`) rather than returning a 404.
- **Principle**: The user's creative flow should never be interrupted by internal file-naming conventions.


## 37. Semantic Error Detail Propagation

In automated pipelines, a "Failure" (HTTP 500/404) often has a technical cause (e.g., a specific file missing or a resource busy) that the user could potentially resolve or understand.

### Pattern: The "Why" over "What"
Instead of a generic "Failed to generate preview," capture the backend's specific `detail` and surface it in the UI.

- **The Implementation**:
  1. Backend raises an `HTTPException` with a human-readable `detail` string (e.g., `"Video not found: neither _draft nor final exists"`).
  2. Frontend catches the non-OK response and attempts to parse the JSON body.
  3. The specific error message is assigned to a state variable (e.g., `previewErrors[index]`).
  4. The UI displays the message in a small, non-intrusive alert area near the action button.
- **UX Benefit**: Eliminates the "Black Box" feeling. Even if an error occurs, the user feels in control because they have the information needed to troubleshoot (e.g., "Ah, I haven't generated the final video yet") or report the issue efficiently.
- **Principle**: Trust is built on transparency during failure.


## 38. Anti-Silent Success Trap (The "Visible Disruption" Pattern)

When an action is performed on an object (e.g., Reject, Archive, Mark as Spam), the backend operation is often instant, but the object remains in the user's view.

### Pattern: The Disruption of State
If a backend success does not result in a **primary visual disruption** of the item, the user will instinctively assume the button is "broken" or "lagging."

- **The Problem**: Clicking "Reject" marks the database entry as rejected, but if the card UI stays the same, the user clicks it 10 more times in frustration.
- **The Protocol**: Every state-changing action must trigger at least three of the following:
  1. **Grayscale/Desaturation**: Instantly remove color to signal "death" of the object.
  2. **Opacity (60-70%)**: Make the object "recede" from the focus layer.
  3. **Banner Injection**: Overlay a clear status banner (e.g., "🚫 REJECTED").
  4. **Border Change**: Switch from a standard neutral border to a state-specific one (e.g., Dark Red).
- **Psychological Closure**: These disruptions provide immediate confirmation that the user's intent was received and executed, satisfying the "Psychological Closure" requirement of high-fidelity UX.
- **Principle**: Trust is built on transparency during failure.


## 39. Cold Boot Stability (Manual Cache Reset)

Modern development frameworks (like Next.js with Turbopack) maintain highly optimized incremental caches. However, internal database/cache corruption can lead to cryptic failures during the boot process.

- **The Problem**: A dashboard that was working perfectly suddenly fails to start with errors such as `invalid digit found in string` or `Failed to open database` originating from the `.next` directory.
- **The Diagnostic**: If the failure persists across restarts and the stack trace points to internal framework orchestration (e.g., Turbopack persistence), the environment state is likely compromised.
- **The Resolution**: Implement a "Nuclear Reset" protocol.
    1. Stop all dev processes.
    2. Recursively delete the cache directory (e.g., `rm -rf .next`).
    3. Perform a fresh cold boot (`pnpm dev`).
- **UX Implication**: For production-gate tools, having an automated "Clear Environment Cache" utility can save critical minutes for the end-user.


## 40. Temporary Asset Collision Isolation

In high-concurrency or multi-segment pipelines, a single global filename for temporary results (e.g., `{job_id}_template_preview.png`) leads to race conditions and visual ghosting where components display the wrong preview.

- **The Problem**: If two shorts in the same job are previewed simultaneously, they both attempt to write to the same temporary file, causing one to overwrite the other or leading to a "Black Frame" if the file is locked during I/O.
- **The Protocol**: Use **Hierarchical Namespacing** for all ephemeral assets.
  - **Filename Structure**: `{JobID}_{ShortIndex}_{Feature}_{Timestamp/Random}.png`
  - **Namespace isolation**: Store previews in a subdirectory specifically for that job + segment (e.g., `temp/job_123/short_4/preview.png`).
- **UX Benefit**: Ensures 100% visual isolation. The user never sees a "flicker" or "stale frame" from another part of the editor, maintaining the illusion of high-fidelity real-time feedback.
- **Cleanup Requirement**: Paired with Pattern 9 (Silent Artifact Management), ensure these segment-specific temp folders are purged upon job completion or UI unmount.

## 41. Detached Background Stability (Nohup/LSOF Protocol)

AI エージェントやバックエンドサーバーを長時間バックグラウンドで稼働させる際、物理的な TTY の切断や標準出力のバッファリングが原因で、プロセスが `suspended (tty output)` (SIGTTOU) 状態で停止し、ダッシュボードがオフラインになる「サイレント・ストップ」が発生します。

### Pattern: The Immortal Background Service
1.  **TTY Detachment**: `nohup ... > /tmp/log 2>&1 &` を使用し、stdout/stderr を物理ファイルにリダイレクトして制御端末から完全に切り離します。
2.  **Input Redirection**: 物理端末が閉じられた際のハングアップを防ぐため、`</dev/null` を追加して標準入力を切り離します。
3.  **Job Disowning**: シェル終了時の SIGHUP 送信を確実に防ぐため、コマンド末尾に `& disown` を付加します。
4.  **Mandatory Port Recovery**: 再起動前に `lsof -ti:{port} | xargs kill -9` を自動実行する「クリーンな再起動」を標準化します。これにより「Address already in use」エラーによる起動失敗を 100% 回避します。

**UX Benefit**: 外部ストレージや不安定なネットワーク環境下でも、バックグラウンドの重い処理（FFmpeg 等）が中断されず、常にユーザーの要求に応答可能な「自己修復・強靭なバックエンド」を維持できます。

## 42. The "Toggle-Edit" Pattern (Granular vs. Global Content Refinement)

AI が生成したコンテンツ（文字起こし、要約、テロップ分割など）を人間が修正する際、「全体的な文脈の調整」と「各項目（行）の微調整」の両方のニーズが存在します。これらを単一のインターフェースで矛盾なく提供するパターンです。

### 1. Global Edit Mode (Raw Text)
- **Use Case**: 誤字脱字の一括修正や、文の区切りの根本的な変更。
- **Implementation**: データを `textarea` 等で「プレーンテキスト」として表示。ユーザーが編集を確定（Apply）した際に、バックエンドの分割エンジン（Splitter）を再度呼び出し、構造化データを再生成する。

### 2. Granular Edit Mode (Line/Atom Level)
- **Use Case**: タイミングや個別の読みやすさに合わせた微調整。
- **Implementation**: 分割された各「行（Atom）」を個別に `input` フィールドとして表示。

**UX Benefit**: ユーザーは「まず全体を直し、次に細部を詰める」という自然な編集フローを context-switch なしで実行できます。

## 43. Workspace-Dependency Integrity (Monorepo Resilience)

モノレポ環境で共有 UI コンポーネントパッケージ（例: `@videdit/telop-components`）を使用する場合、開発環境の移行や SSD のマウント状態によって、プロジェクト間の「型定義」や「ビルド成果物」のリンクが切れることがあります。

- **The Problem**: ダッシュボードのソースコードは正しいのに、TypeScript が `Module not found` エラーを出し、Hot Module Replacement (HMR) が停止する。
- **The Protocol**: 
  1. **Explicit Workspace Reference**: 消費側の `package.json` で `"workspace:^"` を明示的に指定。
  2. **Atomic Dependency Resolution**: SSD 移行後、またはパッケージ構成 of 変更後は、必ずルートで `pnpm install` を実行し、`node_modules` 内のシンボリックリンクを再構築する。
  3. **Type-Inference Guard**: `Blueprint` 等の共有型定義に破壊的変更（例: `transcript` フィールドの削除）があった場合、消費側の UI での呼び出し箇所を迅速に特定し、マッピングロジック（例: `timeline` から文字を再結合）を修正する。

**UX Benefit**: 開発環境の不安定さに起因する「UI のフリーズ」や「ビルドエラー」を最小限に抑え、プロフェッショナルなツールとしての開発速度とプロダクトの安定性を両立します。
## 44. Context-Aware Coordinate Normalization (Overlay-Canvas Alignment)

デザイナー上で、フルキャンバスサイズ（例: 1080x1920）のガイド画像をオーバーレイとして使用する場合、PSD 解析で得られた「レイヤー自体のオフセット」を無視し、プログラム的に `(0, 0)` に正規化して配置する必要があります。

### Pattern: The (0,0) Anchor for Full-Scale Assets
- **The Problem**: PSD 内の `OVERLAY` レイヤーがキャンバス全体を覆うデザインであっても、解析結果には `x: 159` のようなデザイン上のマージンが含まれることがある。これをそのまま `left: 159px` で描画すると、ガイド画像が二重にズレて表示される。
- **Resolution**: アセットがキャンバスサイズ（`canvasWidth`, `canvasHeight`）と一致する場合、または `OVERLAY` / `BACKGROUND` 型である場合、配置座標を強制的に `(0, 0)` にリセットする。これにより、背景動画と装飾用ガイド画像をピクセル単位で正確に重ね合わせることが可能になる。

## 45. Template-State Coordinate Snapping (Persistence Guard)

テンプレートを選択してデザイナーの内部状態（Edit State）を更新する際、デフォルト値（例: キャンバス中央座標）がテンプレート定義の座標（`x`, `y`）を上書きして消し去ってしまう「サイレント・オーバーライド」を防ぐ必要があります。

### Pattern: Defined-Value-First Merge
ストアの更新ロジックにおいて、引数として渡されたプロパティを「常に上書き」するのではなく、「値が存在する場合のみ優先」し、存在しない場合のみデフォルト値を生成するガードを設ける。

```typescript
// ❌ Dangerous: テンプレート座標をデフォルト値で上書きしてしまう
const newTelop = {
  ...DEFAULT_VALUES,
  ...partial,
  x: canvasWidth / 2, // Always resets to center!
};

// ✅ Safe: テンプレート座標の存在を尊重する
const newTelop = {
  ...DEFAULT_VALUES,
  ...partial,
  x: partial.x !== undefined ? partial.x : canvasWidth / 2,
};
```

**UX Benefit**: ユーザーがデザイナーで作成した微調整や、プロフェッショナルなテンプレートが持つ「デザイン意図（黄金比に基づく配置など）」を 100% 保持したまま、属性（テキスト内容など）のみを安全に編集・反映させることができます。

## 46. High-Fidelity External Text Stroke (16-Directional Ring-Shadow)

`-webkit-text-stroke` はテキストのパスを中心に内側と外側に均等に描画されるため、太い縁取りを設定すると文字の内側（塗り）が侵食され、視認性が低下します。また、単純な 8 方向 `text-shadow` では太い縁取り (20px+) や高ズーム時に「トゲ（角）」が目立ちます。

### Pattern: The 16-Directional Smooth Ring
22.5度刻みの **16方向** に `text-shadow` を展開し、各影に微量のぼかし (`blur`) を加えることで、SVG フィルターを使用せずとも滑らかで高品質な外側縁取りを実現します。

```typescript
// 📂 Implementation Logic (TypeScript)
const w = strokeWidth;
const c = strokeColor;
const blur = Math.max(0.5, w * 0.15); // 微量のぼかしでエッジを滑らかに

// 16方向（22.5度刻み）で座標を計算
const angles = [0, 22.5, 45, 67.5, 90, 112.5, 135, 157.5, 
                180, 202.5, 225, 247.5, 270, 292.5, 315, 337.5];

const shadows = angles.map(angle => {
    const rad = (angle * Math.PI) / 180;
    const x = Math.round(Math.cos(rad) * w * 100) / 100;
    const y = Math.round(Math.sin(rad) * w * 100) / 100;
    return `${x}px ${y}px ${blur}px ${c}`;
});

return { textShadow: shadows.join(', ') };
```

**UX Benefit**: 画数の多い和文フォント（漢字）でも塗りが潰れず、商業放送レベルの高品質なテロップ表現が可能になります。

## 44. The Pydantic Field Exclusion Trap (Total Serialization Policy)
AI 開発において Pydantic モデルを拡張する際、新しく追加したフィールドが「ディスク保存時」にサイレントに消失し、再読み込み後に消えている（Regression）ことがあります。
1. **Explicit Include**: `model_dump(include={...})` を使っている箇所を特定し、新しいフィールドを追加。
2. **Schema Audit**: `project.json` を直接開き、構造が期待通りか目視確認。
3. **Roundtrip Test**: 保存 -> クリア -> 読み込みのサイクルをテスト。

## 47. Transient State Hydration (Backend-to-Frontend Sync)
Frontend states like "Approved Lists" or "Selection Sets" (React `useState`) are volatile and reset to `[]` on browser refresh. Even if the backend correctly saved the status (e.g., `APPROVED`), the user loses their local session context, breaking bulk actions (Export/Apply All).

### Pattern: Persistent Status Mapping
1. **Automated Hydration**: During project data fetching, map the persistent `status` fields back to the frontend's transient state controllers.
2. **Sync Effect**: Use a `useEffect` that triggers specifically after the project object is successfully populated from the API.
3. **Integrity Guard**: Ensure this hydration logic only runs when the project ID matches the intended target to prevent cross-project state pollution.

**UX Benefit**: Provides a seamless "Pick up where you left off" experience, converting a stateless browser environment into a robust creative workspace.


### Pattern: Pattern 261 (Mandatory Field Inclusion)
`model_dump()` や `model_dump_json()` を使用する際、`exclude_unset=False` および `exclude_defaults=False` を明示的に指定します。これにより、Pydantic のデフォルトの最適化（値が変更されていない、またはデフォルトと同じフィールドを省く挙動）を抑制し、動的に追加・変更された全てのプロパティを物理ファイルへ強制的に書き込みます。

```python
# ❌ Dangerous: New fields like 'fontFamily' might be excluded if matching default
json_data = obj.model_dump_json()

# ✅ Safe: Guarantees every field in the schema is persisted
json_data = obj.model_dump_json(exclude_unset=False, exclude_defaults=False)
```

## 45. Fetch Integrity Guard (Static Content Intersection)
ブラウザによる「動画ダウンロード」において、サーバーが 404 や 500 エラーを「HTML 形式のエラーページ」として返した場合、ブラウザはそれをそのまま `.mp4` ファイルとして保存してしまい、再生不能な壊れたファイルが生成されます。

### Pattern: Pattern 259/262 (Content-Type Hijack Protection)
API からの動画フェッチ時、ステータスコードに加えて `Content-Type` ヘッダーを検証します。期待する MIME タイプ（`video/mp4` 等）ではなく `text/html` が返された場合、ダウンロード処理を直ちに中断し、ユーザーに「サーバーエラー」を通知するゲートウェイを実装します。

```tsx
const res = await fetch(url);
const contentType = res.headers.get("content-type");

if (!res.ok || contentType?.includes("text/html")) {
  throw new Error("Invalid artifact: Server returned an error page instead of media.");
}
```

## 46. Font Asset Parity (Environment Mapping)
React (CSS) と FFmpeg (drawtext) の間でフォント名を同期させていても、ホストシステムに物理フォントファイルが存在しない場合、レンダリング時にデザインが壊れます。

### Pattern: Pattern 239/260 (Heuristic Alias Mapping & Universal Fallback)
デザイナーが指定したフォント名（例: "Noto Sans JP"）に対し、ホスト OS ごとに確実に存在する代替フォントへのマッピングテーブルを `fonts.json` に定義します。
特に macOS (Apple Silicon) 環境においては、標準フォントの所在が不安定な場合でも **`AppleSDGothicNeo.ttc`** は極めて高い確率で存在し、和文・欧文ともに優れた視認性を提供します。フォントパス解決に失敗した際の「最終的な防衛線」としてこれを指定することで、サイレントな描画失敗やデザインの崩壊を構造的に防ぎます。

## 47. Cross-Layer Asset Optimization & Inventory Audit
複数のレイヤー（Frontend と Backend レンダラー）に跨る資材（特にフォント）のパスを管理する際、OS のバージョンやインストール状況によって「期待したパスにファイルが存在しない」というサイレン・トエラーが発生します。

### Pattern: Pattern 270 (System-Specific Asset Inventory)
資材パスを静的に定義するのではなく、起動時またはデバッグ時にホスト環境の物理ファイル構成を自動スキャンし、利用可能な正規化パスを特定する「インベントリ・オージット」プロセスを導入します。

- **Host Ambiguity**: macOS においても `YuGothic.ttc` のように `/System/Library/Fonts/` 直下にある場合と、`/Supplemental/` サブディレクトリに隔離されている場合があり、固定パス指定はポータブル環境で 100% 失敗します。
- **Resolution**:
    - **Inventory Scrapers**: バックエンド起動時に `glob` や `ls` を用いて、フォントディレクトリ内の実在ファイルをスキャン。
    - **Affordance Discovery**: `fonts.json` において「論理名（Noto Sans JP）」→「優先パスリスト」→「最終フォールバック（ヒラギノ等）」の多段階解決ロジックを実装。
    - **Frontend Visibility**: バックエンドで「解決された実際のフォント名の組み合わせ」を API 経由でフロントエンドへ通知し、UI のセレクタを現在のホストで実際に描画可能な項目のみに動的に制限（Pattern 60 の進化形）または同等視覚を保証。

**UX Benefit**: 動画書き出し後に「テロップが豆腐になったり、フォントが勝手に変わる」という不確実性を排除し、どんなホスト環境（Portable SSD等）でも 120% の再現性を維持します。

## 47. Transcription Learning API Isolation
プロダクトの「設定」や「ログ」を管理する既存の `/learning` API が存在する場合、新しい強化学習機能（差分収集等）を追加するとエンドポイントの衝突やデータの混濁が発生します。

### Pattern: Pattern 264 (Functional Prefixing)
特定のドメイン（文字起こしモデルの強化など）に特化した学習 API は、`/learning/transcription/*` のように明確な名前空間（Prefix）を与えます。これにより、フロントエンドからの統計取得やデータエクスポートの意図を明確にし、既存の統計収集ロジックとの並行稼働を保証します。

フロントエンドのスタイル（CSS）とバックエンドのスタイル（FFmpeg drawtext等）の間で「微妙なズレ」が発生する場合、原因は多くの場合「暗黙的なデフォルト値」の不一致にあります。

In web-based creative tools (e.g., Video Editors), the "Preview" is often rendered using high-level web tech (React/CSS/Canvas), while the "Final Output" is generated by a low-level engine (FFmpeg/Shaders/Metal). Bridging this gap is critical for WYSIWYG reliability.

### Implementation Protocol:
1. **The Twin Fallback**: Ensure that both the Frontend (CSS) and the Backend (Renderer) use identical default values and fallback hierarchies for every styling property.
2. **Abstract Resolvers**: Implement helper functions in the renderer to map logical UI properties (e.g., `fontFamily: "Noto Sans JP"`, `textAlign: "center"`) into engine-specific parameters (absolute paths, coordinate expressions like `(w-text_w)/2`).
3. **Zero-Dependency Fallback**: If a requested asset (font, texture) is missing on the rendering machine, fall back to a "Guaranteed System Asset" rather than failing, and ensure this fallback matches the UI's visual intent as closely as possible.

**UX Benefit**: Eliminates the "Export Anxiety"—the fear that the final file won't look exactly like the preview.

## 50. Dynamic Relative Timing (Temporal Synchronization)

When a creative tool allows users to "crop" or "trim" content from a larger source, the internal timestamps usually drift between Absolute (Source Time) and Relative (Project Time).

### Implementation Protocol:
1. **Offset Propagation**: Calculate the `timelineOffset` (the start time of the first active segment) and propagate it to all overlay/effect filters.
2. **Coordinate Space Conversion**: Standardize on `Relative Time` (0:00 start) for all filter `enable` conditions (e.g., `between(t, RELATIVE_START, RELATIVE_END)`).
3. **Internal Registry Update**: Ensure and document that any change in the project structure (adding a clip, shifting a boundary) triggers an immediate refresh of the "Tempo Map" within the renderer.

**UX Benefit**: Guarantees that synchronized elements like subtitles or motion graphics stay perfectly aligned with the visuals, regardless of where the cutting head is moved.

In high-fidelity tools where "Reviewing" or "Editing" requires multiple sub-tasks (e.g., watching a video, editing captions, selecting templates), a Modal often becomes a bottleneck due to restricted screen real estate and increased cognitive load ("Click Anxiety").

### Pattern: Dashboard-to-Workstation Redirection
Transition from a lightweight "Review Details" modal to a dedicated "Reviewer Page" to provide a full-screen, professional-grade workstation experience.

1. **Context Transfer**: Use URL parameters (`?job_id=XXX`) to pass the selection state from the dashboard to the dedicated page.
2. **Full-Scale Layout**: Leverage the extra space to exhibit side-by-side components (e.g., 9:16 Video Player alongside a 16:9 Timeline Editor).
3. **Workflow Logic**: 
   - Dashboard: Focus on high-level pipeline status and ingestion.
   - Dedicated Page: Focus on deep refinement and creative decision-making.
4. **Psychological Shift**: Moving to a new page signals a "Task Change" more effectively than a modal, helping the user enter a productive "Deep Work" state.

**UX Benefit**: Eliminates the cramped feeling of multi-layered modals and ensures that complex editing tools have the pixels they need to be usable without constant scrolling or overlapping UI.

AI によるハイライト抽出など、非連続なセグメント（ギャップのある切り出し）を行うパイプラインでは、**「Gross Span（全体の開始〜終了の幅）」**と**「Net Duration（実際の素材の合計尺）」**を厳格に区別する必要があります。

- **The Logic**: YouTube ショート等のプラットフォーム制限（60秒など）は、「Net Duration」に対して適用します。AI が退屈なシーンを飛ばして面白い部分だけを繋ぎ合わせる場合、タイムライン上の幅が 60秒 を超えていても、動画としての実尺が 60秒 以内であれば正常なショート動画として成立します。
- **Communication**: UI 上では「動画の実尺（Net）」を主指標として表示し、ユーザーが「制限時間内かどうか」を直感的に判断できるようにします。

## 48. Token-Budgeted LLM Chaining (Overflow Mitigation)

長尺動画（1時間以上）を処理する場合、Phase 1（候補提案）における文字起こしのコンテキストや AI の出力が非常に長くなり、LLM の最大出力トークン制限（16k tokens 等）に達してレスポンスが途切れる `LengthFinishReasonError` が発生しやすくなります。

- **Token-Budgeting**: API 呼び出し時に `max_tokens` を明示的に制限し（例: 8000）、予測可能な範囲内でレスポンスを完結させます。
- **Candidate Capping**: 1回のウィンドウ解析で提案する候補数を制限（例: `min(max, 10)`）し、各候補に割くトークン量を確保します。
- **Conciseness Priority**: 提案フェーズでは詳細な理由付けよりも「候補の網羅性」を優先し、簡潔な応答（Keep responses concise）を指示することで、情報の密度を高めつつ出力オーバーフローを回避します。

## 49. Temporal Reference Frame Alignment (Pattern 118)

In sub-clip editing workflows (extracting segments from a long source), data attributes (timestamps) often retain their "Absolute" source context while the UI player operates in a "Relative" (0:00-based) context.

### Pattern: Consumer-Specific Normalization
Always normalize temporal metadata to match the specific reference frame of the display component.

- **The Absolute Trap**: Backend timeline says `[124s, 130s]`.
- **The Visual Reality**: Short clip player is at `0s`.
- **The Resolution**: Subtract the `clip_start_offset` from all data points before passing them to the UI renderer. If the renderer expects absolute time, it must be explicitly configured with the offset; however, 0-basing the data itself is often less prone to cumulative drift errors.

**Observation (Videdit Case)**: Even with perfectly calculated relative durations, telops "disappeared" because the absolute start time (e.g., 23.2s) never intersected with the player's 0-10s timeline. Explicit normalization to the clip's local 0:00 solved the desync for all extracted shorts.

## 50. Origin-Specific Storage Isolation Pattern (The Localhost Trap)

`localStorage` や `indexedDB` を使用してステートを永続化する際、同一マシン上であってもホスト名やポートの不一致によりデータが「消失」したように見える現象を回避するパターン。

### 1. The Multi-Origin Illusion
- **Issue**: ユーザー（またはエージェント）が `http://localhost:3000` と `http://127.0.0.1:3000` を行き来すると、`localStorage` はオリジンごとに個別のサンドボックスを作成するため、一方で作ったテンプレートが他方では「空」に見える。
- **Risk**: 開発者が「保存機能が壊れている」と誤認し、正常なコードを不必要にデバッグし始める。

### 2. Strategy: Origin Discipline
- **Standard Hostname**: チーム全体で検証に使用するホスト名を `localhost` か `127.0.0.1` かのどちらかに統一することを開発ドキュメントに明記する。
- **Storage Warning**: データの不整合が疑われる場合、`browser_subagent` 等で `localStorage` の鍵を確認するチェックリストを FBL に統合する。
- **Cross-Domain Handover**: もし本格的な同期が必要な場合、`BroadcastChannel` API や、バックエンドを介した同期へとアーキテクチャを格上げする。

**UX Benefit**: ツール間のデータ連携において、「昨日作ったテンプレートがない」という不信感を排除し、ステートの永続性に対する信頼を 120% 維持します。

## 51. History-Aware State Management (Undo/Redo Flow)
Zustand 等の状態管理ライブラリに `history` 配列と `historyIndex` を保持し、状態変更のたびにスタックを積み上げます。

1.  **State Structure**: `history: State[]`, `historyIndex: number`.
2.  **Action Persistence**: 各アクション内で現在の状態を history に push し、`historyIndex` 以降の未来の履歴を削除します。
3.  **Keyboard Interception**: `Ctrl+Z` (Undo), `Ctrl+Shift+Z` / `Ctrl+Y` (Redo) をグローバルリスナーで捕捉します。
4.  **Guard Rails**: 入力フィールド (input, textarea) フォーカス中はショートカットを無効化します。

**UX Benefit**: 「失敗しても戻れる」という安心感がユーザーの創造性を加速させます。

## 52. Micro-Typographic Precision (Letter Spacing & Line Height)

テロップデザインにおいて、フォントのデフォルト設定のままでは文字が離れすぎたり、行間が広すぎて締まりがない印象を与えます。

### Pattern: Professional Metric Defaults
プロフェッショナルな映像制作の基準に合わせ、以下のプロパティを調整可能にします。
- **Letter Spacing**: デフォルト 0px。広告バナーのように詰める (-1px 〜) 設定を許容。
- **Line Height**: デフォルト 1.2。標準の 1.5 以上では映像に対して間延びするため、プロ仕様としてタイトに設定。

**UX Benefit**: 放送品質のテロップに共通する「密度の高い美しい文字組」を容易に再現できます。

## 53. Metadata-to-UI Integrity Protocol (Default Value Hazard Mitigation)

AI 解析エンジン（Python等）が正常に結果を出力しても、それを UI 用の JSON/Dictionary に変換するフェーズ（`_to_dict` 等）でバグやマッピング漏れが発生すると、ダッシュボード上に「全部 0 秒」「スコア 0 点」といった「形だけの成功」が表示され、ユーザーは混乱します。

### Pattern: The "Resolution Checklist" in Converters
オブジェクトを辞書に変換、あるいは別のスキーマ（`Blueprint` 等）へマッピングする際、以下の 3 点を必ず外部から供給または解決します。

1.  **Context Injection**: 変換メソッド単体では解決できない値（例: グローバルインデックスから具体的な開始時間への変換）がある場合、必ず解決済みの `segment_map` やコンテキストオブジェクトを引数として渡し、メソッ内部での「推測」や「ハードコードされたデフォルト値 (0.0)」を排除する。
2.  **Schema Evolution Sync**: スコア項目が追加（例: 3タイプ別スコアリング）された場合、解析 -> 中間モデル -> 最終 Blueprint のすべてのパスでマッピングを更新し、旧来のフィールド（`total_score` 等）に適切に集約、あるいは新設されたフィールドが UI まで貫通するように監視する。
3.  **Default Value Audit**: 変換に失敗した場合のフォールバック値を `0.0` や `None` にする場合、それが UI 上で「致命的な機能不全」に見えないか検討する。不透明な 0 値を出すよりは、明示的に `-1` や `UNKNOWN` を返し、UI 側で警告を出す設計の方がデバッグ効率が高い。

**UX Benefit**: 「AI は仕事をしたのに、システムが結果を壊した」というサイレントな品質低下を防ぎ、ユーザーに届けられる情報の正確性を担保します。

## 54. Canvas Viewport Management (Zoom Fit/Reset)

高解像度キャンバス（4Kや縦長動画）を扱うクリエイティブツールでは、全体配置の確認と細部の精査（ドット単位）を頻繁に行き来します。

### Pattern: Fast Viewport Switching
スライダーやマウスホイールだけでなく、以下の2つのプリセットボタンを常設します。

1.  **Reset to 100%**: 現在のズームレベルに関わらず、即座に 1:1 表示（100%）に戻す。
2.  **Scale to Fit**: 現在の利用可能なコンテナ幅に基づき、キャンバス全体が収まる最大サイズに自動スケーリングする。
    - `fitZoom = Math.min(containerWidth / canvasWidth, 0.8)` (巨大化を防ぐための上限を設ける)

**UX Benefit**: 「今、自分が何を見ているのか（拡大しすぎていないか）」という空間的認知の迷子を防ぎ、効率的なレイアウト作業を支えます。

## 55. Alignment-Aware Content Anchoring (CSS Transform Anchor)

絶対座標 (`left`, `top`) で配置された動的コンテンツに対し、要素の幅が決まっていない（内容に応じて変化する）状態で「中央寄せ」や「右寄せ」を実現する必要があります。

### Pattern: Transform-Relative Snapping
座標 `x` をアンカーポイント（基準点）と定義し、`left: x` を適用した上で `transform` プロパティを使用して要素自体の位置をオフセットします。

- **Left (Default)**: `transform: none`
- **Center**: `transform: translateX(-50%)`
- **Right**: `transform: translateX(-100%)`

**UX Benefit**: テキストの内容が変更されても、常に指定した基準点（例: キャンバス中央）から左右均等に広がるような、デザイン意図に沿った自動レイアウトが可能になります。

## 56. Modern Visual Preset Standards (2026 Standards)

AI ツールにおけるスタイルプリセットは、単なる「色の設定」ではなく、ツールの「格（プレミアム感）」を定義します。

### Pattern: Progressive Aesthetic Presets
2026年のデザイントレンドに基づき、以下の要素を組み合わせたプリセットを標準化します。
- **Layered Shadows**: 多重のドロップシャドウによる立体感。
- **Dynamic Gradients**: メタリックやネオンの質感を再現するアングル付きグラデーション。
- **Glassmorphism Integration**: 背景の透過とブラーを活かしたモダンなパネル。
- **Category-Specific Context**: 「ニュース」「YouTube」「シネマ」等、ユーザーが利用シーンを想起しやすい分類。

**UX Benefit**: ユーザーは専門的なデザイン知識がなくても、ワンクリックで「プロフェッショナルな品質」に到達できるため、ツールに対する信頼と満足度が向上します。

## 57. Reactive UI-State Equilibrium (Labeled Event Synchronization)

複雑なプロパティパネル（サイズ、座標、不透明度など）において、スライダーやドラッグ操作による「内部状態（State）」の変更と、UI 上の「数値ラベル（Display）」が一致しなくなる「Label De-sync」を防ぐ必要があります。

### Pattern: Reactive Display Truth
- **The Problem**: ユーザーがスライダーを高速に動かした場合、キャンバスの描画（重い処理）は追従しているが、React の再レンダリング待ちで数値ラベル（例: "58px"）が古いまま残り、ユーザーに「ツールが壊れている」という不信感を与える。
- **Resolution**: 
  1. **Dual Update Strategy**: スライダーの `onChange` (または `onInput`) において、大規模な state 更新（再描画）を待たずに、数値ラベル専用のローカル state または DOM 直接操作（`ref`）による即時更新を行い、「操作への応答性」を視覚的に担保する。
  2. **Truth Consistency**: 最終的な描画完了時、必ず内部 state の値が数値ラベルに反映されることを保証する。

**UX Benefit**: 0.1秒以下の遅延であっても数値がズレる不快感を取り除き、高機能ツールにおける「精密な操作感」と「信頼性」を確立します。

## 58. Historical State Snapshot (Zustand Undo/Redo Workflow)

グラフィックエディタやクリエイティブツールにおいて、破壊的な変更（削除、全てのクリア、一括スタイル適用）に対する心理的ハードルを下げるため、Undo/Redo 機能は必須です。

### Pattern: Immutable History Stack
- **The Problem**: 複雑な React ステートを手動で「元に戻す」のは非常に困難で、不整合を生み出しやすい。
- **Resolution**:
  1. **History State**: ストアに `history: T[][]` (過去の全データのスナップショット) と `historyIndex` を保持する。
  2. **Snapshot Timing**: 各アクション（`update` 等）の実行直前に、現在の状態を `history` に push する。この際、Redo 分（現在インデックスより先）を破棄（`slice(0, index + 1)`）することで、タイムラインの分岐を整合させる。
  3. **Atomic Swap**: `undo` 時は `index - 1` のスナップショットをステートにまるごと被せる。

**UX Benefit**: 「失敗しても戻せる」という安心感が、ユーザーの試行錯誤（クリエイティビティ）を劇的に加速させます。

## 59. High-Density Interactive Keyboard Mapping

マウス操作とキーボードを組み合わせた「高速なワークフロー」を実現するためのショートカット設計標準。

### Pattern: Context-Aware Global Shortcuts
- **The Problem**: キャンバス外でバックスペースを押すとページが戻る、あるいはテキスト入力中にショートカットが誤爆するといった事象が UX を阻害する。
- **Resolution**:
  1. **Target-Aware Guard**: ショートカットハンドラ内で `e.target` が `INPUT` または `TEXTAREA` の場合は処理をスキップする。
  2. **Power-User Modifiers**: `Shift` キーによる倍率変更（例: 矢印キーで 1px 移動 vs 10px 移動）を標準化。
  3. **Universal Identifiers**: `Ctrl+D` (Duplicate), `Delete` (Remove), `Ctrl+Z` (Undo), `Ctrl+Shift+Z` (Redo), `Arrows` (Nudge) などの業界標準（Adobe, Figma風）に従う。

## 60. Unbounded Resource Presentation (Avoiding Display Throttling)

開発初期段階において、パフォーマンス確保や UI の「収まり」のためにリスト（プリセット、テンプレート、フォント等）の表示件数をハードコード（例: `slice(0, 6)`) で制限する手法は、システムが拡張された際に「追加したはずの機能が見当たらない」というサイレント・バグの原因となります。

### Pattern: The Dynamic Infinite Palette
- **The Problem**: プリセットを 12 種類に増やしても、UI コードに `slice(0, 6)` が残っているため、ユーザーには半分しか見えず、「機能が追加されていない」と判断される。
- **Resolution**:
  1. **Remove Arbitrary Throttling**: 静的な定数（`STYLE_PRESETS` 等）を表示する際は、原則として表示件数の制限を `slice` などで行わず、全件をマッピングする。
  2. **Layout Over Throttling**: UI が崩れる場合は、件数制限ではなく `overflow-auto`, `grid`, `flex-wrap` 等の CSS レイアウト手法で「収める」解決策を優先する。
  3. **Performance Scaling**: 件数が数百件を超える場合は、`slice` ではなく `Virtual Scrolling` 等のパフォーマンス最適化レイアウトを採用し、機能の「到達性（Accessibility）」を損なわないようにする。

**UX Benefit**: システムの拡張（例: プリセットの追加）が即座にユーザーへ届くようになり、「機能は存在し、かつ見える」という一貫性が担保されます。

## 61. Proactive Resource Preloading (Font Readiness)

クリエイティブツールにおいて、フォントや画像、動画素材の読み込み遅延は、キャンバス描画の「ちらつき」や、配置計算の「不整合（フォント未読込による幅の誤認）」を引き起こします。

### Pattern: The Forced Handshake Hook
`document.fonts.ready` を待つだけでなく、重要なフォントファミリーに対して明示的に `document.fonts.load()` を実行し、完全な準備が整ったことをステートで管理します。

1.  **Direct Loading**: `document.fonts.load('bold 48px "FontFamily"')` を使用して、OS やブラウザのキャッシュに関わらずフォントのバイナリ取得を強制します。
2.  **Ready State Hook**: 全ての必須リソースがロードされるまでコンポーネントを待機させる、またはロード完了を検知してキャンバスを再描画するカスタムフックを導入します。
3.  **Fallback Discipline**: ロード失敗時でも UI がフリーズしないよう、一定時間のタイムアウト後にフォールバックフォントにフォールバックさせる。

**UX Benefit**: ユーザーがフォントを切り替えた瞬間に、期待通りのスタイル（太さ、幅）が遅延なく正確に反映される「ドットバイドットの安定性」を提供します。

## 62. Contextual Shortcut Discovery (The '?' Pattern)

高機能なエディタにおいて、多数のショートカットキー（Undo, Redo, 複製, 削除, Nudge等）は強力な武器ですが、ユーザーがそれらを記憶するコストが学習の障壁となります。

### Pattern: The Universal Help Toggle
単なるドキュメントページへのリンクではなく、現在のキャンバス状態を維持したままオーバーレイでショートカット一覧を表示する「'?' キー」によるトグル機能を実装します。

1.  **Global Key Listener**: フォーカスが入力要素（Input/Textarea）にない場合に限り、`?` (Shift + `/`) キー入力をフックしてヘルプステートをトグルします。
2.  **Focus Guard**: ショートカットがテキスト入力中に誤爆して「意図しないヘルプ表示」が発生しないよう、`e.target` のチェックを徹底します。
3.  **Visual Overlay**: モーダル、あるいはサイドパネルとして、ショートカットを「役割別（移動、編集、表示）」に整理して美しく表示します。
4.  **Implicit Discovery**: UI の隅に小さな「?」アイコン、または「Press ? for help」というヒントを配置し、機能の存在を暗黙的に伝えます。
5.  **Escape Dismissal Hook**: `Escape` キー入力をフックし、モーダルが表示されている場合は「選択解除」よりも「モーダルを閉じる」アクションを優先させることで、直感的な操作感を提供します。

**UX Benefit**: 「技術書を読み込む」必要性を排除し、ツールを使いながら自然に高度な操作をマスターできる「プレイアブルな学習体験」を提供します。

## 63. Performance-Aware Layered Effects (Density Capping)

`text-shadow` や SVG フィルターを用いたリッチな視覚効果（ネオン、3D、多重縁取り）は、層数が増えるほど GPU/CPU 負荷が指数関数的に増大し、キャンバス操作のレスポンス（Nudging や Typing）を損なわせます。

### Pattern: The Adaptive Multi-Stack
1.  **Semantic Layering**: 「単に層を増やす」のではなく、中心に近い層は濃く・シャープに、遠い層は薄く・広く（Blur を大きく）分散させることで、少ない層数でリッチな質感を演出します（ネオン効果）。
2.  **Hard Capping**: ユーザーが設定できる最大値（例: depth 100）をそのまま描画層数に反映させず、視覚的な変化が飽和するポイント（例: 10層）でハードキャップします。
3.  **Real-time vs Export Dithering**: 操作中は低密度のスタックでレンダリングし、動画書き出し時のみフルスペックのスタックを使用するアーキテクチャ。
4.  **Z-Index Optimization**: 複雑なエフェクトを持つ要素には `will-change: transform` や `z-index` を適切に割り当て、ブラウザのレイヤー合成を最適化します。

**UX Benefit**: 0.1秒を争うリアルタイム編集においても、放送品質のビジュアルと「吸い付くような」操作感を両立させます。

## 64. Multi-line Canvas Continuity (The Break-Safe Hook)

キャンバスベースのテキストエディタにおいて、デフォルトの `white-space: nowrap` はシンプルですが、動画キャプションや強調テロップには不十分です。ユーザーが意図した「改行」を正確にレンダリングし、かつ自動折り返しとのバランスを保つ必要があります。

### Pattern: The Pre-Wrap Canvas
1.  **Preserve Intent**: `white-space: pre-wrap` を使用し、ユーザーが手動で入力した改行 (\n) を確実に反映させます。
2.  **Baseline Awareness**: 複数行時、1行目のアンカー位置（Center/Top/Bottom）が変わらないよう、`display: flex` や `align-items: center` と組み合わせ、テキスト全体のバウンディングボックスを基準にレイアウト計算を行います。
3.  **Input Synchronization (The User-Preference Override)**: UI 上の入力フィールドが `input` (1行) のままで改行を許容すると、ユーザーは「改行できるのに見えない」という混乱に陥ります。基本は `textarea` への同期ですが、**「1行テロップの高速入力」を重視するユーザー向けの意図的な制約** として `input` を維持する場合、レンダリングエンジン側（Canvas）が複数行をサポートしていても、入力 UI を簡略化するトレードオフを許容します。

**UX Benefit**: システムの技術的ポテンシャル（複数行対応）を維持しつつ、ユーザーの慣習や速度に最適化された UI を柔軟に提供できます。

## 65. Zero-Dependency Image Export (The Hidden Canvas Proxy)

ブラウザ上の複雑な DOM 状態（Web Fonts, Nested Shadows, Filters）を正確に画像としてエクスポートする際、`html2canvas` 等の大型ライブラリは依存関係の重さや CSS 解釈の不正確さが問題になることがあります。

### Pattern: The Mirrored Manual Renderer
1.  **Canvas Mirroring**: 表示用の React/HTML 要素のプロパティ（fontSize, fontFamily, fill, stroke）を 1:1 で模倣する Canvas 描画ロジックを独立させて実装します。
2.  **Ephemeral Canvas**: エクスポート実行時のみ `document.createElement('canvas')` で隠しキャンバスを生成。
3.  **Raster Consistency**: `ctx.font` や `ctx.shadow*` を使用し、デザイン意図をピクセルベースで再現。特に縁取り（Stroke）は `strokeText` の `lineWidth` を正確に 2倍（内側外側分散のため）に設定してシミュレートします。
4.  **Instant Delivery**: `canvas.toDataURL('image/png')` を生成し、動的なアンカータグを用いて即座にダウンロードを提供。

**UX Benefit**: 外部ライブラリのロード待ちやエラーを排除し、エディタで見ているデザインを「そのまま」の品質で、軽量かつ確実に手元へ届けます。

## 66. Interaction Fault-Tolerance (Silent Failure Audit)

ボタンがホバー効果を持ち、視覚的に「押せる」状態にあるにもかかわらず、クリックしても何も起きない（ネットワークリクエストもコンソールログも出ない）状態は、ユーザーに「ツールがフリーズした」あるいは「自分の操作が無視された」という強い不信感を与えます。

### Pattern: The Handler Presence Guard
1.  **Event Binding Verification**: `onClick` ハンドラが条件分岐（`if (loading) return` など）によってサイレントに終了していないか、あるいは `Pointer-events: none` が意図せず残っていないかを精査します。
2.  **Visual Feedback Guarantee**: すべてのアクションにおいて、即時の視覚的フィードバック（ボタンの loading 状態、トースト通知、あるいは少なくともコンソールへの `Action Triggered: [Name]` ログ）を義務付けます。
3.  **Silent Failure Detection**: `try-catch` ブロックでエラーを握りつぶさず、必ず `console.error` またはユーザー向けのエラー通知（Alert/Toast）へバイパスします。
4.  **Hydration Guard**: Next.js 等の SSR 環境では、ハイドレーション・ミスマッチによりイベントリスナーの付与がスキップされることがあります。「ログ付きのハンドラ」を注入することで、クライアント側での接続を強制的に確認・デバッグします。

**UX Benefit**: 「押したのに反応がない」というサイレントな機能不全を排除し、常にシステムとユーザーが対話している感覚を維持します。

## 67. Context-Persistent Modal Navigation (Draft Continuity)

複雑な設定（文字、色、配置など）を行うモーダルにおいて、誤って「閉じる」操作をしたり、一時的に別の画面を確認した際に、それまでの編集内容がすべてリセットされる（初期化される）挙動は、ユーザーの「作業意欲」を著しく削ぎます。

### Pattern: The Non-Destructive Close
1.  **State Up-lifting**: モーダル内部のローカルな `useState` ではなく、親コンポーネントまたは Zustand/Redux などのグローバルストアに「編集中（Draft）」の状態を保持します。
2.  **Dirty State Guard**: 変更がある状態でモーダルを閉じようとした際、「変更が保存されていません。破棄しますか？」という警告を出すか、あるいは「自動保存（Auto-save to Draft）」を実装します。
3.  **Re-entry Restoration**: モーダルを再度開いた際、前回の「確定されていない編集状態」から再開できるようにします。

**UX Benefit**: 「操作を誤ると作業が消える」という恐怖からユーザーを解放し、安心して深い編集作業に没入できる環境を提供します。

## 68. The Editable-Mirror (State-Synced Input)

AI が生成した大量のテキスト要素（テロップ、要約、翻訳など）を、ユーザーが「そのままその場で」微調整できるようにするパターンです。

### Pattern: Reactive List Editor
1.  **Direct Surface Editing**: 表示用の `div` や `span` を `input` または `textarea` に置き換え、リストの全項目を編集可能な状態にします。
2.  **Immutability-Safe Update**: `onChange` 内で配列のコピー（`[...list]`）を作成し、特定のインデックスのみを更新して `setState` する「Controlled Component List」パターンを徹底します。
3.  **Visual Metrics Feedback**: 編集中のテキストに合わせて「文字数」「表示尺」などのバリデーション指標をリアルタイムで再計算し、色（例: 制限超過で赤）やバッジで即座にフィードバックを与えます。
4.  **Bulk Regenerate Safety**: AI による「再生成」機能が実行された際、手動編集の内容を上書きするか・マージするかを明確に定義し、整合性を担保します。

**UX Benefit**: 「AI が出した結果を一度ダウンロードして別アプリで直す」という手間を排除し、ツール内での「最終的な調整」を可能にすることで、ワークフローの完結性を高めます。

## 69. WYSIWYG Font Guarantee

デザインツールや動画エディタにおいて、ユーザーが選択したフォントが「プレビュー時」と「書き出し時」で一致することを保証するパターンです。

### Pattern: Preemptive Font Synchronization
1.  **Explicit Loading**: `next/font/google` 等の最適化エンジンを使用している場合でも、エディタ内で選択可能な全フォントを `layout.tsx` または専用のプリロード・フックで明示的に読み込みます。
2.  **CSS Variable Mapping**: 読み込んだフォントを CSS 変数（`--font-noto-sans`）として定義し、Canvas やプレビューのインラインスタイルから動的に参照可能な状態にします。
3.  **Canvas Readiness**: Canvas 描画（`ctx.font = ...`）を行う前に、`document.fonts.ready` を待機し、フォント未ロードによるデフォルトフォント（豆腐化やレイアウト崩れ）での描画を防止します。
4.  **Style Preset Coupling**: スタイルプリセットを適用する際、色や縁取りだけでなく、そのデザインに最適なフォントをセットで適用し、フォント未設定による「デザインの劣化」を防ぎます。

**UX Benefit**: 「設定したはずのフォントが反映されない」という不信感を排除し、デザインの意図を正確に最終出力まで維持します。

## 70. Aspect-Aware Component Initialization & Wrapping

特に 9:16 (Vertical) と 16:9 (Horizontal) が混在するキャンバス・エディタにおいて、新規要素を「期待通りの向きとサイズ」で描画するためのパターンです。

### Pattern: Resolution-Relative Defaulting & Conditional Wrapping
1.  **Dynamic Bounding Box**: 固定値（例: 400px）で要素を追加するのではなく、`canvasWidth * 0.8` のように、現在の解像度に基づいた相対的な初期幅を算出します。
2.  **Constraint Checking (Vertical Guard)**: 9:16 のような横幅が狭いキャンバスでは、`white-space: pre-wrap` により無意識の「縦書き化」が発生します。
    - **Strategy: String-Based Wrapping Choice**:
        - 改行文字を含まないテキスト → `white-space: nowrap` を適用し、横方向の整合性を強制。
        - 改行文字を含むテキスト → `white-space: pre-line` を適用し、意図的な改行を許容。
3.  **Template-Driven Anchoring**: 可能な限り、空のキャンバスに追加するのではなく、現在のテンプレートの「セーフエリア」や「デザインガイド」の交点にアンカーさせ、ユーザーがリサイズを行う必要性を最小化します。

**UX Benefit**: 動画のフォーマット（TikTok/Shorts vs YouTube）に関わらず、追加した要素が常に「使い物になるサイズと配置」で現れるため、編集の開始速度を 120% に向上させます。


## 71. Directional Icon Mental Models (Import/Export)

「インポート/エクスポート」のアイコン選択において、システムの技術的視点（ブラウザ挙動）とユーザーの直感的視点（データの流れ）の乖離を解消するパターンです。

### The Perspective Gap
1.  **Technical View (Browser-Centric)**:
    - **Import**: ファイルを選択してアプリに読み込む = サーバー/JSエンジンへの「アップロード」 (`Upload` / Arrow Up)。
    - **Export**: アプリの状態をファイルとして保存する = ローカルへの「ダウンロード」 (`Download` / Arrow Down)。
2.  **User View (App-Centric)**:
    - **Import**: 外部からアプリの中へ「入れる」 = 矢印が中/下を向くべき (`FileDown` / `Download`?)。
    - **Export**: アプリの中から外部へ「出す」 = 矢印が外/上を向くべき (`FileUp` / `Upload`?)。

### Pattern: Semantic Clarity
1.  **Label Over Icon**: アイコンだけに頼らず、必ず「インポート/JSON読込」「書き出し/ダウンロード」といった具体的なテキストラベルを併記します。
2.  **Abstract Action Icons**: 矢印の上下（Upload/Download）で混乱を招く場合、`FolderOpen` (Import) や `Save` (Export)、あるいは `FileJson` にプラス/マイナスのバッジを付けたアイコンを使用することで、動作の「意味（セマンティクス）」を明確にします。
3.  **Consistency Guard**: 同一プロジェクト内では、すべてのインポート操作に同一のアイコン（例: `Upload`）を適用し、ユーザーの学習コストを最小化します。

**UX Benefit**: 「どっちがどっちかわからない」という認知的摩擦を排除し、データ入出力操作の安全性を高めます。

## 72. Destructive vs. Additive Style Presets

デザインツールにおいて、スタイルプリセットの適用が既存の設定を「完全に上書き（Destructive）」するか、「特定プロパティのみ追加（Additive）」するかの設計指針です。

### Implementation Nuances
1.  **Destructive (Overwrite)**: `applyPreset: (p) => set({ ...t, ...p.style })`
    - **Pros**: プリセット作成者が意図した通りのビジュアルが 100% 再現される。
    - **Cons**: ユーザーが事前に調整していた個別の設定（例: 絶妙な不透明度や縁取りの太さ）が消失し、「他の設定が勝手に変わった」というストレスに繋がる。
2.  **Additive (Selective)**: 変更が必要なプロパティだけをマージする。
    - **Pros**: ユーザーの既存の作業を尊重できる。
    - **Cons**: プリセット適用後のビジュアルが、他の既存設定（例: 補色関係にない背景色）と干渉し、期待外れの結果になる可能性がある。

### Recommendations
- **Multi-select Presets**: 色だけ変える（Color Preset）、形だけ変える（Shape Preset）のように、プリセットを粒度細かく分離する。
- **Undo Continuity**: プリセット適用を 1つの履歴（Undo Step）として保持し、即座に元の微調整状態に戻れることを保証します。

**UX Benefit**: 強力な一括変更機能を提供しつつ、ユーザーの「細部へのこだわり」を破壊しない柔軟なエディタ体験を実現します。

## 73. Contextual Editor Pre-population (Bridge Pattern)

独立した「高度なエディタ」と「管理/レビュー画面」を繋ぐ際、ユーザーがエディタを開いた瞬間に最も期待されるアクションを自動で完了させておくパターンです。

### The Empty State Problem
- ユーザーが管理画面から「高度な編集」リンクをクリックして遷移しても、エディタが真っ白（デフォルト状態）だと、再度データを選択したり「テロップ追加」ボタンを押す手間が発生し、フローが分断されます。

### Implementation: The Query-String Bridge
1. **Context Pass**: リンクのクエリパラメータに、対象の `id` だけでなく、表示すべき `text` (transcript) を含めます。
2. **Auto-Init Effect**: エディタ側で `transcript` パラメータを検知した場合、既存の状態をクリアし、最適なデフォルト値（例: 中央下部、標準フォント、標準サイズ）で要素を一つ自動生成します。
3. **Outcome**: ユーザーは「追加」という定型操作をスキップし、本質的な「調整・デザイン」から作業を開始できます。
4. **Contextual UI Pruning**: 特定のコンテキスト（例: ショート編集フロー）から開かれた場合、手動での「新規追加」ボタンを非表示、または優先度を下げることで、ユーザーを迷わせない動線を実現します。

**UX Benefit**: 認知負荷と操作ステップを劇的に削減し、専門的なツールへの「心理的心理障壁」を取り除きます。


## 74. Intent-to-Action Validation (Immediate Feedback)

外部プロジェクト（ショート動画等）へのデータの「アサイン」や「適用」において、その成功と結果を即座に、かつ具体的に伝えるパターンです。

### Pattern
- **Action Label**: 「保存」ではなく「テロップを適用」のように、具体的でポジティブなラベル（Emerald/Teal Gradient等）を使用します。
- **Specific Success Message**: `alert('適用しました')` ではなく、`alert('✅ 12個のテロップをショートに適用しました！')` とカウントやステータスを含めて返します。
- **Navigation Feedback**: 適用後、元の画面に戻るのか、そのまま編集を続けるのかをユーザーが選べる状態にするか、あるいは適用後の状態がエディタ上に永続化されていることを視覚的に示します。

**UX Benefit**: 「本当に外部のプロジェクトに反映されたのか？」という不安を払拭し、システムへの信頼を 120% に高めます。

## 75. UI-Handler Connectivity Audit (Gap Analysis)

複雑なコンポーネントにおいて、バックエンド連携や重要ロジック（`handle...`, `on...`）を実装したものの、UI上のボタンやトリガーへの紐付けを忘れてしまう「実装の谷間」を防ぐパターンです。

### The Shadow Logic Problem
- 大規模なリファクタリングや機能追加において、ロジック部分は完成しているが、JSX側での `onClick` 指定漏れや条件分岐による非表示により、機能が「隠れた状態」でリリースされるリスク。

### Audit Methodology
1. **Identifier Grep**: `grep` 等を使用して、重要ハンドラ（例: `handleApply`, `handlePsdImport`, `onApply`）の定義場所を特定する。
2. **Reference Check**: それらの識別子が JSX 内で有効なボタントリガー等に `onClick={handle...}` として紐付いているか、コードベース全体でクロスチェックする。
3. **Traceability**: 特に `onApply` のような props 経由のコールバックが、末端のボタンまで正しくバケツリレー（Prop Drilling または Store access）されているかを追跡する。

### Outcome
- 「コードは書いたが動かない」という初歩的な不具合を排し、120% の品質保証を実現します。これは機能実装後の「最終チェック・チェックリスト」として標準化すべき工程です。

## 76. Single-Entity UI Optimization (Focus Mode)

ツールが複数の要素（レイヤー、アイテム、レコード）を扱える汎用的な機能を持っていても、特定のワークフローが「1つの要素の編集」に特化している場合、リスト管理や作成に関する UI を積極的に隠蔽するパターンです。

### The Management overhead Problem
- 汎用エディタ（例: TelopDesigner）は通常、複数要素の追加や重ね順管理を必要としますが、特定のタスク（例: ショート動画の字幕修正）では要素が常に1つであることを前提とします。
- この際、レイヤーリストや「追加」ボタンが残っていると、ユーザーは「追加しなければならないのか？」「順序を気にする必要があるのか？」という不要な問いに直面します。

### Implementation Strategy
1. **Context Detection**: エディタ起動時のコンテキスト（クエリパラメータやストアの状態）から、単一要素編集モードであるかを判定します。
2. **UI Pruning**:
    - **List Views**: レイヤーパネル、タイムラインリスト、履歴リストなどの「複数を俯瞰する UI」を非表示にします。
    - **Creation Triggers**: 「新規作成」「複製」「インポート（追加）」などのボタンを除去します。
3. **Property Centric Layout**: 画面の余白をキャンバスや詳細設定（プロパティエディタ）に割り当て、調整作業の没入感を高めます。

**UX Benefit**: ユーザーが「今やるべきこと」に 100% 集中できる環境を提供し、不要な機能への意識の分散を防ぎます。

## 77. High-Precision Object Snapping (Magnetic Guides)

自由度の高いクリエイティブエディタにおいて、ユーザーが手動でピクセル単位の調整を行うストレスを軽減し、一貫性のあるレイアウトを強制するパターンです。

### The "Slightly Off" Anxiety
- 自由なドラッグ操作が可能だと、目視では中央に見えても実際には数ピクセルずれている状態（不気味な谷の一種）が発生しやすく、ユーザーに「やり直し」の不安を与えます。

### Implementation: Logic Snapping
1. **Define Critical Zones**: キャンバスの幾何学的中心、およびセーフエリア（パディング内側）を定義します。
2. **Threshold Snapping**: 
    - ドラッグ中の座標と対象座標の差が一定値（例: 15px）以下になった瞬間、値を対象座標に固定します。
3. **Visual Cues (Future Extend)**: スナップした瞬間に、一時的なガイド線（センターライン）を表示することで、吸着の成功を視覚的にフィードバックすることが望ましいです。

**UX Benefit**: 「適当に近づけるだけでピタッと止まる」体験を提供することで、操作の「正解」をユーザーに示し、編集速度と品質を同時に向上させます。


## 78. The Fidelity of Absence (Empty State Symmetry)

データやアセットが読み込まれていない「プレイスホルダー（空状態）」において、視覚的な崩れを徹底的に排除し、システムの信頼性を維持するためのパターンです。

### The "Unfinished" Impression
- ローディング中や動画プレビューがない状態（No Preview）で、警告アイコンやテキストが「なんとなく上寄り」「少しズレている」状態だと、ユーザーは「システムがバグっている」または「品質が低い」という印象を抱きます。

### Implementation: Dead-Center Placards
1. **Container Consistency**: プレイスホルダーを囲むコンテナは、実際のコンテンツ（動画等）と全く同じアスペクト比・サイズを維持します。
2. **Absolute Center Flexbox**:
   ```tsx
   <div className="absolute inset-0 flex flex-col items-center justify-center">
     <Icon />
     <span>No Content</span>
   </div>
   ```
3. **Viewport-Aware Centering**: キャンバス全体が中央にない場合やスクロールが発生する場合でも、視覚的な重心がプレイスホルダー内の中心に来るよう調整します。

**UX Benefit**: 何もない状態（空の状態）を美しく整えることで、ユーザーに「意図的な空の状態」であることを伝え、編集作業の開始に対する心理的な摩擦を最小化します。

## 79. Entity-Bound Placeholder Alignment (Contextual Symmetry)

キャンバス全体の中央ではなく、特定の「枠（バウンディングボックス）」や非表示の「ガイドレイヤー」を基準にプレイスホルダーを配置し、視覚的な重心を最適化するパターンです。

### The Global-Center Fallacy
- プレイスホルダー（空状態）を単純にキャンバスの幾何学的中央に配置すると、特定のレイアウト（例: 動画が上半分にしかないデザイン）において、プレイスホルダーが「本来あるべき場所（枠内）」から外れて表示され、ユーザーに不正確な印象を与えます。

### Implementation: Bounding Box Centering
1. **Target Identification**: プレイスホルダーが代用すべき具体的なエンティティ（例: 映像レイヤー、画像領域）の座標とサイズを特定します。
2. **Local Centering Logic**:
   ```tsx
   <div 
     style={{
       position: 'absolute',
       left: target.x + target.width / 2,
       top: target.y + target.height / 2,
       transform: 'translate(-50%, -50%)',
       width: target.width,
       height: target.height
     }}
   >
     {/* Localized Content */}
   </div>
   ```
3. **Responsive Mapping**: 親コンテナのズームやスケーリングに追従し、常に「ターゲットとなる枠内」に中心が維持されるようにします。

**UX Benefit**: 動画や画像が表示される「予定地」を正確に示すことで、ユーザーは完成形をより具体的にイメージでき、エディタ上での位置調整や確認の精度が飛躍的に向上します。

## 80. Transparency-Controlled Reference Overlays (Verification Layer)

WYSIWYG（見たままが得られる）を実現する制作ツールにおいて、最終出力の「正解」であるデザインガイドラインを常に重ね合わせて確認できるようにするパターンです。

### The "Side-by-Side" Limitation
- デザイン指示書を別の画面やウィンドウで確認しながら編集する「横並び」の作業では、数ピクセルの位置調整やフォントの太さの微妙な差異に気づくことが難しく、手戻りが発生しやすくなります。

### Implementation: Dynamic Overlaying
1. **Toggleable Guide**: デザインテンプレート（PSD や Figma のエクスポート画像）を編集画面上の最前面にオーバーレイとして配置できるトグルを提供します。
2. **Real-time Alpha Blending**: 
   - 0% から 100% まで無段階で透明度を変更できるスライダーを UI に配置します。
   - ユーザーは透明度を調整しながら（フリッカーテストのような感覚で）、ガイドと実物の差異を肉眼で検出します。
3. **Property Preserving**: オーバーレイ自体は `pointer-events-none` とし、背後の要素の操作を妨げないように設計します。

**UX Benefit**: ユーザーに「自分の作業が正解と一致しているか」をリアルタイムで検証する力を与えます。これは単なる装飾ではなく、クリエイティブ作業における「品質保証（QA）」の民主化です。

## 81. Immediate Discoverability of Verification Tooling

高精度な編集ツールにおいて、検証用のサブツール（ガイド、透明度スライダー、グリッドなど）が「どこにあるかわからない」状態を排除し、必要な時に即座にアクセス可能にするパターンです。

### The Contextual Concealment Trap
- 設定やオプションを減らすために、特定の条件下（例：オーバーレイ表示中のみ）でしかツールを表示しない設計は、一見クリーンですが、ユーザーが「その機能が存在すること自体」を疑う原因となります。

### Implementation: Surface-Level Controls
1. **Persistent Visibility**: オーバーレイの「ON/OFF」ボタンのすぐ隣に、連動するツール（透明度スライダーなど）を常時配置するか、ONにした瞬間に視覚的に強調された状態で出現させます。
2. **Standardized Anchor Points**: 
   - テンプレート選択 → そのすぐ右側に透明度スライダー。
   - グリッド表示チェック → そのすぐ右側にグリッド幅設定。
   - ツールとその詳細設定は、視線の移動を最小限にするためにグループ化（Anchor-Group）して配置します。
3. **Explicit Labeling**: アイコンだけでなく、「透過度」「グリッド」などのテキストラベルを添えることで、初見のユーザーでも機能の場所を迷わず特定できるようにします。

**UX Benefit**: 検証ツールを探すという「メタ作業」の時間をゼロに近づけることで、ユーザーはクリエイティブな改善（テロップ位置の微調整など）に全神経を集中させることが可能になります。

## 82. Multi-Layered Visual Polish (High-Fidelity Typography)

視聴者の注意を引く「放送品質」のグラフィックを実現するため、単層のスタイル設定ではなく、複数の視覚効果を階層化（Layering）して提供するパターンです。

### The "Flatness" Problem
- 単純な `fill` と `stroke` だけでは、プロのデザイナーが作るような奥行き感やネオンの輝きを再現できず、生成されたコンテンツが「AI っぽい（または素人っぽい）」印象を与えてしまいます。

### Implementation: Atomic Style Composition
1. **Stroke Stacking**: 単一の境界線ではなく、色と太さが異なる複数の境界線を順に重ねることで、豊かな縁取りを形成します。
2. **Effect Orchestration**:
   - **Glow**: 重畳した `text-shadow` によるソフトな広がり。
   - **3D Depth**: 角度を固定したオフセットシャドウによる押し出し表現。
   - **Glow + 3D**: これらを組み合わせ、発光しつつ奥行きのある「リッチな」テキストを作成します。
3. **Preset-First Editing**: 複雑なパラメータ設定をユーザーに強いるのではなく、完成された「リッチなスタイル」をプリセットとして提供し、そこから微調整を行うフローを採用します。
4. **Stacking Sequence (Direct Sequence Stacking)**: 複数の境界線を重ねる際、自動ソートに頼らず、UI リストの順序をそのまま描画深度（Z-index）にマッピングします。**「リストの下にある項目ほど背面（外側）に配置される」** メンタルモデルを採用することで、ユーザーの操作意図を 100% 反映し、重なり順の調整を容易にします。

**UX Benefit**: ユーザーに「プロの筆づかい」をプリセットとして提供することで、誰でも瞬時かつ安定して高クオリティな映像作品を生み出せる環境を構築します。

## 83. Geometric Precision & Snapping (Magnetic Affordance)

自由度の高いキャンバスにおいて、ユーザーの「微妙なズレ」に対する不安を解消し、誰でも正確なレイアウトを達成するためのパターンです。

1. **Magnetic Snap Points**: キャンバス全体の中心 (Center X/Y) や、プロフェッショナルな余白（50px 程度のセーフエリア）を吸着点として定義。
2. **Threshold Sensitivity**: 要素が吸着点に 15px 以内に近づいた場合、座標を強制的に合わせる（Snap）ことで、目視では困難な「完全な中央」を保証します。
3. **Contextual Anchoring**: 「動画プレイスホルダー」など他の主要なレイヤーが存在する場合、その中心点に対しても吸着を有効化し、意図した配置への到達時間を短縮します。

**UX Benefit**: 「なんとなくズレている気がする」という認知的摩擦を排除し、職人芸的なピクセル調整なしでプロのクオリティを維持できます。

## 84. Professional-Grade Asset Export (Robust Download Handling)

ブラウザ上でのエクスポート（JSON 保存、PNG 書き出し）において、一部の環境や特定のブラウザ設定で「拡張子が消える」「ファイルが 0 byte になる」「保存先が開けない」といったサイレント・エラーを完全に防止するパターンです。

### The Native Race Condition
- `URL.createObjectURL` で生成した Blob URL を、`a.click()` 後の `URL.revokeObjectURL(url)` で即座に解放すると、OS のディスク書き込みが完了する前にリソースが消滅し、ファイルが破損することがあります。

### Implementation: Professional Export Stabilization
1. **FileSaver.js Integration**: ブラウザごとのダウンロード挙動（Anchor 生成、DOM 追加、click 発火、リソース解放タイミング）の差異をライブラリで抽象化し、プロレベルの安定性を確保します。
2. **Canvas-to-Blob Efficiency**: PNG 書き出しの際、`canvas.toDataURL`（メモリ消費大）を避け、`canvas.toBlob` を使用してメモリ効率と書き込み信頼性を最大化します。
3. **Delayed Resource Lifecycle**: 手動実装を行う場合は、`revokeObjectURL` の実行を 3,000ms (3秒) 程度遅延させる「セーフティ・マージン」を確保し、書き込みプロセスを保証します。

```tsx
// ✅ Recommended: FileSaver.js Pattern (JSON)
const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
saveAs(blob, `export-${Date.now()}.json`);

// ✅ Recommended: FileSaver.js + Canvas toBlob Pattern (PNG)
canvas.toBlob((blob) => {
    if (blob) {
        saveAs(blob, `image-${Date.now()}.png`);
    }
}, 'image/png');
```

**UX Benefit**: 制作したデザインを「確実に持ち出すことができる」という信頼感をユーザーに与え、プロフェッショナルなワークフローの一部としてツールの信頼性を絶対的なものにします。

### Diagnostic: Identifying Silent Browser Blocks
ライブラリを使用してもダウンロードが発生しない（Downloads フォルダにファイルが現れない）場合、コードの不備ではなく「ブラウザ側のサイレント・ブロック」を疑う必要があります。
1. **Interception Test**: `window.saveAs` をプロキシ（インターセプト）し、正しい Blob とファイル名で呼び出されているかをログ出力で確認。
2. **Security Context**: `127.0.0.1` や `localhost` では「複数ファイルの自動ダウンロード」がブラウザ設定で制限されているケースが多い。
3. **Incognito Verification**: 拡張機能の干渉を排除するため、シークレットモードでの動作確認を標準のデバッグフローに組み込みます。

### Evolution: File System Access API (Universal "Save As")
ブラウザの「自動ダウンロード」に頼らず、ユーザーが保存先を明示的に選択するプロフェッショナルな体験を提供します。
1. **Explicit Intent**: `window.showSaveFilePicker()` を使用。ユーザーのクリック後にダイアログが開くため、ブラウザの「自動ダウンロード・ブロック」の影響を受けません。
2. **Stream Writing**: 生成した Blob を一度にメモリへ展開するのではなく、`WritableStream` を介して直接ディスクへ書き込むことで、巨大なアセットの書き出し時の安定性が向上します。
3. **Graceful Fallback**: API 非対応ブラウザ（Safari等の一部）では既存の `saveAs` プロトコルへフォールバックするハイブリッド設計を採用します。

## 85. Context Inheritance Protocol (User Input Preservation)

ツール内で「デザインテンプレート」や「プリセット」を切り替える際、ユーザーが既に入力した「コンテンツ（テキスト、メタデータ）」を消失させず、新しいデザイン枠に自動的に再注入するパターンです。

### The Content Loss Trap
- テンプレート適用時にキャンバスを「初期化」してテンプレートのデフォルトテキスト（例：`[CAPTION] テロップエリア`）を表示してしまうと、ユーザーは「せっかく入力した内容が消えた」という強い不信感を抱きます。

### Implementation: Prop-Based Inheritance
1. **Source of Truth Priority**: `transcript` や `currentText` などのコンテンツ情報をプロパティとして常にコンポーネントへ渡し続けます。
2. **Auto-Injection Logic**: テンプレートの展開（レイヤー生成）ループ内で、プレースホルダー名を使用せず、渡し続けられているプロパティを優先的に `text` フィールドへ注入します。
3. **Ghost Placeholder Injection**: もし `transcript` が存在しない（新規作成時など）場合のみ、テンプレート側のデフォルト名（`layer.name`）をフォールバックとして使用します。

**UX Benefit**: デザインの試行錯誤（ガチャを回すようなテンプレート変更）を行っても、肝心のコンテンツが破壊されないため、ユーザーは安心してスタイリングに集中できます。

## 86. Personal Style Templates (Zustand Persistence Pattern)

ユーザーがカスタマイズした設定（色、フォント、座標など）を、プロジェクトやセッションを跨いで再利用できる「マイスタイル」として保存するパターンです。

### The "Disposable Design" Problem
- 優れたデザインを作成できても、ブラウザを閉じたり別のプロジェクトに移るとその設定がリセットされる場合、ユーザーは同じ作業（パラメータ調整）を何度も繰り返すことになり、ツールの「プロフェッショナル性」が損なわれます。

### Implementation: Federated Persistence
1. **Persistent Global Store**: Zustand の `persist` ミドルウェアを使用し、特定のステート（`templates` 配列など）を自動的に Web Storage (`localStorage` / `indexedDB`) に同期します。
2. **Context-Stripping Logic**: テンプレートとして保存する際、特定のインスタンスに依存する情報（ユニーク ID、具体的な台詞テキスト、個別動画への参照）のみを削除（Strip）し、スタイリングと配置のメタデータのみを保存します（Section 83 の Context Inheritance と連動）。
3. **Cross-Project Load**: 別のプロジェクトのデザイナーを開いた際にも、保存されたストアからテンプレートリストを読み込み、ワンクリックで以前の「自分の鉄板スタイル」を適用可能にします。

**UX Benefit**: ユーザーが自分だけの「デザインライブラリ」を構築できるため、ツールを使えば使うほど生産性が向上する「自分専用の魔法の杖」へと進化します。

## 87. Context-Aware Action Visibility (Identifier-Based Guard)

機能が特定のコンテキスト（例: `jobId`, `projectId`）に依存する場合、そのコンテキストが欠落している環境ではアクションボタン自体を非表示（または無効化）にするパターンです。

### The Dead-End Button Trap
- エディタを単体パーツとしてテストしたり、Deep Link で一部のパラメータのみを渡して起動したりする場合、バックエンドへの同期（Save/Apply）に必要な ID が欠けていることがあります。
- この状態で「保存」ボタンを表示し続けると、クリック時に 404 エラー（または ID 未定義エラー）が発生し、ユーザーはツールの「バグ」だと感じてしまいます。

### Implementation: Conditional Rendering
1. **Source of Trust Check**: アクションの実行に必須となる識別子（`jobId` 等）の存在をレンダリング条件に加えます。
   ```tsx
   {(jobId !== undefined) && (
       <button onClick={handleApply}>
           プロジェクトに適用
       </button>
   )}
   ```
2. **Standalone Mode Logic**: 識別子がない状態を「スタンドアロン（単独利用）モード」と定義し、ローカルエクスポート（JSON/PNG）やスタイル保存などの「ローカル完結型アクション」のみを優先表示します。

**UX Benefit**: ユーザーは現在の環境で「何ができるか」を視覚的に正しく把握でき、実行不可能な操作によるエラーに遭遇することがなくなるため、ツールの信頼性が向上します。

## 88. State-Preserving Template Switching (Incremental Update Pattern)

テンプレートを切り替える際、キャンバスを完全に初期化（Hard Reset）するのではなく、ユーザーが行った既存のカスタマイズ（座標の微調整、個別スタイルの上書き）を可能な限り保持しながら、新しいデザインテーマを適用するパターンです。

### The "Destructive Re-creation" Problem
- テンプレートにテキスト座標（x, y）が含まれている場合、単純な実装ではキャンバスをクリアして再配置します。
- これにより、ユーザーが「テンプレート選択前に苦労して調整した位置」が全てリセットされ、ユーザーに「やり直し」を強いることになります。

### Implementation: Incremental Merge
1.  **Attribute Filtering**: テンプレートから「どの属性を上書きし、どの属性を維持するか」を選択可能にします。（例：色とフォントのみを適用し、座標は維持する）。
2.  **State Backup**: テンプレート適用直前の状態を `undo` スタックに積むだけでなく、適用ロジック内で既存アイテムの特定プロパティを集約し、新レイヤーの初期値としてマージします。
3.  **Visual Anchor Persistence**: ユーザーが手動で動かしたレイヤーには `isManuallyPositioned` フラグを立て、テンプレート変更時にもその座標を優先する等のロジックを検討します。

**UX Benefit**: デザインの「着せ替え」を繰り返しても、ユーザーが既に行った価値ある作業（位置決め等）を破壊しないため、編集のフロー（没入感）を維持できます。


## 89. Success Visibility Pattern (Multi-Layer Feedback)

API リクエストが技術的に成功（HTTP 200）していても、UI 上のフィードバックが不十分な場合、ユーザーは「ボタンが反応しない」と誤認し、不必要な再試行を繰り返します（Pattern 38 の進化形）。

### The "Silent Success" Trap
- **Context**: デザイナーの「適用」ボタンなどの重要な同期的操作。
- **Problem**: `alert()` などのブラウザ標準機能のみに依存していると、ポップアップブロックや「一瞬の変化」の見逃しにより、ユーザー、あるいは検証サブエージェントが「失敗した」と判断してしまう（Observer Paradox）。

### Implementation: Professional-Grade Feedback
1. **Loading State**: ボタン内に `Spinner` を表示し、`disabled` 状態にすることで、「通信中であること」を物理的に示す。
2. **Persistence Message**: ブラウザ標準の `alert()` を避け、画面端に数秒間留まる **Toast UI** や、ボタンの色が一時的に緑色に変化する「Success バンパー」を採用する。
3. **Optimistic Store Update**: バックエンドへの保存が完了する前に、ローカルストアの `isSaved` フラグを立て、UI 全体を「保存済み」のデザイン（控えめな色調など）にシフトさせる。

**UX Benefit**: システムの「健康状態」が常にユーザーの視覚情報と一致し、ツールの確実性と信頼性を 120% に高めます。

## 90. Async Sink Protection Pattern (Callback Lifecycle Integrity)

プロパティとして渡された非同期関数（`onApply` 等）を `useCallback` 等の内部ハンドラで呼び出す際、その Promise を `await` していない（または `.catch()` がない）と、UI 側で成功・失敗の判定ができず、ローカルの `Loading` 状態が解除されない等のバグ（不可視のハングアップ）が発生します。

### Implementation: Unified Async Wrapper
1. **Awaiting External Callbacks**: 外部から渡された `onApply` が Promise を返す可能性がある場合、内部ハンドラでは必ず `await` し、その処理系のライフサイクル（開始〜終了）を取り込む。
2. **Diagnostic Echo**: ハンドラ内の各ステップ（Call / Success / Error）に明示的な `console.log` を計装（Instrumentation）し、技術的な不達（Observer Paradox）が発生した際に、どのレイヤーに原因があるかを即座に判別可能にする。

```tsx
// ❌ Dangerous: Sink (Fire-and-forget)
const handleApply = useCallback(() => {
    if (onApply) onApply(data); // Returns promise but nobody waits
}, [onApply]);

// ✅ Safe: Integrity-Guaranteed
const handleApply = useCallback(async () => {
    setLoading(true); // Pattern 87
    try {
        if (onApply) await onApply(data);
        showToast("Success");
    } catch (e) {
        handleError(e);
    } finally {
        setLoading(false);
    }
}, [onApply]);
```

**UX Benefit**: 非同期処理の「宙ぶらりん」状態を排除し、エラー発生時でも確実にユーザーへコントロールを返却できる強靭なインターフェースを提供します。

## 91. Contextual Return Pattern (Workflow Continuity)

「ツールの中のツール」（デザイナーや設定画面など）からメインワークフローへ戻る際、ユーザーの意図した「文脈」を維持したまま元の場所へ正確に復帰させるパターン。

### The \"Lost User\" Problem
- **Context**: 複雑なダッシュボードから、特定の要素（ショート動画等）を編集するためにデザイナー画面へ Deep Link で遷移する状況。
- **Problem**: 編集完了後、単にトップページや一覧に戻すだけでは、ユーザーは「どのジョブの、どの動画を編集していたか」を再度探し直す必要があり、リズムが分断される。

### Implementation: Sticky Navigation
1. **Return-to Parameter**: 遷移時の URL に `?returnTo=/path/to/origin` を付与し、子ツール側で遷移元（Stateful link）を保持する。
2. **Action-Triggered Exit**: 成功時（保存・適用完了）の副作用としてナビゲーションを発動させ、手動の「戻る」ボタンを押させる手間を省く。
3. **Manual Escape Hatch**: 保存を行わずに離脱したい場合（あるいは単に状態を確認しに来た場合）のために、常に視認可能な「戻る/キャンセル」ボタンをグローバルナビゲーションに配置する。
4. **Optimistic Transition**: 遷移先の画面に戻った際、最新の変更（適用されたテロップ等）が即座に反映された状態で表示されるよう、バックエンドの同期とキャッシュの無効化を保証する。


**UX Benefit**: ユーザーは「今何をしているか」という集中を切らすことなく、微調整と承認を高速に繰り返すことが可能になります。

## 90. Layered Hybrid Preview Pattern (High-Fidelity Contextual Playback)

動画再生中に、静的なデザインアセット（背景画像、装飾フレーム）と動的なテロップをリアルタイムに重ね合わせ、最終書き出し品質をシミュレートするパターン。

### 1. The "Visual Blind Spot" Problem
- **Problem**: 従来の動的プレビューは「動画＋テキスト」のみであり、装飾フレーム（OVERLAY）との重なりや、背景画像（BACKGROUND）との視覚的干渉（色のコントラスト等）を書き出し前に確認できない。これにより、レンダリング後にミスが発覚し、リテイクコストが発生する。

### 2. Implementation: Design-Aware Stack
1. **Z-Stack Composition**: プレビュープレイヤー内で、以下の層を正しい順序でスタック配置する。
    - **L1 (Bottom): BACKGROUND (PSD)**: デザインテンプレートに含まれる背景画像。
    - **L2: Video (Canvas/Clip)**: ソース動画。`VIDEO_PLACEHOLDER` レイヤーの座標とサイズに基づいてクリッピング・配置。
    - **L3: Dynamic Telops (React Overlay)**: `TelopDesigner` のスタイル（縁取り、ネオン、3D等）を完全再現。
    - **L4 (Top): OVERLAY (PSD)**: 装飾用のフレームやロゴパーツ。最前面に配置。

2. **Synchronized Update**: 動画のタイムコードに同期して L3 のテロップのみを更新しつつ、L1, L4 のデザイン層は常時維持する。
3. **Alpha-Aware Blending**: 各レイヤーの不透明度（Opacity）を個別に制御可能にし、デザインのガイド画像としての役割と、実際の最終コンポジットの確認を両立させる。

### 3. Audio Presence Pattern (Professional Review Standard)
- **Requirement**: プレビュープレイヤーにおいて、デフォルトで `muted` を避ける。
- **Rationale**: 多くのブラウザは `muted` 無しの自動再生をブロックするが、レビューツールにおいては「再生ボタンを押して開始」することが前提であるため、`muted` を外して音声を有効にすることが、最終的な映像の「リズム」や「音量」を確認するために必須となる。

**UX Benefit**: デザイナー側で調整したデザイン意図が、実際の動画（モーショングラフィックス）としてどう機能するかを「一歩も戻らずに」確認でき、120% のクオリティ保証を即時化できます。

## 91. Multi-layered Geometric Effects (Neon & 3D) Pattern

テロップなどのテキスト要素に対し、複数のシャドウ層を幾何学的に配置することで、GPU負荷の低い CSS/Canvas ベースでプロフェッショナルな視覚効果（ネオン発光、3D立体感）を実現するパターン。

### 1. Progressive Glow Layering (Neon)
単一のぼかしでは再現できない「芯のある発光」を、中心から外側に向けて不透明度とぼかし量を変えた多層構造で実現する。
- **Core Layer**: ぼかし小、不透明度高。視認性の核となる。
- **Outer Layers**: 強度(Intensity)に応じて 5〜20層 展開。ぼかし量を段階的に増やし、不透明度を 0.5〜0.1 程度に減衰させることで、柔らかな光の広がりをシミュレートする。

### 2. Angular Directional Stacking (3D)
指定された角度に向け、オフセットを 1px ずつずらした多数のシャドウをスタックすることで、パスの押し出し（Extrude）に近い立体感を表現する。
- **Depth Limit**: パフォーマンス維持のため最大 10〜15層 程度に制限する。
- **Lighting simulation**: 本体色と影色のコントラストを強めることで、奥行きを強調する。

### 3. Jitter-Free Extruded Stroke
太い縁取り（Stroke）を `text-shadow` で実現する場合、8方向（45度刻み）ではエッジが欠ける。これを **16方向（22.5度刻み）** に拡張することで、斜め線やカーブにおいてもジャギーのない滑らかな輪郭を実現する。

**UX Benefit**: 放送クオリティの高度なテロップデザインを、ブラウザ上での編集・プレビュー段階から正確に提供でき、クリエイターの表現の幅と「書き出し後の期待値」の不一致を解消します。

## 92. Dependency-Lite Shared Component Design (Self-Contained UI)

モノレポや共有ライブラリ環境において、コンポーネントが特定の外部ライブラリ（アイコン集、CSSフレームワーク等）に依存し、利用側プロジェクトでのバージョン矛盾や導入ハードルを引き起こす問題を回避するパターン。

### 1. Inline SVG Encapsulation
`lucide-react` や `fontawesome` 等の外部パッケージをインポートする代わりに、必要なアイコンを純粋な React コンポーネント（インライン SVG）としてファイル内にラップする。これにより、パッケージの `peerDependencies` を最小限に抑え、どんな環境でも「コピー＆ペースト」や「パッケージ参照」だけで即座に同等の見た目を再現できる。

### 2. Pure CSS/Style-Value Projection
Tailwind CSS や特定の CSS-in-JS ライブラリのランタイムに依存せず、標準の `React.CSSProperties` や計算済みのスタイル値をプロパティとして利用する。高度な計算（例: 16方向の縁取りシャドウ）はロジック層で完結させ、レンダリング層はプレーンな CSS に落とし込むことで、デザイントークンの整合性を保ちつつ依存を排除する。

### 3. Structural Type Affinity
厳格な外部型定義パッケージに依存しすぎるのではなく、コンポーネント内で必要最小限のインターフェース（例: `TelopItemForPreview`）を再定義または拡張する。これにより、データモデルの変更による破壊的影響をパッケージ境界で食い止め、型安全性を維持したまま柔軟な再利用を可能にする。

**UX Benefit**: 開発者は依存関係のトラブル（Module not found 等）に煩わされることなく、高品質な UI コンポーネントを迅速に導入でき、プロダクト全体の UI の一貫性と信頼性が向上します。

## 93. Context-Aware Content Constraints (Auto-Wrapping) Pattern

映像視聴やモバイル端末での閲覧など、特定のコンテキストにおいて情報の「一瞥性」を最大化するため、コンテンツ（テキスト等）に物理的な制約を課し、表示層で動的に最適化するパターン。

### 1. Hard-Limit Chunking Logic
「1画面に収まるべき適正量」を定義し、それを超える入力を拒否するのではなく、表示時に自動的にチャンク（断片）化する。
- **Video Subtitles**: 読了時間を考慮し、1行あたり 8〜12文字 程度を上限として自動改行する。
- **Data Flow**: オリジナルの改行（意図的な区切り）を尊重しつつ、各行に対して上限チェックをかける二段構えの処理を行う。

### 2. Layout-Synchronized Rendering
改行の挿入方法（`\n`）と CSS の描画設定（`whiteSpace: 'pre-line'`）を同期させ、動的に生成された改行がレイアウト崩れを起こさないよう制御する。テキストの中央揃え（TextAlign: center）等のスタイル設定と組み合わせることで、自動改行後も幾何学的なバランスが保たれるようにする。

### 3. Progressive Readability Guard
単なる文字数制限に留まらず、フォントサイズや表示領域の幅に基づいて「可読性スコア」を計算し、警告や自動調整を行う。

**UX Benefit**: クリエイターが文字数や改行位置を細かく気にすることなく、入力したテキストが常に「最も読みやすい形」で視聴者に提供されることを保証します。

## 94. Duality of Presentation Pattern (Modal vs. Inline)

単一の複雑な UI コンポーネント（例: レイヤードプレビュープレイヤー）を、文脈に応じて「フルスクリーンモーダル」と「ページ内埋め込み（インライン）」の両方で利用可能にするパターン。

### 1. Optional Trigger Guard
- **`onClose` Prop as Switch**: `onClose` 関数の有無によって、自身がモーダル（オーバーレイあり）として振る舞うか、インライン要素（埋め込み）として振る舞うかを決定する。
- **Conditional Layout**: モーダル時は `fixed inset-0` で全画面を覆い、インライン時は `w-full h-full` で親コンテナに従う。

### 2. Header & Overlay Abstraction
- モーダルのヘッダーや背景オーバーレイを条件付きレンダリングにし、メインの描画ロジック（プレビュー本体）を共通化（Abstracted Preview Content）することで、コードの重複を避けつつ高度な再利用性を確保する。

**UX Benefit**: 同じリッチなプレビュー体験を、ある時は集中作業（デザイナーからのポップアップ）、ある時は比較作業（レビューページの一覧横）といった最適な形態で提供できます。

## 95. State-Reset Reactive Key Pattern

React コンポーネントにおいて、親から渡される ID 等のプロパティが変更された際、内部の複雑な状態（再生時間、エラー表示、読み込み完了フラグ）を強制的に初期状態へリセットするためのパターン。

### 1. Functional Reset via `key`
- コンポーネントの呼び出し側で、重要な変数の組み合わせ（例: `videoId` と `templateId`）を `key` 属性として渡す。
- **Mechanism**: React の `key` が変更されると、ブラウザ上の DOM だけでなくコンポーネントインスタンス自体が破棄され再生成されるため、`useState` や `useEffect`、動画の `currentTime` 等が確実に初期値に戻る。

```tsx
// 📂 apps/dashboard/src/app/short-reviewer/page.tsx
<LayeredPreviewPlayer
    key={`${currentShort?.video_id}-${selectedTemplateId}`} // 選択が変わるたびに完全にリセット
    videoUrl={videoUrl}
    ...
/>
```

### 2. Consistency Guard
- マニュアルでの `useEffect` による状態リセット漏れ（Zombie State）を防ぎ、常に選択したデータと正確に一致した UI 状態を保証する。


**UX Benefit**: テンプレートや動画を切り替えた際に、前の動画の「エラーメッセージ」が残ったり、「再生位置」が引き継がれたりすることを防ぎ、常に新鮮で正確なプレビュー結果を提供します。

## 154. Technical Debt Inoculation (Bridges-to-Workstation)

When evolving a high-fidelity tool from a "Lightweight Preview" (e.g., a Modal) to a "Dedicated Workstation" (e.g., a Full Page), maintaining both paths creates a "Ghost UX" that increases maintenance debt and confuses the user's mental model.

### Pattern: Immediate Artifact Liquidation
Once the specialized workstation (`/workstation-page`) achieves feature parity with the legacy interface (`ReviewModal`), follow a strict cleanup protocol:

1. **Aggressive Deletion**: Remove all legacy entry points (modals, hooks, sub-components) immediately. Do not keep them "just in case" or as "alternative views" unless there is a distinct, documented use case for俯瞰 (Bird's-eye view).
2. **Path Redirection (The Bridge)**: Replace the legacy trigger with a direct URL redirection using context parameters (`?id=XXX`).
3. **ID Ref Guard (Single Injection)**: Use a `useRef` guard (Pattern 152) when reading URL parameters to ensure the state is only initialized once upon mount, preventing the "Locked State" bug where the user cannot manually switch items after a parameter-based entry.
4. **Identifier Scoping**: Ensure that specialized hooks created for the legacy view (e.g., `useReviewShorts`) are either integrated into the workstation or deleted if the workstation has a more robust implementation (e.g., `short-reviewer/page.tsx`).
5. **Labeling Shift**: Change UI labels from "Details" (passive) to "⚡ Review" or "⚡ Workstation" (active) to psychologically transition the user to a professional production mindset.

**UX Benefit**: Ensures the workspace remains clean, prevents "Click Anxiety" (not knowing which review path is the most up-to-date), and reduces the bundle size by eliminating hundreds of lines of redundant UI logic.

## 96. Redundant Entry Point Elimination (Feature Contextualization)

特定の機能（例: PSD インポート）がその「永住先」（例: テロップデザイナー）に完全に統合された後、ルートダッシュボードなどの上位階層から重複するショートカットを意図的に削除するパターン。

### 1. Contextual Home First
- 機能は、それが最も頻繁に使われる、または最も関連性の高いコンテキスト内に配置されるべきである。
- **Action**: テロップデザイナー内にインポート機能が備わったなら、メインダッシュボードのトップレベルからはそのボタンを削除する。

### 2. Dashboard Cognitive Load Reduction
- ダッシュボードにボタンが多すぎると「何から始めればよいか」の迷いが生じる。
- **Principle**: 「入口」を絞ることで、ユーザーの導線を「プロジェクト選択 → 専門スタジオへの移動」という自然なフローに誘導する。

**UX Benefit**: インターフェースのノイズを減らし、各画面の役割（管理 vs 制作）を明確にすることで、迷いのないスムーズなツール運用を可能にします。

## 97. Hybrid Path Sanitization Pattern (Local vs. Web)

バックエンド（FFmpeg/Python）が管理する「物理ファイルパス」と、ブラウザ（React/Next.js）が要求する「HTTP URL」の乖離を吸収し、プレビューの可用性を担保するパターン。

### 1. Backend Source of Truth vs. Browser Reality
- **Local Path Pitfall**: バックエンドのデータベースに `/Volumes/Storage/project/asset.png` といった絶対パスが保存されている場合、ブラウザがそのまま `src` に指定すると 404 エラー（または不適切なオリジン結合）が発生する。
- **Remedy**: クライアント側、あるいは API レスポンスの直前で、絶対パスを「API ベース URL + 相対パス」に変換する正規化ロジック（Normalization Logic）を挟む。

### 2. URL Normalization Strategy
- **Client-Side Proxy**: `URL.createObjectURL` や `Public` フォルダ経由での解決が難しい動的アセットの場合、`${API_BASE}/assets?path=${encodeURIComponent(localPath)}` のようなプロキシ形式で常に一定のアクセス性を確保する。
- **Regex Re-routing**: 絶対パスの一部（例: `/templates/` 以降）を抽出し、対応するスタティック配信エンドポイントへマッピングする。

```tsx
// 📂 apps/dashboard/src/app/short-reviewer/page.tsx
let assetUrl = l.asset_path;
if (assetUrl && assetUrl.includes('/templates/')) {
    const match = assetUrl.match(/\/templates\/(.+)$/);
    if (match) {
        // ローカル絶対パスをバックエンド配信 URL に変換
        assetUrl = `${API_BASE}/template-assets/${match[1]}`;
    }
}
```


**UX Benefit**: ローカルの処理環境（絶対パス）と Web プレビュー環境（HTTP）の差異を隠蔽し、クリエイターが「ファイルが見つからない」というシステムエラーに直面することを防ぎます。

## 98. Static Asset CORS Guard Pattern (Static vs. Middleware)

複数のオリジン（例: frontend:3000, backend:8000）が混在するハイブリッド環境において、API エンドポイントだけでなく「静的ファイル（Static Assets）」に対しても確実に CORS ヘッダーを適用し、プレビュー不全を防ぐパターン。

### 1. The Static/Middleware Conflict
- **Vulnerability**: 汎用的な CORS ミドルウェアを適用していても、一部のフレームワーク（例: FastAPI の `StaticFiles`）はルーティングのより深い層で処理されるため、ミドルウェアが付与する `Access-Control-Allow-Origin` を無視、または `OPTIONS` プリフライトに対して `405 Method Not Allowed` を返すことがある。
- **Symptom**: 画像や動画の URL は正しい（Pattern 97 適用済）が、ブラウザのコンソールには「CORS policy blocking」が表示される。

### 2. Guard Strategies
- **Explicit Static Header**: 静的ファイル配信を担当するコンポーネントや関数をサブクラス化し、全てのレスポンスに強制的に CORS ヘッダーを埋め込む。
- **Middleware Injection**: FastAPI 等のフレームワークでは、`CORSMiddleware` よりも上位（あるいは `StaticFiles` マウント後）で動作するカスタムミドルウェアを実装し、全ての `Response` オブジェクトに対して手動で `Access-Control-Allow-Origin` を注入する。

```python
# 📂 backend/api.py
class StaticFilesCORSMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        origin = request.headers.get("origin")
        if origin in ALLOWED_ORIGINS:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
        return response
```

**UX Benefit**: セキュリティを維持しつつ、編集スタジオやレビュー画面において外部サーバー上のアセットが「確実に表示される」信頼性を提供します。

## 99. Fault-Isolated Layered Preview Pattern

複数の動的レイヤー（背景、ビデオ、テロップ等）が合成されるプレビューにおいて、特定レイヤーの読み込み不全（404, デコードエラー等）が、他の健全なレイヤーの視認性やシステム全体の操作性を毀損させないためのデザインパターン。

### 1. Partial Failure visibility
- **Transparency over Obscuration**: ビデオレイヤーの読み込みに失敗した際、エラー表示（「動画の読み込みに失敗しました」等）に不透明な背景色（例: `bg-zinc-900`）を適用しない。
- **Context Preservation**: 特定のメディアが欠落しても、背後のデザインテンプレートや前面の装飾フレームが正しく表示され続けることで、ユーザーは「システム全体の故障」ではなく「特定素材の不足」であることを直感的に理解できる。

### 2. Granular z-index Controls
- **Error UI Placement**: エラー通知は対象レイヤーの z-index 範囲内に収めるか、あるいはプレビュー領域全体の最前面ではなく「該当メディアの代理」として配置する。
- **Fallback States**: 素材が欠落している場合でも、そのプレースホルダーの境界（バウンディングボックス）を表示し続けることで、レイアウト確認を中断させない。


**UX Benefit**: 複雑な合成プレビューにおけるトラブルシューティングを容易にし、「何か一つがダメでも全体は生きている」という心理적安全性と効率的なレビュー環境を提供します。

## 100. Draft-Priority Artifact Resolution Pattern

プロフェッショナルな制作パイプラインにおいて、高品質な「最終成果物」と、高速なフィードバックのための「ドラフト/プレビュー版」が混在する場合、フロントエンド側で動的に最適なソースを選択し、UI の空文化（動画が見られない状態）を防ぐパターン。

### 1. The Multi-Tier Artifact Reality
- **Final Artifact**: 承認後に生成される、最高品質だが重い（または生成されていない）ファイル。
- **Draft Artifact**: 処理過程で自動生成される、プレビューに適した軽量なファイル。
- **UI Challenge**: 単純に「承認済みでないなら動画を表示しない」というロジックでは、レビュー作業（Approve/Reject の判断）そのものが不可能になる。

### 2. Resolution logic
- **Draft-by-Default**: 明示的に `APPROVED`（承認済み）ステータスでない限り、常に `_draft` サフィックスを持つファイルを要求する。
- **Transparent Suffixing**: `video_id` に基づいて URL を構築する際、ステータスに応じてサフィックスを動的に付与し、物理ファイル名との整合性を保つ。

```tsx
const videoUrl = useMemo(() => {
    if (!currentShort) return null;
    // Approve 済みのみ final を使い、それ以外（DRAFT, REJECTED, etc.）は draft を参照
    const suffix = currentShort.status === 'APPROVED' ? '' : '_draft';
    return `${API_BASE}/shorts/${currentShort.video_id}${suffix}.mp4`;
}, [currentShort]);
```

**UX Benefit**: ワークフローのどの段階においても、クリエイターは「今、判断すべき動画」を即座に目にすることができ、システムが提供する成果物の進捗をリアルタイムに追跡できます。

## 101. Temporal Offset Synchronization Pattern

長尺のソース動画から切り出された特定の「セグメント（ショート動画等）」をプレビューする際、ソース依存の絶対タイムスタンプと、プレイヤーの相対再生時間の不一致を解消し、メタデータ（テロップ等）の同期を保証するパターン。

### 1. The Timestamp Discrepancy
- **Absolute Source Time**: 動画の解析データや字幕データが保持している、0:00 からの経過時間（例: 124.69s）。
- **Segment Relative Time**: 切り出された 10 秒の動画ファイルをプレイヤーで再生した際の経過時間（常に 0s から開始）。
- **The Failure**: プレイヤーの `currentTime` （0-10s）とメタデータのタイムスタンプ（124-134s）を直接比較すると、同期が一切機能しなくなる。

### 2. Guard Strategy: Narrative Offset Injection
- **Offset Application**: 各セグメントの「開始時間（Start Time）」をメタデータとして保持し、プレイヤーの現在時間に加算してから判定を行う。
- **Formula**: `effectiveTime = player.currentTime + segment.startTime`
- **Dynamic Calculation**: `useMemo` 等で、現在の動画セグメントに紐づく開始オフセットを注入し、既存の同期コンポーネントをそのまま再利用可能にする。

**UX Benefit**: 動画がどのタイミングで切り出されたものであっても、正確な位置にテロップが表示され、レンダリング結果（FFmpeg 成果物）とプレビュー画面の完全な一致を提供します。

## 102. Aspect Ratio Integrity Pattern (Crop vs. Scale)

異なるアスペクト比を持つメディア（例: 16:9 ランドスケープ動画）を、特定のアスペクト比のテンプレート（例: 9:16 ポートレート）内に合成する際、視覚的な没入感を最大限に高めるためのスケーリング・クリッピング戦略。

### 1. The "Letterbox" Barrier
- **Issue**: ランドスケープ動画を 9:16 の枠内に「収まるように（Contain）」配置すると、上下に大きな余白（レターボックス）が生じ、プレビューの迫力が失われる。
- **Context Loss**: 背景 PSD テンプレートと動画の間に隙間ができ、あたかも「別のウィンドウ」を見ているような断絶感が発生する。

### 2. Optimal Layout Strategy
- **Cover & Center**: `object-fit: cover` を基本とし、動画の中心（または AI が判定した重要領域）がポートレート枠を満たすように配置する。
- **Safety Zones**: テンプレートのオーバーレイ（装飾フレーム）がある場合、動画の端が隠れても「デザインの一部」として成立するよう、マージンを設定。

### 3. Container-to-Content Synchronization (The Toggle Bug)
- **Issue**: プレビューエリアの親コンテナに `aspect-[9/16]` 等の特定のアスペクト比がハードコードされている場合、テンプレートを解除して 16:9 のソース動画を単体で表示しようとすると、狭い縦長フレームの中に横長動画が押し込まれ、極端にサイズが縮小される（表示崩れ）。
- **Solution**: 
    - **Dynamic Utility**: `aspect-[9/16]` ユーティリティを、テンプレートの有無（`selectedTemplate ? 'aspect-[9/16]' : 'aspect-video'`）に応じて動的に切り替える。
    - **Flexible Framing**: 親コンテナから厳格なアスペクト比制約を排除し、内部のアセット（LayeredPreviewPlayer または video 要素）が持つアスペクト比を透過的に尊重する設計を徹底する。

**UX Benefit**: 制作モード（テンプレート重畳）と素材確認モード（動画単体）を往復しても、常に動画が利用可能な領域を最大限に活用して表示され、視覚的なストレスや「崩れ」の印象を排除できます。

## 103. Reviewability Passthrough Pattern (Placeholder Bypass)

デザインテンプレート内の「プレースホルダー（挿入枠）」が、レビュー対象の主要コンテンツの本質的な視認性を制限してしまう場合、テンプレートの幾何学的制約を一時的にバイパスし、全体像の確認を優先するパターン。

### 1. The Placeholder Constraint
- **Issue**: PSD テンプレート上の `VIDEO_PLACEHOLDER` がデザイン上の都合で小さく設定されている場合、9:16 のフルサイズ動画をそこに流し込むと、詳細が確認できないほど縮小されてしまう。
- **UX Threshold**: クリエイターにとって「最終的なテロップの乗り」や「表情の微細な変化」を確認できないプレビューは、レビューツールとしての機能を果たさない。

### 2. Strategy: Context vs. Content
- **Template Context (Normal)**: 背景 PSD の枠内に動画が収まっている状態。デザインの調和を確認するのに適している。
- **Review Content (Active)**: 動画そのものを重視する状態。枠を無視してでも全体を大きく表示する、あるいは「枠そのものをキャンバス全域に広げる」挙動。
- **Solution**: 
    - 9:16 のショート動画をレビューする画面においては、`VIDEO_PLACEHOLDER` の座標設定を無視し、キャンバス全域（Background レイヤーを覆う形）で動画を表示するオプション、またはデフォルト挙動を採用する。
    - デザイン枠（Overlay）は最前面に維持しつつ、動画のクロップを最小限に抑える `object-fit` 設定の動的切り替え。

**UX Benefit**: 「デザインとしての美しさ」と「レビューに必要な情報量」のトレードオフを解消し、クリエイターが自信を持って Approve/Reject を判断できる環境を提供します。

## 104. Vertical Integrity Scaling Pattern (Dynamic Max-Height)

ポートレート（9:16）動画をランドスケープ（16:9）主体のダッシュボードでプレビューする際、UI レアウトの高さ制限や他の UI 要素との競合によってコンテンツの上下が欠損（クリッピング）するのを防ぐパターン。

### 1. The Dashboard Height Trap
- **Issue**: `h-[70vh]` のような固定の高さを `aspect-[9/16]` と組み合わせて使用すると、フレックスコンテナ内等で高さが「優先」され、幅が計算される。しかし、同じコンテナ内にプレイヤーコントロール等の他の要素が含まれる場合、ブラウザはコンテナ全体をビューポートに収めるためにプレビューエリアを「圧縮」し、結果としてアスペクト比が崩れるか、コンテンツの下部が切れてしまう。
- **Observation**: 多くのデザイナーは「画面に収まるサイズ」を優先して `vh` で高さを固定しがちだが、ビデオレビュワーにとっては「1px も欠けない全体像」が機能上の最低要件である。

### 2. Strategy: Constraint-Based Aspect Integrity
- **Flexible Max-Height**: 固定の高さ (`h-[...]`) ではなく、ビューポートの空きスペース（Total Height - Controls Height）を考慮した動的な最大高さ (`max-h-[calc(100vh-Offset)]`) を使用する。
- **Width Auto-scaling**: コンテナを `w-auto mx-auto` に設定し、`aspect-[9/16]` が動的な高さに基づいて正しい幅を決定できるようにする。
- **Containment Standard**: 
    - レビューモードにおいては、常に `object-fit: contain` 同等の挙動を維持し、上下左右の余白（Letterboxing/Pillarboxing）を許容してでも、コンテンツの全域を 100% 露出させる。

### 3. Strategy: Centered Viewport Orchestration
- **Problem**: `w-auto mx-auto` だけでは、アスペクト比を持つ絶対配置要素やスケールされたキャンバスが、親フレックスコンテナ内で期待通りに中央寄せされない場合がある。
- **Fixed Parent Flex**: 親コンテナに `flex items-center justify-center` を追加。
- **Direct Height Assignment**: `max-h` による制約よりも、`h-[calc(100vh-320px)]` のように高さを明示的に指定しつつ `aspect-[9/16]` を使うことで、ブラウザのアスペクト比計算がより安定し、利用可能な縦方向のスペースを最大化できる。この 320px という数値は、ヘッダー、ジョブ選択リスト、およびビデオプレイヤー自身のコントロールバーを考慮した「安全圏（Clearance）」として検証・決定されたものである。

**UX Benefit**: ユーザーがスクロールすることなく、ショート動画の最上部から最下部（字幕エリア）までを一目で、かつ歪みなく確認できる、情報の完全性と「画面中央に堂々と表示される」安定感を保証したワークフローを実現します。

## 105. Source Integrity Audit Pattern (Media Profile Validation)

UI 上の表示不具合（アスペクト比の歪み、黒帯、解像度不足）をデバッグする際、UI コード（CSS, Canvas スケーリング）を疑う前に、実際の供給ソース（Media File）のメタデータが期待通りであるかを検証するパターン。

### 1. The Rendering Blind Spot
- **Issue**: フロントエンドが 9:16 用に完璧に調整されていても、バックエンドパイプラインが 16:9 の動画を生成し、メタデータ上も 16:9 である場合、UI 側では「正しいが、期待とは異なる（歪んで見える）」表示が発生する。
- **Observation**: 多くの開発者はプレビューを見て「CSS の object-fit が壊れている」と判断しがちだが、実際には「ソースそのものが間違っている」ことが多々ある。

### 2. Strategy: Cross-Layer Verification
- **Technical Audit**: UI の表示ロジックを修正する前に、`ffprobe` や OS の情報パネルを用いて、サーバー上の動画ファイルの物理解像度を確認する。
  - `Expected`: 1080x1920 (9:16)
  - `Actual`: 1920x1080 (16:9)
- **Boundary Clarification**: この検証により、問題が「情報の提示（UI）」にあるのか「情報の生成（Pipeline/Engine）」にあるのかを明確に切り分ける。

**UX Benefit**: UI 側での場当たり的なパッチ（歪んだソースを無理やり引き延ばす等）を避け、システム全体のデータ整合性を保つことで、最終的にエンドユーザーへ正しい品質の成果物を届けることができます。

## 106. Contextual Content Integrity Pattern (Placeholder-Safety)

デザインテンプレート（背景 PSD 等）内の特定の枠（Placeholder）に動画を流し込む際、ソース素材のアスペクト比を維持しながら、1px も欠損させることなく枠内に収めるパターン。

### 1. The Composition Priority
- **Requirement**: クリエイターが「この背景デザインに対して動画がどう見えるか」を確認する場合、動画を全画面表示する（Pattern 103 のバイパス）よりも、指定された座標（Placeholder）に正確に配置することが優先される。
- **Constraint**: 縦型テンプレート（9:16）に対して、ソース動画が横型（16:9）である場合、単純な `object-fit: cover` では動画の左右が大幅に失われ、レビューの精度が著しく低下する。

### 2. Strategy: Non-Destructive In-Situ Review
- **In-Situ Placement**: `VIDEO_PLACEHOLDER` 層の `x, y, width, height` を厳密に使用し、動画をレイアウト上の「正しい位置」に配置する。
- **Visual Safety (Contain)**: `object-fit: contain` を適用する。
    - **Effect**: 16:9 動画を 9:16 の幅基準で配置した場合、アスペクト比が合わない枠内でも `contain` により全領域が露出する。
    - **Insight**: 多くの Web プレイヤーはデコレーションとして `cover` を使うが、レビューワーカー（評価者）にとっては「左右 10px のクロップ」が判断を狂わせる（例：端にある重要なテロップが見えない）ため、UI の一貫性よりもコンテンツの完全性を死守すべきである。

**UX Benefit**: デザイン意図（コンテクスト）と素材全体（コンテンツ）の両方を同時に評価でき、生成パイプラインの微細なミスや構図の違和感を早期に発見できるワークベンチを実現します。

## 107. Parent-Relative Responsive Scaling Pattern (Fluid Workbench)

プレビューコンポーネントがダッシュボードや複雑なレイアウトの「子」として配置される際、ブラウザのウィンドウサイズ（Viewport）ではなく、直接の親要素の利用可能領域に基づいて自身のスケーリングを決定するパターン。

### 1. The Viewport Scaling Fallacy
- **Issue**: `window.innerHeight` 等を基準に `scale` を計算するコンポーネントは、サイドバーやヘッダーを持つ複雑な UI 内に配置されると、親の制約（Padding, Flex-grow, Max-height）を無視して自身のサイズを決定してしまう。
- **Observation**: テンプレートを切り替えた際、親コンテナのアスペクト比変更とコンポーネント自身のスケーリング計算が「ズレ（Desync）」を起こし、表示が極端に縮小されたり（Display Collapse）、コンテナを突き破ったりする表示崩れが発生する。

### 2. Strategy: Observer-Based Self-Centering
- **ResizeObserver Utility**: コンポーネント内で `window: resize` イベントを監視する代わりに、`ResizeObserver` を使用して `containerRef.current.parentElement` の物理サイズ（Rect）を監視する。
- **Fluid Adaptation**: 
    - 1. 親要素の `getBoundingClientRect()` から現在の幅・高さを取得。
    - 2. キャンバスの元のサイズ（例: 1080x1920）が、その領域に収まるための最大倍率（Math.min(scaleH, scaleW)）を計算。
    - 3. 親要素のリサイズ（サイドバーの開閉、パネル展開等）に連動して即座にスケールを再計算。
- **Effect**: ウィンドウの縮小だけでなく、UI パーツの動的な変形に対しても「常に親要素の中で最大のサイズ（かつアスペクト比維持）」を保つ、堅牢なフィット感を提供。

### 3. Implementation Caveat: The Zero-Height Start
- **Problem**: コンポーネントの初期マウント時、親要素が `flex` や動的な `max-h` を持っている場合、`ResizeObserver` の初回の呼び出しで親要素の高さが `0` または最小値で返されることがある。これが原因でプレビューが極端に縮小された状態で固定されるバグが発生。
- **Resolution Strategy**: 
    - **Fallback Dimension (Pre-warming)**: 親要素のサイズがまだ取得できない初期状態では、`window.innerHeight/innerWidth` をベースに推定サイズを算出し、プレビューが「見えない・小さすぎる」状態を回避する。
    - **Explicit Wrapper Ref**: `parentElement` に依存せず、コンポーネント自身が管理する最外殻の `div` に `ref` を付け、それを `ResizeObserver` で直接監視する。
    - **Settling Delay (Timeout)**: CSS (Tailwind 等) の適用やレイアウトの確定には微細なラグが生じるため、`setTimeout(updateScale, 50)` 等で初回計算をわずかに遅延させ、安定した値をキャプチャする。
    - **Trigger Multiplexing**: `ResizeObserver` だけでなく、監視対象（キャンバスアセットの変更、テンプレートのID切替等）を `useEffect` の依存配列に含め、状態変化時に明示的に再計算を強制する。

**UX Benefit**: ユーザーがダッシュボードのレイアウトを変更したりテンプレートを頻繁に切り替えたりしても、プレビュー画面が常に最適な大きさで安定して表示され、「ツールの壊れ」を感じさせない高い信頼性を維持します。

## 108. Independent Style-Layout Decomposition Pattern (Multi-Template Orchestration)

AI 動画生成やコンテンツ編集ツールにおいて、全体の「レイアウト構造（デザイン枠・アスペクト比）」と「個別の要素スタイル（テロップ・装飾）」を独立させて管理・適用するパターン。

### 1. The Monolithic Template Trap
- **Issue**: デザイン（背景・ロゴ位置）とスタイル（文字色・フォント）を単一の「テンプレート」としてハードコードすると、一部（例：テロップの視認性）だけを調整したい場合でも、動画の再生成や全体のレイアウト変更が必要になり、レビューの柔軟性が失われる。
- **Observation**: ユーザーは「この枠（Design）はいいけど、このテロップのフォント（Style）だけ別のパターンで見たい」という非破壊的な試行錯誤を求める。

### 2. Strategy: Orthogonal Coordination
- **Decomposition**: 
    - **Layout Template (Physical)**: キャンバスサイズ、動画プレースホルダーの座標、不変の背景/オーバーレイアセットを定義。
    - **Style Template (Semantic)**: フォントファミリー、グラデーション、シャドウ、エフェクト（ネオングロー等）のセットを、コンテンツ（テキスト）に動的に注入する。
- **Independent Selectors**: レビュー画面において、それぞれのテンプレートを独立して選択できる dual-dropdown UI を提供。
- **Real-time Injection**: クライアントサイド（TelopStore 等）に保持されたスタイル定義を、レンダラー（LayeredPreviewPlayer 等）が動的にテロップ要素へ適用。

**UX Benefit**: クリエイターは「デザインの整合性（枠）」と「ブランドの一貫性（スタイル）」を個別に検証でき、最小限の手間で最適なバリエーションを Approve できる。また、モード切替（テンプレートなし含む）時のアスペクト比同期と組み合わせることで、あらゆる確認ワークフローに対応する万能なワークベンチを実現します。

## 109. Material-Mold Decoupling Pattern (State-vs-Instance Separation)

複雑なエディタ（デザイナー）と、その成果物を確認するレビュアー（一覧画面）を併設する場合、グローバルな「単一ステート」と個別アイテムの「永続データ」を混同することで、表示が意図せず上書きされる問題を回避するパターン。

### 1. The "Ghost Edit" Trap
- **Issue**: レビュアーコンポーネントが、デザイナー用のグローバルストア（例: `useTelopStore().telops`）を直接参照している場合、ユーザーがデザイナーで何かを編集した瞬間に、レビュアー内の全てのプレビューがその未保存の編集内容で書き換わってしまう。
- **Risk**: 承認作業中に、全く関係のないデザイン変更がプレビューに混線し、誤った意思決定を誘発する。

### 2. Strategy: Material vs. Mold
- **Material (Domain Data)**: 各アイテム固有の「コンテンツ内容（テキスト、タイミング）」。これは常にバックエンドまたは個別アイテムの `Props` から供給され、グローバルストアには依存しない。
- **Mold (Style Template)**: 共通の「見た目（色、フォント、装飾）」。これは共有ストアから取得してよいが、マージは純粋関数的に行い、永続化されたコンテンツを破壊しないようにする。

### 3. Implementation: Props-Driven Preview
- レビュアー内のプレビューコンポーネントは、ストアから自律的にデータを取得するのではなく、**「親から渡された props」のみを信じる完全なピュア・コンポーネント (Presentational)** として設計する。

**UX Benefit**: デザイナーでの自由な試行錯誤と、レビュアーでの厳格な評価を完全に独立させ、作業のコンテクストが予期せぬ形で「汚染」されることを防ぎます。

### 4. The Live-Loop Fallback Strategy
- **Issue**: 完全な隔離は安全だが、開発効率を下げることがある（例：デザイナーで修正した内容を、一度「保存」しないとレビュアーでプレビューできない）。
- **Pattern**: 
    - プレビューコンポーネントにおいて、「永続データ（Material）」が空、あるいは特定の「Live Mode」が有効な場合にのみ、グローバルストアを購読する。
    - これにより、**Stable Mode** (保存済みデータの共有) と **Live Mode** (デザイナーからの即時反映) をスイッチングでき、デザインのブラッシュアップから最終検品までをノンストップで実施できる。

### 5. Type-Safe Data Contracts
- **Issue**: 外部ソース（DBやAPI）から取得した「永続データ」は、しばしば緩い型（`string` 等）で定義されがちだが、UIコンポーネントが内部で厳格なリテラル型（例: `type: 'solid' | 'linear'`）を求めている場合、実行時エラーや表示不全の原因となる。
- **Solution**: 
    - 統合層（Reviewer 等）において、外部データをコンポーネントの期待する型へ厳密にマッピング（Casting/Strict Interface Alignment）する。
    - **Outcome**: 複雑な装飾データ（グラデーション、シャドウ等）を別レイヤーから注入しても、ビルドレベルで表示の整合性が保証される。

## Pattern 110: Temporal Segment Projection (Temporal Filtering)

**Issue**: タイムラインベースのデータ（テロップ、字幕、エフェクト）を時間軸を持つメディア（動画、音声）に合成する際、全データを一括でコンポーネントに渡すと、全ての要素が同時に表示（オーバーラップ）されてしまう。

**Solution**:
1.  **Temporal Desync Rule**: コンポーネントは「全データ」を Props として受け取るが、内部状態として「現在の再生時間 (`currentTime`)」を常に監視する。
2.  **State Projection**: レンダリングループ、あるいは `useMemo` 内で、`currentTime` が `[start, end]` の範囲内に含まれる要素のみをフィルタリングして抽出（Projection）する。
3.  **Cross-Fade Logic**: 投影された要素が切り替わる際、単純な Boolean 切り替えではなく、エッジ（開始点・終了点）での不透明度操作（Fade-in/out）を、データの `start/end` プロパティに基づいて自動計算する。
4.  **Content-Style Decoupling**: プレビュー時には、「スタイル情報を含むマスタデータ（Mold）」と「タイミングとテキストのみのタイムラインデータ（Temporal Material）」を別々に供給し、レンダラー内で動的にマージする。これにより、スタイルの変更を全タイムラインセグメントに即座に反映できる。

**UX Benefit**: 編集者は「いつ何が表示されるか」を意識することなく、データのリスト（Material）を流し込むだけで、システムが自動的に時間軸に沿った正しいプレビューを生成します。

**Verification**: このパターンの有効性は、「Autonomous Feedback Loop (FBL)」における **Phase 9: Temporal Fidelity Audit** を通じて継続的に監視されます。



## Pattern 111: Absolute-to-Relative Temporal Mapping (Offset Calibration)

**Issue**: ソースメディアから特定の区間を抽出して動画（ショート、ハイライト）を生成する場合、UI の「再生時間 (`currentTime`)」は必ず 0秒 から始まる。しかし、AI 解析データ（文字起こし、タイムライン）は「ソースメディア全体における絶対時間」で記録されている。この「時間の基点（Origin）」の不一致により、再生時間に応じた動的 UI（テロップ切り替え等）が正しく動作しない。

**Solution**:
1.  **Lead-Segment Anchoring**: タイムラインデータの最初の要素の開始時間 (`segments[0].start`) を「時間オフセット (`timeOffset`)」として定義する。
2.  **Origin Calibration**: 検索対象の絶対時間を `absoluteTime = currentTime + timeOffset` として動的に計算する。
3.  **Dynamic Projection**: 計算された `absoluteTime` をキーにしてタイムラインデータを検索し、表示すべき要素（テキスト等）を抽出する。

**Code Pattern (React/useMemo)**:
```tsx
const activeText = useMemo(() => {
    if (!timeline?.length) return null;
    const offset = timeline[0].start;
    const searchTarget = currentTime + offset;
    return timeline.find(seg => searchTarget >= seg.start && searchTarget < seg.end)?.text;
}, [timeline, currentTime]);
```

**UX Benefit**: 抽出された動画のどの地点にシークしても、元の文脈に完全に一致した字幕や装飾が 1:1 で同期して表示されます。これにより、高度な編集ツールにおいて不可欠な「時間軸の信頼性」が担保されます。

---

## Pattern 112: Visual Predictability over Dynamic Flexibility (The One-Line Constraint)

**Constraint**: Multi-line auto-wrapping for text overlays (telops) creates unpredictable DESIGN outcomes. Variations in font size, line height, and character width (especially with mixed-width fonts) often cause text to clip outside safe zones or overlap with critical visual elements.

**Solution**:
1.  **Strict One-Line Enforcement**: Apply `whiteSpace: 'nowrap'` at the CSS level for all auto-synced text components.
2.  **Explicit Character Stripping**: Sanitize the incoming text by replacing `\n` characters with spaces to prevent accidental "ghost line breaks" from source transcripts.
3.  **Data-First Resolution**: If a line is too long, the solution is forced back to the **Segmentation Engine** (Backend) to split the text into more units, rather than the **Layout Engine** (Frontend) to wrap it.

**UX Benefit**: Provides a 100% predictable "Walled Garden" design. What the creator sees in the high-fidelity preview is exactly what the renderer will output, eliminating "multibyte wrapping surprises" found in legacy editing tools.

## Pattern 113: Synchronized Segment Control (The Character Budget UI)

**Constraint**: Backend segmentation logic (splitting transcript into chunks) is typically opaque to the creator. This leads to a disconnect where the user wants shorter, faster-moving telops but doesn't know how to trigger them without manual pixel-pushing.

**Solution**:
1.  **Exposed Parameter**: Surface the backend's `max_chars_per_line` (or "Character Budget") as a primary slider or numeric input in the Designer UI.
2.  **Real-Time Re-triggering**: On change, trigger an immediate POST request (e.g., `/telop/split`) with the new threshold.
3.  **Dynamic Timeline Refresh**: Replace the local segment state with the fresh backend-calculated timeline.

**Outcome**: This creates an "Elastic Timeline" where the creator can adjust the **Video Pacing** and **Visual Density** globally through a single numeric dial, keeping the backend's sophisticated semantic splitting logic (e.g., comma-splits, sentence-ends) intact.

---
## Pattern 114: Segmentation-Style Duality (UI Separation)

**Constraint**: In high-fidelity editing tools, mixing **design-time** properties (fonts, colors) with **run-time** properties (splitting points, pacing) in the same panel creates high cognitive load and accidental data loss.

**Solution**:
1.  **Duality of Workspace**:
    *   **Style Layer (The Designer)**: Dedicated to visual attributes. No direct control over the timeline pacing.
    *   **Pacing Layer (The Reviewer/Timeline)**: Dedicated to synchronization and re-segmentation.
2.  **Explicit Integration Trigger**: Surface the "Character Budget" (Max Chars) in the Designer, but require an explicit "Update Segmentation" action in the Reviewer. This prevents "auto-refresh ghosting" where a user’s manual timeline adjustments are wiped by a style change.
3.  **Cross-Context Hints**: When a design-level budget change is made, provide a visual prompt indicating that the timeline requires a refresh to reflect the new constraints.

**UX Outcome**: Creators can experiment with styles without fearing for their timing data, while having a clear path to "fixing" text overflow through a high-level dial instead of micro-editing individual segments.

---
---
## Pattern 115: Contextual Content Control (Pacing-Content Unity)

**Constraint**: In professional creative applications, separating the **Content Data** (text) from the **Timeline/Pacing Context** (where that text is previewed) forces users to switch contexts frequently, leading to cognitive fatigue and slower iteration cycles.

**Solution**:
1.  **Reviewer-Centric Editing**: Provide a direct text editing interface within the playback/review environment. If a user sees a typo or a pacing issue, they should be able to "fix it where they found it."
2.  **Linked Reactive Loops**: Any manual edit in the Content Panel must be immediately available to high-level automation tools (e.g., a "Re-segment" button). This ensures that the user's manual "intent" (the edited text) is inherited by the machine's "execution" (the new splitting logic).
3.  **Duality Enforcement**: Keep the "Visual Style" (fonts/colors) strictly in a separate Designer mode, but merge "Content" and "Pacing" into the Reviewer mode to create a unified editorial workspace.
4.  **Tri-Pane Layout Architecture**: Implement a three-column grid to manage high-density creative tasks:
    *   **Orchestration (Left)**: Project/Job selection and global automation parameters (e.g., character budget).
    *   **Execution (Middle)**: High-fidelity playback and real-time preview of the current state.
    *   **Atomic Detail (Right)**: Direct, contextual editing of content (e.g., text, metadata) without leaving the playback context.

**UX Outcome**: Creators experience a "Flow State" where 90% of the final polishing (typo fixes, length adjustments, segmenting) happens in a single, high-fidelity preview context.

## Pattern 116: Interface De-cluttering (Concentrated Editorial Workspace)

**Constraint**: Adding new features (like side panels) without removing legacy UI elements creates "UI Debt," leading to visual noise and cognitive overload.

**Solution**:
1.  **Contextual Migration**: Move all related controls (e.g., re-segmentation dials, metadata summaries) into the new, most-relevant panel.
2.  **Visual Pruning**: Actively remove duplicate indicators from the central execution area to focus the user's attention on the creative result (the preview).
3.  **Atomic Grouping**: Group "Information" (Context Summary) and "Action" (Edit Inputs) in the same vertical space to minimize eye movement.

**UX Outcome**: The interface feels cleaner and more "intentional," with a clear information hierarchy that guides the user from Project Selection → Preview → Direct Refinement.

## Pattern 117: Temporal Data Anchor (Constraint-Aware Pacing)

**Constraint**: When automation (like AI-driven re-segmentation) treats a data stream (like text) as an isolated string without its original temporal anchors (start/end times), the resulting output will "drift" away from its source media (audio/video).

**Solution**:
1.  **Temporal Passthrough**: Always wrap data mutation requests with their original "Temporal Box" (e.g., this string belongs to the video segment from 12.0s to 18.5s).
2.  **Proportional Scaling**: If the segmentation count changes, the automation must distribute the *fixed* duration of the box among the new segments proportionally, rather than guessing new durations from zero.
3.  **Visual Drift Alerts**: If the system detects that estimated reading time vastly exceeds the available temporal box, provide a visual "Speed/Overflow" indicator to the user.

**UX Outcome**: Users can rely on automated formatting without losing the fundamental synchronization of their project, maintaining "Temporal Fidelity."

---

## Pattern 118: Absolute-Relative Duality (Reference Frame Alignment)

**Constraint**: In distributed media pipelines, backend data often uses "Absolute" timestamps (originating from a long source video), whereas frontend players for sub-clips (Shorts) use "Relative" (0:00-based) timelines. This mismatch leads to desynchronization where content appears at incorrect offsets or disappears entirely.

**Solution**:
1.  **Consumer-Specific Normalization**: The UI layer must perform a "Reference Frame Shift" immediately before use.
2.  **Derived Offset**: Calculate `clip_offset = original_timeline[0].start`.
3.  **Display Normalization**: Map the timeline items to `{ ...item, start: item.start - clip_offset, end: item.end - clip_offset }` using `useMemo` to ensure reactive but non-permanent conversion.
4.  **Edit Absolute, View Relative**: When editing, always update the **Absolute** source data rather than the derived relative view to prevent cumulative drift ("Rounding Drift") and maintain the "Source of Truth" integrity.

---

## Pattern 119: Character-Proportional Scaling (Heuristic-Based Pacing)

**Constraint**: When re-segmenting a block of content (e.g., splitting a 10s caption into 3 parts), using an "Even Split" logic (3.33s each) ignores the physical reality of content density. A segment with 2 characters and a segment with 20 characters should not have the same screen time.

**Solution**:
1.  **Weighted Duration Allocation**: Distribute the total available duration among new segments based on their character count relative to the total character count.
2.  **Algorithm**: `segment_duration = total_duration * (segment_chars / total_chars)`.
3.  **Outcome**: This creates a "Natural Pacing" that mimics the rhythm of speech, significantly reducing manual adjustment effort for the user after AI-driven formatting changes.

---

## Pattern 120: Ground-Truth Word-Level Re-anchoring (The "Perfect Sync" Pattern)

**Constraint**: Even with Pattern 119 (Proportional Scaling), the result is still an "estimation." It cannot account for pauses, speaking speed variance, or non-linear pacing in the original audio.

**Solution**:
1.  **Preserved Atomicity**: Do not discard the raw, word-level timestamps (Ground Truth) provided by the Speech-to-Text engine (e.g., OpenAI Whisper).
2.  **Regrouping over Recalculation**: Instead of "Splitting" a text string and predicting times, "Regroup" the existing word-objects into new segments that fit within the UI constraints (e.g., `max_chars`).
3.  **Structural Integrity**: 
    - `group.start = first_word_in_group.start`
    - `group.end = last_word_in_group.end`
4.  **Effect**: This achieves **Zero-Error Synchronization**. The transition points between captions match the exact millisecond a word is spoken, providing "Broadcast-Grade" precision without manual keyframing.

**React / API Pattern**:
```tsx
// frontend/ShortReviewer.tsx
const handleResplit = async () => {
  // Bridge Pattern: Convert existing timeline segments into 'word' atoms
  const words = timeline.map(t => ({ word: t.text, start: t.start, end: t.end }));
  
  const res = await fetch('/api/telop/split', {
    method: 'POST',
    body: JSON.stringify({ words, max_chars: 18 })
  });
  
  const { lines } = await res.json();
  // Directly use the regrouped lines with ground-truth timestamps
  setTimeline(lines.map(l => ({ text: l.text, start: l.start, end: l.end })));
};
```

```python
# backend/splitter.py
def resplit_with_words(words, max_chars):
    # Regrouping logic that preserves original start/end anchors
    segments = []
    # ... grouping loop ...
    return segments
```

---
**The Atomic Unit Resolution (Decomposition)**:
When implementing a "Bridge Pattern" (converting existing segments to atoms), the backend must **decompose** an atom if it exceeds the `max_chars`. This is achieved by splitting the atom's text into chunks and using linear interpolation to derive sub-timestamps. This ensures that the system can both merge and split segments with zero temporal drift.

**Semantic Evolution (Success)**:
A pure character-count regrouping can lead to unnatural line breaks (e.g., splitting in the middle of a word or immediately before a particle). The final evolution of Pattern 120 combines **Ground Truth Re-anchoring** with **Semantic Splitting Rules**. The algorithm first determines ideal semantic breakpoints in the full text string mapping existing linguistic rules (P0-P4), then maps the closest word-anchors to those breakpoints using a 2-phase interpolation approach. This ensures the output is both perfectly synchronized and broadcast-ready in terms of readability.

**Verification**: Confirmed via FBL browser testing. Total time range preservation (e.g., 53.3s total) was achieved with zero millisecond drift by using existing caption segments as word-anchors.

## Pattern 201: Reinforced Context Loop (AI Training Data Hygiene)

**Constraint**: When collecting user feedback (Good/NG) and edits for machine learning reinforcement, capturing only the "Final Text" misses the most valuable signal: the **Delta** between what the AI proposed and what the human corrected. Without the original context (AI prompt, AI output, human edit), the data is insufficient for fine-tuning or RLHF.

**Solution**:
1.  **Contextual Snapshotting**: When a user clicks "Approve" or "Feedback", capture a matched pair of `{ original_ai_proposal, final_user_edit, user_rating }`.
2.  **Temporal Consistency Guard**: Ensure that "Good" ratings with "Zero Edits" are flagged as "High-Target Training Data" (Perfect Success), while "NG" ratings are paired with the subsequent "Retry" or "Manual Edit" to form a `Loss` signal.
3.  **Anonymized Project Context**: Attach project-level metadata (e.g., "Podcast", "Talking Head", "Gaming") to the feedback record to allow for domain-specific fine-tuning.
4.  **Feedback-Edit Atomic Link**: Store the feedback in a central `feedback.json` but maintain a reference to the specific `job_id` and `timestamp` to allow for retrospective "Traceability Audit" of the training set.

**UX Outcome**: The system becomes "Future-Proof" for machine learning. Even if RL isn't implemented today, the high-fidelity data being collected is ready for "One-Click Fine-tuning" tomorrow.

## Pattern 121: Placeholder Content Integrity (Safe Metadata Loading)

**Constraint**: When applying templates or bulk styles to existing content (e.g., transcripts), design-time placeholders (like "New Telop" or "Caption Area") often overwrite the user's actual data if not handled carefully. This results in "Silent Overwrites" where the user must re-type their dialogue from memory.

**Solution**:
1.  **Reactive Property Priority**: When mapping a template to an item, always prioritize the `item.text` (existing content) as the primary source.
2.  **Conditional Fallback**: Only use the template's placeholder text if the target item is a "New Element" or its text field is explicitly empty/unset.
3.  **Metadata Preservation**: Deep-merge properties to ensure that while the "Shape" (x, y, color) is updated, the "Spirit" (the unique textual content) remains untouched.

**UX Outcome**: Users can "cycle through design options" for their captions with zero fear of data loss, maintaining iterative velocity.

## Pattern 122: Context-Specific Readability Defaults (The "Shorts" Standard)

**Constraint**: Global defaults (e.g., a maximum of 18 or 25 characters per line) that work for desktop cinematic horizontal video (16:9) create illegible, cramped text when applied to vertical short-form mobile content (9:16).

**Solution**:
1.  **Device-Aware Tuning**: Establish context-specific defaults. For 9:16 mobile-first editing, reduce the default `max_chars_per_line` to **12** to ensure font sizes can be large enough for "skimmable" readability.
2.  **Aspect-Ratio Budgeting**: Character budgets should decrease as the relative width of the content area decreases.
3.  **Readability Audit (Pattern 93 Evolution)**: Use 12 characters as the "Safe Standard" for high-impact social media content, ensuring text remains centered and doesn't collide with UI overlays (e.g., TikTok/Shorts icons).

**UX Outcome**: The tool provides "Legible by Default" results, significantly reducing the manual "re-splitting" effort required for professional publishers.

## Pattern 123: The Magic-String Leak (Default State Cleansing)

**Constraint**: In large applications, a user-facing placeholder string (e.g., "New Caption" or "新しいテロップ") often exists in multiple locations: as a constant in a type definition, as a hardcoded value in a store, and as existing mock data in historical project JSON files. Fixing it in one place (e.g., the store) doesn't prevent it from "leaking" back into the UI from other sources during specific operations like re-splitting or data migration.

**Solution**:
1.  **Codebase-Wide Literal Audit**: Use recursive search tools (grep/ripgrep) to identify all occurrences of the literal string, not just within the immediate logic.
2.  **Type-Level Default Safety**: Replace magic strings in `interface` or `const` definitions with `""` (empty string) or a dedicated `SystemConstants.DEFAULT_TEXT` to ensure centralized control.
3.  **Migration Sanitization**: If the string has already "leaked" into persistent storage (e.g., project JSONs), implement a sanitization pass during data loading to strip out known system placeholders.

**UX Outcome**: Eliminates "ghost text" that appears unexpectedly during complex state transitions, ensuring the user's focus remains on their own content.

## Pattern 124: Strict Content-Style Decoupling (Single Source of Truth for Content)

**Constraint**: UI components that use "Style Templates" (which often include dummy text like "New Caption" or "新しいテロップ") often accidentally fallback to the template's dummy text if the item mapping relies on the template store's items directly for rendering. This is especially prevalent in "Live Previews" that switch styles while the user is editing content.

**Solution**:
1.  **Strict Reconciliation**: Decouple the **Content Provider** (e.g., the transcript/timeline data) from the **Style Provider** (e.g., a style-template store).
2.  **On-the-fly Merging**: Instead of having the template store overwrite the current content items, the rendering logic should perform a "Merge on Render." It should apply the visual properties (font, color, position) of the selected style template to the established content text.
3.  **Placeholder Discarding**: Explicitly ignore or discard the `text` property of any item coming from a "Style Template" store, ensuring the "Content Store" remains the absolute single source of truth for text data.

**UX Outcome**: Users can switch between highly stylized designs with 100% confidence that their edited text will never be reverted to system placeholders, ensuring zero friction in the "Iteration-Style-Cycle."

## Pattern 125: Reactive Visual Binding Integrity (Style-State Continuity)

**Constraint**: When decoupling content (text) from style (visual metadata), it is easy to accidentally break the reactive chain if the data mapping (e.g., `useMemo`) over-simplifies the visual archetype or fails to propagate deep property changes (glow, shadows, background). This leads to "Style Stalling" where visual changes in the store don't reflect in the preview.

**Solution**:
1.  **Deep Property Mapping**: Always pass through the entire visual state object from the style provider to the renderer.
2.  **Structural Multiplicity**: Support multi-layer style templates by maintaining a mapping between content segments and their respective style archetypes, rather than assuming a single flat style.
3.  **Strict Store Observation**: Ensure the reactive system (Zustand, Redux, etc.) triggers a re-computation of the "Fused Element" (Content + Style) on any visual change, even if the text itself is static.

**UX Outcome**: Maintains the 120% WYSIWYG standard by ensuring that style adjustments are real-time and high-fidelity, regardless of content processing.

## Pattern 126: State Hydration & Safety Rails for Decoupled Stores

**Constraint**: In complex apps using multiple stores (e.g., a Content Store and a Template Store), one store may fail to hydrate or lose its data (e.g., empty `templates` array), causing the UI to fallback into a broken state where features like "Style Switching" appear disabled or "Defaulted."

**Solution**:
1.  **Hydration Verification**: UI components should verify the existence of data in secondary stores (Style/Template) and provide clear visual feedback or "Fallback Presets" if the primary store is empty.
2.  **Structural Robustness**: Overlay players (like `LayeredPreviewPlayer`) must have strictly defined dimensions or "Containment Awareness" to prevent zero-height/zero-width rendering during complex parent-child layout shifts.
3.  **Cross-Store Sync Logic**: Implement explicit "Re-sync" triggers when one store updates (e.g., when a Project is loaded, ensure the Template Store is also populated).
4.  **Intrinsic Preset Fallback**: Hardcode or import a set of "Core Styles" (Intrinsic Presets) into the UI component itself. This ensures that the user always has high-quality choices even if the persistence layer or decoupled template store fails to hydrate.

**UX Outcome**: Prevents "Broken Feature Syndrome" where UI elements exist but are non-functional due to silent data-availability failures between decoupled stores.

## Pattern 127: Selective State Reconciliation (The "My Style" vs. "System Presets" Balance)

**Constraint**: When attempting to fix a "Broken Feature" (like an empty template store, Pattern 126), there is a risk of **System Takeover** where built-in presets completely replace user-generated content/options ("My Style"). This results in a loss of user agency and a regression where custom designs no longer sync to the preview.

**Solution**:
1.  **Union-Based Population**: Dropdown menus and style selectors should perform a **Union** of "System Presets" (safety fallbacks) and "User Styles" (persistent state). Never allow one to exclude the other unless explicitly filtered by the user.
2.  **Referential Continuity**: Ensure that switching styles via a "Preset" function (like `applyStylePreset`) updates the *primary visual archetype* that the `useMemo` content-merger (Pattern 124) is listening to.
3.  **Proportional Optimization**: Avoid "Total Refactoring" of complex mapping functions during bug-fix cycles. Instead, apply "Surgical State Injection" to preserve existing fallback chains (e.g., preserving `telop_config` -> `telops` store fallback).

**UX Outcome**: Users feel both "Safe" (presets always work) and "Powerful" (custom styles are preserved), maintaining high trust in the tool's persistence layer.

## Pattern 128: Prop-Contract Invariance (Atomic Logic Reversion)

**Constraint**: During a "Fix-Regression-Restoration" cycle, developers often attempt to "Restore" old logic by copy-pasting previous state-mappers. However, if the destination component (e.g., `LayeredPreviewPlayer`) has undergone an architectural shift (Pattern 90/124) during the same interval, the "Restored" data shape may fail to satisfy new, implicit contracts (e.g., expecting specific property presence or non-empty fields for reactivity).

**Solution**:
1.  **Identity Mapping Audit**: When reverting a data-mapper, verify that every property satisfies the *current* interface of the consumer component, not the *previous* version.
2.  **Reactive Surface Check**: Ensure that the "Restored" state objects maintain the same observer/dependency chain. A "surgical" fix that changes object references or property types (e.g., `string` to `undefined`) can trigger silent rendering failures.
3.  **Boundary Transparency**: Data mappers should remain "Transparent" to content. If `text: ''` is used as a placeholder for dynamic merging, the consumer component must have a documented fallback or explicit merging rule to prevent "Empty Canvas" syndrome.

**UX Outcome**: Ensures that "Fixing a regression" doesn't create a new, deeper regression due to architectural misalignment.


## Pattern 129: Visual-DOM Divergence (High-Fidelity Player Paradox)

**Constraint**: In high-fidelity video editing suites (Pattern 90), automated tests or subagents often report "Failure" (e.g., `0px height`, `Missing Element`) when inspecting the DOM. This happens because the rendering engine (Canvas/WebGL) and the reactive data layer are out of sync with physical DOM metrics during fast state transitions, even when the *visual* output is perfect.

**Solution**:
1.  **Visual Truth Precedence**: Establish "Visual Verification" (Screenshots/OCR) as the primary source of truth for reactivity success, over-riding DOM-level attribute checks.
2.  **Grace Period Polling**: When checking for rendering success, allow a "Settling Window" for the canvas to resolve its internal state and for the DOM container to hydrate its final dimensions.
3.  **Non-Blocking Diagnostics**: Design diagnostic tools that measure *data presence* (e.g., checking the `displayTelops` array length in JS) rather than *visual layout presence* in the DOM to avoid false-negative "Empty Canvas" alerts.

**UX Outcome**: Prevents unnecessary engineering work and "Fixes" for non-existent bugs that were actually artifacts of detection latency.


## Pattern 130: Parametric Gravity (Pipeline Constraint Integrity)

**Constraint**: In complex data processing pipelines (such as text splitters or media encoders), the user providing a dynamic parameter (e.g., `max_chars`) assumes it will be the governing constraint. However, if a sub-function or a late-stage filter defaults to a hardcoded constant (e.g., a "reasonable" 18-char limit), it creates a "Shadowing" effect where the user's intent is ignored at the edge of the pipeline.

**Solution**:
1.  **Gravity Propagation**: Ensure that functional parameters exert "Gravity" across the entire call stack. Explicitly pass stateful constraints into every helper function rather than relying on package-level constants.
2.  **Terminal Validation**: The final exit point of a pipeline must perform a strict validation check against the original constraints. If a heuristic (like splitting on spaces) is used, a second pass of "Forced Enforcement" (like truncation) must guarantee compliance.
3.  **Constraint Audit**: Periodically audit "reasonable defaults" in middle-ware logic. If a value is hardcoded, it is a candidate for a regression when the application's global needs (e.g., switching from 16:9 to 9:16) shift.
4.  **Secondary Rule Preemption**: Be vigilant of linguistic or formatting rules (e.g., Kin-soku/Punctuation avoidance) that automatically merge segments. These rules must be gated by the same parametric gravity to prevent a "13-char bug" where a punctuation mark is merged into an already-full line.

**UX Outcome**: Users feel the tool is "Literal" and "Obedient." When they set a limit, it is strictly respected, preventing visual glitches such as text overflowing the screen boundaries or overlapping with UI elements.

*Updated: 2026-02-05 - Phase 13 Temporal Unity & Constraint Gravity*

## Pattern 135: Semantic Adroitness (Graceful Overshoot)

**Constraint**: Strict adherence to Pattern 130 (Parametric Gravity) is necessary for layout integrity, but "dumb" enforcement can lead to linguistically nonsensical outputs, such as a punctuation mark (e.g., `。`) being placed on a line by itself because the previous line was exactly at its limit.

**Solution**:
1.  **Controlled Slack**: Implement a "Graceful Overshoot" allowance (e.g., +2 chars) specifically for non-content characters like punctuation.
2.  **Solitary Prevention Logic**: If a linguistic rule (like Kinsoku) would result in a line consisting only of punctuation, prioritize merging it into the previous line even if it creates a minor violation of the primary constraint.
3.  **Polarity Awareness**: Ensure that punctuation "sticks" to its logical anchor. If it must move, it should move backward (to the end of the previous line) rather than forward (to the start of the next line), maintaining the "Meaningful Break."

**UX Outcome**: The tool appears "Smart" and "Human-like." It respects the user's layout constraints while ensuring the resulting text is semantically and typographically correct, avoiding jarring errors like orphaned periods.

## Pattern 140: Recursive Learning Loop (User-in-the-Loop AI)

**Constraint**: Standard AI models (and rule-based systems) are static, while professional editing standards often depend on specific speaker rhythms or niche content requirements.

**Solution**:
1.  **Passive Capturing**: Log manual user edits as "Ground Truth" deltas without interrupting the workflow.
2.  **Pattern Analysis**: Analyze deltas over time to identify systematic "AI Failures" (e.g., a user always fixes a specific split point).
3.  **Advisory Updates**: Propose rule set updates (e.g., Pattern 130 thresholds) to the user based on their own editing history.
4.  **Calibrated Trust**: By admitting the system can learn from the user, the "Unpredictable AI" becomes a "Collaborative Partner."

**UX Outcome**: User frustration with repetitive "AI mistakes" is converted into productive data gathering. The tool's perceived IQ increases over time, creating a "Moat" of personalized performance that competitors cannot easily replicate.
## Pattern 145: State-Safe Evaluation Funnel (Buffered Feedback)

**Constraint**: In review-heavy workflows, "evaluating" an item (e.g., Good/NG rating) and "polishing" an item (e.g., editing telops) often happen in the same mental session. If the evaluation action triggers a global state refresh or a component re-mount via `key` changes (Pattern 95), un-persisted local edits in the buffer are wiped. This creates a "Sisyphus loop" where rating an item accidentally punishes the user by deleting their manual corrections.

**Solution**:
1.  **Optimistic Status Piercing**: Evaluation actions (Good/NG) should update the local UI and the backend silently, without triggering a "Hard Refresh" of the parent data container.
2.  **State-Independent Appraisal**: Decouple the "Rating State" (which affects metadata/filtering) from the "Canvas State" (which holds the current edit buffer).
3.  **Atomic Persistence Guard**: Ensure that "Save/Approve" triggers a full write of the edit buffer, while "Good/NG" only updates a specific flag. If the UI must refresh, it should perform a "Surgical Merge" where the local edit buffer is preserved over the incoming fresh data from the server.
4.  **Buffer Awareness**: The UI should indicate if there are "Unsaved Edits" and prevent evaluation actions from closing the session until those edits are either discarded or persisted.
5.  **Steady Context (No Auto-Advance)**: In dual-purpose screens (rating + editing), the "Rating" action should never move the user to a different item automatically. This preserves the context for the "Polish" phase before a final submission.
6.  **Hydrated Historical State**: When reopening a review modal for an item previously evaluated, the UI must "hydrate" its local feedback state from the backend's persistent metadata immediately. This prevents the "Rating Ghosting" effect where a previously rated item appears fresh, confusing the user about whether their historical evaluation was saved.

**UX Outcome**: Users can rate and edit simultaneously with high velocity, trusting that the system respects their "Work in Progress" even when meta-data is being updated.


*Updated: 2026-02-05 - Phase 15 Evaluation Stability*

## Pattern 146: Word-Level Re-anchoring (Semantic Resplit Guard)

When users perform manual text edits followed by a "Re-download" or "Re-split" operation, the association between the edited text and the original word-level timestamps can be lost, causing timing drifts or skipped sentences.

### Pattern: The "Reconciliation Buffer"

Instead of a raw text replacement, maintain a mapping between character indices and timestamp offsets.

1.  **Text Shadowing**: Keep the original transcription as a shadow state.
2.  **Diff-Based Application**: When text is edited, apply the changes but attempt to "anchor" them to the nearest timestamp markers.
3.  **Proportional Distribution**: If a word is replaced by a shorter/longer phrase, distribute the original allocated duration of that word across the new characters proportionally to avoid shifting the entire subsequent timeline.

**UX Benefit**: Maintains "Extreme Sync" (as established in Pattern 120) even after significant human intervention, preventing the "drift" that often plagues AI editing tools during the refinement phase.

4.  **Fuzzy Semantic Reconciliation**: If the manual text edit is so radical that direct character matching with the original `words` buffer fails, implement a sequence alignment algorithm (e.g., Levenshtein or Smith-Waterman) to find the most probable "anchors" in the physical timeline. Fallback to duration-based linear interpolation only as a last resort.

5.  **Explicit Transition vs. Auto-Resplit**: To prevent race conditions during high-speed typing, disable automatic "auto-resplit" triggers (useEffect sinks) once manual editing begins. Require an explicit user action (e.g., an "Apply Edits" or "Resplit" button) to commit changes to the backend. This ensures the backend receives a complete, finalized buffer rather than a sequence of partial/broken strings.

## Pattern 147: Atomic Context Decoupling (The "Workbench" Pattern)

When a component grows to handle multiple high-fidelity workflows (e.g., viewing, rating, and editing) within the same modal, the state surface area often "explodes," leading to maintenance debt and unstable reactivity.

### Pattern: The Multimodal Workbench

Instead of holding one massive state object or dozens of independent `Record<number, T>` hooks:

1.  **Draft vs. Committed Isolation**: Maintain a local "Draft Context" for the current edit session. Any changes within the draft (e.g., character additions) should not trigger global effects or parent re-renders until an explicit "Apply/Commit" action is performed.
2.  **Domain Partitioning**: Separate "Review Metadata" (Good/NG ratings, Template selection) from "Structural Edits" (Text content, timing segments). These belong in separate sub-contexts to prevent evaluation actions from inadvertently interrupting the editing pipeline.
3.  **Dependency Sanitization**: Aggressively audit `useEffect` hooks in sub-components to ensure they do not depend on volatile parent states (like "current preview URL") unless absolutely necessary. Use `useRef` or explicit event handlers (callbacks) to pull parent data only at the moment of action.
4.  **Schema Enforcement**: Use a rigorous validation layer (e.g., Zod) or a dedicated API client module (`api-client.ts`) on any data entering or leaving the "Reconciliation" phase to ensure that Field Drifts (Pattern 128) between versions are caught at compile-time or early runtime before they cause visual "ghosting" or "omissions."

**UX Outcome**: The application remains responsive and predictable even under heavy manual intervention, with no risk of accidental state resets or API spam during the "Polish" phase.

## Pattern 148: Unified API Client Pattern (Type-Safe Orchestration)

## Pattern 202: Robust Dual-Stream Download (File System Access + Fallback)

**Constraint**: Modern browsers often block "Silent Downloads" or handle large video blobs inconsistently. A traditional `<a>` tag download may fail for large files, and the newer `showSaveFilePicker` API is not supported in all browsers or may be cancelled by the user.

**Solution**:
1.  **Capability Detection**: Attempt to use the **File System Access API** (`showSaveFilePicker`) first. This provides the most professional experience (Save dialog, custom filename, stream writing).
2.  **Immediate Validation**: Before starting the download, perform a "Pre-flight Check" on the file size and `Content-Type`. If the server returns HTML/JSON (an error page) instead of a video blob, abort and notify the user immediately.
3.  **Transparent Fallback**: If the File System Access API fails or is unavailable, silently fall back to the "Traditional Blob" method (`createObjectURL` + `click()`).
4.  **Diagnostic Feedback**: Log every stage of the download process (Content-Type, Blob Size, API Choice) to the console to allow for rapid remote troubleshooting.

**UX Outcome**: Users experience "Zero-Failure Downloads." The system feels professional and resilient, regardless of their browser choice or network conditions.

## Pattern 203: Contextual Template Evolution (Update-Clear Link)

**Constraint**: When a user selects a "Template" (e.g., a telop style), they often make micro-adjustments in the Designer. If the UI doesn't allow saving these back to the original template, the user is forced into "Duplicate Creation," resulting in a library filled with slightly different versions of the same style. Alternatively, if the link to the template is "invisible," the user may accidentally overwrite their master template.

**Solution**:
1.  **State-Linked UI**: When a template is loaded, display its name and a "📌 Currently: [Name]" indicator in the design panel.
2.  **Explicit Update Action**: Provide a dedicated "🔄 Update" button that appears ONLY when a template is successfully loaded. Require a confirmation ("Overwrite template?") to prevent destructive accidents.
3.  **The "Clear Link" Hatch**: Provide a "✕" button to "Unlink" the current design from the template. This allows the user to use a template as a starting point and then branch out into a new, independent design without affecting the source.
4.  **Reactive Store**: Ensure the `loadedTemplateId` is cleared only on explicit unlinking or project switches, maintaining the "Contextual Link" throughout the editing session.

**UX Outcome**: The style library remains "Clean and Evolved." Users can refine their brand identity over time by updating existing templates rather than cluttering their workspace with redundant replicas.

**Solution**:
1.  **Structural Centralization**: Create a single `api-client.ts` module that exports strictly typed async functions for every backend interaction.
2.  **Schema Anchor**: Imports Pydantic-generated types to ensure the client is the "Ground Truth" for the frontend-backend contract.
3.  **Standardized Middleware**: Implement a central `handleResponse` helper for consistent error logging and toast notifications.

**UX Outcome**: Developers gain the confidence to "Refactor Aggressively," while users benefit from consistent error reporting and reliable data synchronization.

## Pattern 149: Optimistic Pipeline Synchronization (The "Reconciliation Hook" Pattern)

**Constraint**: When the user performs an action (e.g., "Approve") that triggers a complex backend process, the UI often stays "frozen" in its old state until a manual refresh, or uses Optimistic Updates that eventually drift from the system's "Ground Truth."

**Solution**:
1.  **Transactional Integrity**: Every write action (POST/PUT) in a custom hook should be followed by a conditional `refresh()` call to pull the definitive state from the server.
2.  **Refresh Debouncing**: If multiple actions happen in a sequence, debounce the refresh to avoid "UI Jitter" while ensuring the final result is 100% accurate.
3.  **Visual Lifecycle Marking**: Use distinct sub-loading states (e.g., `approveLoading[id]`) rather than a global `loading` flag, allowing the user to continue interacting with other parts of the workbench during the reconciliation.

**UX Outcome**: The UI feels "Alive" and "Self-Healing," providing 120% trust that the dashboard accurately reflects the state of the AI pipeline.

## Pattern 150: The "Action Manifestation" Toast

**Constraint**: In high-fidelity AI dashboards, backend operations (Approve, Render, Save) are often asynchronous. If the UI doesn't provide explicit feedback, users experience "Click Anxiety," leading to double-clicks, duplicate requests, or loss of work.

**Solution**: Use transactional toast notifications (via `sonner` or similar) to manifest the intent and result of the action.
1.  **Intent Acknowledgment**: Show an immediate "Saving..." or "Approving..." state for actions expected to take > 500ms.
2.  **Explicit Verification**: Use color-coded (Success/Error) toasts that include specific entity identifiers (e.g., "Short #4 approved").
3.  **Undo Buffering**: For destructive actions, provide an "Undo" button within the toast's action slot.

**UX Outcome**: Eliminates "Silent Failures" and provides 120% reassurance, making the tool feel professional and responsive.

```tsx
// 📂 Implementation in apps/dashboard/src/app/layout.tsx
import { Toaster } from "sonner";

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>
        {children}
        <Toaster theme="dark" position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}

// 📂 Workflow in apps/dashboard/src/hooks/useReviewShorts.ts
const approve = useCallback(async (shortIndex: number) => {
    try {
        await reviewApi.approve(jobId, shortIndex, selectedTemplates[shortIndex]);
        await fetchData(); // Pattern 149
        toast.success(`Short #${shortIndex + 1} を承認しました`);
    } catch (e) {
        toast.error('Approveに失敗しました');
        throw e;
    }
}, [jobId, selectedTemplates, fetchData]);
```

## Pattern 151: The "Atomic Action Bridge"

**Constraint**: Radical refactoring of monolithic components (Pattern 147) often leaves "Functional Islands"—sub-components that render correctly but are disconnected from the parent's state or the backend due to missing callback bridges.

**Solution**:
1.  **Bridge Verification**: Every interactive Leaf component must have a corresponding "Prop Bridge" (e.g., `onUpdateTimeline`) that reaches a Root Hook or Manager.
2.  **Type-Safe Payloads**: Ensure the bridge's payload structure is strictly typed to catch connectivity gaps at compile-time.
3.  **Immediate Persistence**: In high-velocity editing UI (e.g., telop editors), bridges should trigger background persistence (POST) rather than waiting for a global "Save" button to prevent Pattern 128 (Field Drift).

**UX Outcome**: Architectural modularity is achieved without functional regression, ensuring that data flows seamlessly from the user's keystroke to the server's database.

## Pattern 152: The Initialization Guard

**Constraint**: Complex components with async side-effects (e.g., auto-formatting, AI processing) often re-trigger their logic when parent props update, even if the "Initial Load" is already complete. This leads to redundant API calls and UI "flicker."

**Solution**: Use a `useRef` flag to track the initialization state independently of the render cycle, but ensure the `useEffect` dependency array includes the data required for initialization to avoid the "Empty Props" trap.

```tsx
const initializedRef = useRef(false);

useEffect(() => {
    // 📂 Refinement: Only set initialized = true if the necessary data has arrived
    if (initializedRef.current || data.length === 0) return;
    initializedRef.current = true;
    
    performExpensiveInitialization();
}, [id, data.length]); // Monitor the arrival of data
```

**UX Outcome**: Predictable component behavior even with asynchronous props. Zero redundant network traffic, maintaining Pattern 120 (Technical Quality).

## Pattern 153: Post-Action State Reconciliation

**Constraint**: Optimistic UI updates (Pattern 128) provide immediate feedback but can diverge from the "Ground Truth" if the backend has complex side-effects (e.g., an "Approve" also triggers a render flag update).

**Solution**: Combine Optimistic UI with a mandatory "Ground Truth" fetch immediately after the action promise resolves.

1.  **Optimistic Step**: Set local `loading` or dummy state.
2.  **API Step**: Send command to backend.
3.  **Reconciliation**: Call `refresh()` or `fetchData()` to overwrite the optimistic state with the latest server data.

```tsx
const approve = useCallback(async (id) => {
    try {
        await api.approve(id);
        await fetchData(); // <--- Reconciliation Bridge
        toast.success(`Success!`);
    } catch (e) {
        toast.error(`Error!`);
    }
}, [fetchData]);
```

**UX Outcome**: Users get the speed of local updates with the absolute accuracy of server-side state.


## 155. Suspense-Wrapped URL Context (CSR Bailout Prevention)

In high-fidelity tools built with Next.js (App Router), any client component that consumes URL context via `useSearchParams()` must be isolated and wrapped in a `<Suspense>` boundary to prevent a "Client-Side Rendering (CSR) Bailout" during build or runtime.

### Pattern: Suspense Isolation for URL Params
When a page or workstation depends on deep links (e.g., `/reviewer?id=XXX` or `/editor?config=YYY`) to hydrate its initial state, ensure the build reliability by separating the context-injection from the entry point.

1.  **Context-Consuming Layer**: Encapsulate all logic that uses `useSearchParams` into a dedicated "Content" component.
2.  **Boundary Injection**: In the main `page.tsx` file, export a default function that wraps the "Content" component in a `<Suspense>` block.
3.  **Fallback Manifestation**: Provide a lightweight loading state (Skeleton, Spinner, or themed splash) in the suspense fallback. This avoids "Empty Screen Anxiety" while the browser processes the URL parameters and reconciles the initial hydrated state.


**UX Benefit**: Prevents fatal build errors in Next.js/Turbopack environments and ensures a smooth, predictable loading experience for complex, state-heavy interfaces.


## 156. Default Visual Archetypes for Dynamic Content

In high-fidelity creative tools where the presentation layer (CSS/Canvas) is decoupled from the content layer (JSON/Timeline), the system must provide **Default Visual Archetypes** to prevent "Ghost Data" (data that is present but invisible).

### Pattern: The presentation Safety Net
When a workstation renders dynamic content (e.g., dynamic telops, floating overlays, or UI annotations) based on user-selected templates or styles (e.g., Pattern 147), ensure that a "No Selection" state still results in visible content.

1.  **Fallback Archetype**: Define a high-contrast, universally readable default style (e.g., White Bold + Black Stroke) that is injected when specific style metadata is missing.
2.  **Explicit Zero-State Detection**: If the derived array of visual layers is empty but the content buffer (Timeline) is not, trigger the injection of the Fallback Archetype.
3.  **Position Optimization**: Defaults should be placed in "standard" regions (e.g., Lower Third for video) rather than overlapping core UI or being rendered at `(0,0)`.

**UX Benefit**: Eliminates user confusion and the false perception of "system failure" during the initial unconfigured state of a project. Ensures that the system's core value (e.g., the transcription) is always visible.


## 157. Global Offline Indicator (Heartbeat Health)

In decoupled architectures (Frontend vs. Backend), the UI must explicitly communicate the "Heartbeat" of the services it depends on to prevent users from diagnosing valid empty states (e.g., "Starting your first job!") as technical failures.

### Pattern: Service Reachability Banner

1.  **Passive Monitoring**: Periodically probe the backend "Health" or "Status" endpoint (e.g., via SSE or a `long-poll` heartbeat).
2.  **Ambiguity Elimination**: If the backend becomes unreachable (`net::ERR_CONNECTION_REFUSED`), display a prominent indicator (e.g., a "⚠️ OFFLINE" banner in the header).
3.  **Behavioral Locking**: When in an OFFLINE state, visually de-emphasize list areas and explain that "Data cannot be synced with the server," rather than just showing an empty list message.
4.  **Diagnostic Value**: A global offline indicator acts as a primary diagnostic tool for both developers and users, immediately pinpointing "Process Failure" as the root cause of missing content.

**UX Benefit**: Prevents the "Did I lose my data?" anxiety. Users understand that the content is simply temporarily unreachable due to service status, not due to data loss or a logic bug in the dashboard itself.


## 159. Committed Input Pattern (Blur-to-Sync)

In high-fidelity editors where input values are subject to automatic formatting (e.g., timestamps fixed to 1 decimal place, currency symbols, or auto-capitalization), a naive `value` + `onChange` binding leads to a broken user experience known as "Input Jitter."

### The Problem: Input Jitter
As the user types, every keystroke triggers a state update. If the state update logic includes formatting (e.g., `parseFloat(val).toFixed(1)`), it may rewrite the input value *while the user is still typing* (e.g., preventing them from typing a decimal point or mid-word correction).

### The Solution: defaultValue + onBlur
Decouple the "Active Typing" state from the "Global Sync" state by using uncontrolled components with a commitment trigger.

1.  **Direct Manipulation**: Use `defaultValue` instead of `value` to allow the browser to manage the text cursor and partial inputs naturally.
2.  **Commit Trigger**: Use `onBlur` to sync the final, valid value to the application state.
3.  **Keyboard Shortcut**: Map the `Enter` key to `e.currentTarget.blur()` to provide a familiar "Commit" action.
4.  **Identity Re-sync**: Use a React `key` (e.g., ``key={`${id}-${externalValue}`}``) to force the input component to re-mount and pull the latest `defaultValue` if the global state is changed externally (e.g., by a "Reset" or "Auto-split" button).

**UX Benefit**: Provides a fluid, native-feeling typing experience while maintaining strict data integrity and formatting on the business logic side.


## 160. Relative-to-Absolute Coordinate Mapping (Unified Reference Frame)

In applications that handle sub-sections of a larger asset (video clips, document snippets, or map regions), the UI often presents a **Local Reference Frame** (starting at 0 for the user), while the backend operates on a **Global Reference Frame** (timestamps or offsets inherited from the source).

### The Coordinate Space Mismatch
Users expect to see and edit "Clip Time" (where 0.0s is the start of the short clip they are watching). However, the underlying data often uses "Source Time" (the timestamp relative to the original source media). Saving local "Clip Time" directly into a "Source Time" indexed state causes the content to "jump" or disappear from the render window.

### Pattern: Bidirectional Offset Translation
1.  **Anchor Discovery**: Identify the `offset` (e.g., the `source_start` of the sub-clip) during component mounting or state derivation. In Videdit, this is the `timelineOffset` derived from `currentShort.timeline[0].start`.
2.  **Normalized Presentation**: Transform global data for the view layer: `DisplayTime = SourceTime - AnchorOffset`.
3.  **Re-aligned Persistence**: Transform user input back to the global reference frame before committing to state: `PersistenceValue = UserInputTime + AnchorOffset`.
4.  **Implicit Consistency**: Ensure all calculation logic (e.g., progress bars, seek triggers) consistently respects this transformation layer.

**UX Benefit**: Simplifies the mental model for the user ("I'm editing a 60-second clip starting at 0") while preserving the architectural necessity of absolute timestamps for multi-stage rendering and backend reconciliation.


## 161. Async Action Acknowledgement (The Instant Receipt Pattern)

When a user initiates a heavy-compute task (rendering, model training, large export) from a dashboard, the UI must provide immediate psychological closure regardless of the task's duration.

### The "Silent Block" Failure
Initiating a long-running process through a synchronous API call causes the UI to freeze or the browser's "Loading" spinner to spin indefinitely. This leads users to believe the app has crashed, resulting in repeated clicks or page refreshes that strain the backend.

### Pattern: Immediate Acknowledgement & Tracking
1.  **Instant Receipt**: The backend must respond within < 200ms with a `202 Accepted` status and a tracking `id`.
2.  **Visual Transition**: The "Action" button should immediately transition into a "Pending" or "Success (Processing)" state.
3.  **Progression Anchor**: Surface a persistent status indicator (Progress Bar, Toast, or Queue Item) that survives page navigation or reloads.
4.  **Polling/Push Lifecycle**: Use WebSockets or periodic polling to update the UI as the backend completes sub-stages of the task (e.g., "Extracting -> Rendering -> Uploading").

**UX Benefit**: Maintains the illusion of a fast, responsive interface even when the underlying work is slow, preventing "Action Anxiety" and providing clear transparency into system work.

## 162. Readiness-Probed Startup (Robotic Resilience)
A deployment or initialization pattern used primarily in autonomous workstations or server-heavy dashboards where "Service Lag" (port being initialized but not yet accepting requests) can cause silent failures in automated scripts or sub-agents.

### **Problem**
When an agent or script restarts a backend service (e.g., FastAPI, Next.js), it often proceeds to the next step (like a browser test or API call) the microsecond the process is spawned. However, the runtime takes several seconds to load modules, bind the database, and start the listener. This results in `ECONNREFUSED` or timeout errors that look like a fatal system failure when it's actually just a timing issue.

### **Implementation Pattern**
1.  **Kill & Detach**: Use `kill -9` on the port and `nohup` to start the process in a detached state.
2.  **Deterministic Buffer**: Introduce a `sleep [N]` command (usually 2-5 seconds depending on the stack complexity).
3.  **Active Readiness Probe**: Follow the sleep with a non-destructive API probe (e.g., `curl -I http://localhost:PORT/health`).
4.  **Sequential Success Chain**: Combine these using `&&` so that if the startup fails or the probe fails, the entire script stops early, preventing cascading errors in subsequent steps.

### **Example (Autonomous Startup)**
```bash
lsof -ti:8000 | xargs kill -9 && nohup python api.py > /tmp/log 2>&1 & sleep 3 && curl -s http://localhost:8000/api/v1/health
```

### **UX Benefit**
Ensures that the "Active Status" and the "Responding Status" of the workstation are synchronized for both humans and robotic agents, eliminating the frustration of "it worked 5 seconds later" bugs.

## 168. Sliding-Workstation State Persistence
A state management pattern for "Sliding" or "Sequence" workstations (like video reviewers or batch photo editors) where users navigate through a series of items while applying semi-persistent configurations.

### **Problem**
In sequence-based workstations, UI selections (e.g., choosing a design template, a filter, or a crop preset) are often stored in a single flat state variable. When the user navigates to the next item in the sequence (e.g., Short #1 → Short #2), this local state remains "pinned" to whatever was last selected. If the next item already has a different configuration saved in the backend, or if the user expects the selection to reset, the visual representation becomes "detached" or inconsistent.

### **Implementation Pattern**
1.  **Atomic State Mapping**: Instead of a flat `selectedId`, use a lookup table (e.g., `Map<Index, SelectionId>`) to store user intents per item.
2.  **Navigation Synchronization**: Implement a `useEffect` that listens to index changes (e.g., `currentShortIndex`). Upon a change:
    - Load the previous intent from the lookup table if it exists.
    - Fallback to the saved backend state for the new item.
3.  **Preview Key Invalidation**: Use a composite React `key` for the previewer that includes both the item ID and the selection status (`key={`${item.id}-${selectionId}`}`) to force a clean re-render when navigation occurs.

### **UX Benefit**
Prevents "Configuration Bleed" where a setting intended for one item is accidentally applied to the next, while ensuring that the user's creative decisions remain persistent even as they flip through a large volume of content.

## 176. Unified Status & Action Interface
A consolidation pattern that merges asynchronous progress tracking (Render Queue) and deliverable access (Download) into a single UI surface.

### **Problem**
In media-intensive dashboards, users often have to track the progress of a task in one area (e.g., a "Rendering Queue" popup) and access the completed artifact in another (e.g., a "Download List" in a sidebar). This spatial disconnection increases cognitive load, consumes valuable screen real estate, and forces the user to scan multiple locations to confirm "Is it done?" and "How do I get it?".

## 176. Unified Status & Action Interface (The Rendering Queue-to-Click Flow)

高度な非同期処理（動画レンダリング等）を伴うダッシュボードにおいて、進捗状況の表示（Status）とその完了後の成果物へのアクセス（Action）を単一の UI サーフェスに統合するパターン。

### **Implementation Pattern**
1.  **Contextual State Transition**: 進捗アイテムのデザインを、完了時にプライマリアクションが動的に変化するように設計します（例：プログレスバー＋「レンダリング中」ラベルが「ダウンロード」ボタンに変化）。
2.  **Prop-Driven Construction**: 進捗管理コンポーネントに必要なコンテキスト識別子（`jobId`等）を渡し、タスク完了時に即座に成果物 URL を構築できるようにします。
3.  **Recursive Update Notification**: `onTaskCompleted` 等のコールバックを使用して、親コンポーネントのデータ再取得（Refetch）をトリガーします。これにより、ダッシュボード全体の統計情報とキュー内の個別状態を即時に同期させます。
4.  **Spatial Consolidation**: 機能を統合した後は、冗長なリスト（例：別の場所にあるダウンロード一覧）を削除し、コアタスク（ビデオレビュー等）のための作業領域を 120% 確保します。

### **UX Benefit**
ユーザーがプロセスを監視している「まさにその場所」で成果物を提供することで、価値提供までの時間（Time-to-Value）を最小化し、クリーンでプロフェッショナルなワークステーション体験を実現します。


## 182. Cross-Deliverable Integrity Audit (The Intermittent Success Guard)

複数の成果物（例：10本のショート動画）をバッチ処理で生成する場合、一つ目の成果物の成功を持って「システム全体の正常性」を断定せず、複数の成果物を横断的にサンプリングして検証するパターン。

### The "Single-Success Fallacy"
- **Problem**: 修正を適用した後、最初の1本（Short 1）のレンダリングに成功しテロップが表示されたとしても、特定のデータ構造（例：特定のタイミングでのみ発生する Null 値や境界条件）を持つ他の成果物（Short 2）ではサイレントに失敗し続けている可能性がある。
- **Observer Bias**: 開発者は最も早く完了したアイテムを成功例として確認しやすく、その後のサンプルで発生している不具合を見逃す「観測バイアス」に陥りやすい。

### Implementation: Multi-Sample Verification
1.  **Heterogeneous Sampling**: プロジェクト内の最初、中間、最後のアイテムなど、異なるデータ条件を持つ複数の成果物を自動、あるいは手動で検証対象に含める。
2.  **Comparative Diagnostics**: 成功したアイテム (`short_1`) と失敗したアイテム (`short_2`) の入力データを `diff` し、特定のフィールドの欠落（Pattern 177b のような Null Duration 等）を特定する「比較診断」を体系化する。
3.  **Partial Integrity Warnings**: システム側が、一部のアイテムでのみ適用されなかったフィルタや警告を検知し、「10本中9本成功」といった粒度で報告する。

**UX Benefit**: 「時々壊れる」という最も信頼性を損なう不安定な挙動（Flakiness）を排除し、120% の品質基準を全ての成果物において保証します。
## 183. Inter-Process Sidechannel Injection (WYSIWYG State Handover)

In systems where a background renderer (worker) and an orchestrator (API) are loosely coupled via a shared database or JSON file, race conditions and "Schema Erasure" (e.g., Pydantic model overwrites) often cause the worker to fall back to default styles, breaking the user's creative intent.

### Pattern: The Snapshot Sidechannel
Instead of relying on the shared global state, inject the specific, ephemeral stylistic configuration (`telop_config`, `color_grade`, etc.) directly into the worker as an immutable snapshot.

1. **Isolation**: Capture the UI state at the moment of the trigger (e.g., "Approve").
2. **Dedicated Snapshot**: Save this state into a task-specific temporary file (e.g., `[task_id]_config.json`) rather than the project's main metadata file.
3. **Explicit Handover**: Pass the path to this file as a CLI argument to the worker process. The worker prioritizes this "Sidechannel" over the project's default state.
4. **Resilience**: This prevents "Pydantic Wipeouts" where a model-based save operation in the orchestrator accidentally deletes non-schema-validated dynamic fields from the main JSON.

**UX Benefit**: Guarantees 100% visual parity (WYSIWYG) between the preview and final export, eliminating "Style Drift" in multi-process asynchronous workflows.
2587: 
2588: ### **Technical Caveat: The Pydantic Wipeout**
2589: When the sidechannel data (e.g., `telop_config`) is injected into a JSON file that is also managed by a strict schema-validation library like **Pydantic**, any subsequent save operation using the model (e.g., updating a completion flag) will **erase** the injected data if it is not part of the model's formal schema.
2590: 
2591: - **Counter-Pattern: Post-Save Synchronization**: To resolve this, the process responsible for the status update must perform a **manual re-injection** of the sidechannel payload immediately after the schema-based serialization.


## 184. Semantic Coordinate Bridging (Pivot vs. Anchor)

In complex editing applications, a single numerical value (e.g., `x=540`) can have different semantic meanings depending on the software component handling it. A mismatch results in "Geometric Drift" where layout is broken despite data values being identical.

### Pattern: Absolute Intent Mapping
Explicitly normalize the "Reference Frame" and "Anchor Point" when transferring data between the Design Canvas (often Center/Pivot based) and the Physical Renderer (often Top-Left/Anchor based).

1. **Semantic Awareness**: Code that consumes coordinates must explicitly check the *source* of the data to decide its interpretation. 
2. **The Bridging Formula**: If the Design Canvas uses center pivots and the Renderer uses top-left anchors, apply the normalization: `rendering_x = canvas_center_x - (rendered_width / 2)`.
3. **Registry of Origins**: Maintain a project-wide standard for where coordinates are measured from (e.g., 1080x1920 fixed canvas) to avoid resolution-drift.

**UX Benefit**: Eliminates the "Centering Paradox" where a user-centered element appears off-center in the final export, achieving 1:1 spatial fidelity.

## 185. Artifact Freshness Assertion (The Stale Result Trap)

In automated verification loops (FBL), agents often verify a fix by checking log files or debug artifacts. A "Success Hallucination" occurs when the agent reads a stale success artifact from a previous run, mistakenly believing a new fix is working.

### Pattern: Temporal Evidence Audit
Never trust success evidence unless its creation/modification timestamp strictly succeeds the start time of the verification operation.

1. **Pre-Operation Baseline**: Record the `last_modified` time of target artifacts (logs, filter scripts, temp videos) before triggering the fix.
2. **Strict Success Condition**: Evidence is only valid if `artifact_timestamp > trigger_timestamp`.
3. **Ghost Purging**: Ideally, physically delete known artifact paths (e.g., `/tmp/filter_debug.txt`) before starting the test to ensure that any remaining file is definitively a product of the latest run.

**UX Benefit**: Prevents "False Progress" where a bug appears fixed in logs but persists in the final binary, ensuring 120% quality through honest evidence.

## 186. Environment Asset Parity (Visual Registry Sync)

In high-fidelity creative tools, the UI (Design Canvas) often uses assets (fonts, icons, presets) that must be identically available to the Backend Renderer. A mismatch causes silent fallbacks (e.g., swapping "M PLUS 1p" for "Hiragino Sans"), leading to subtle layout shifts (Visual Drift).

### Pattern: Cross-Process Asset Mirroring
Synchronize available creative assets across all tiers of the application and enforce explicit failure reporting.

1. **Registry Synchronization**: Use a shared JSON registry or a synchronized `FONT_MAP` that maps UI font names to backend system paths.
2. **Proactive Warning**: If the renderer cannot find the exact asset requested by the UI, it must log a "Degraded Integrity" warning instead of silently falling back, allowing the verification loop to catch the discrepancy.
3. **WYSIWYG Enforcement**: Ensure that metrics-dependent calculations (like text width for centering) use the exact same font metrics in both the preview and the final renderer.
4. **The Whitelist Fallback Warning**: UI font-pickers often query the local OS or Google Fonts, providing a superset of what the server's `FONT_MAP` describes. If the server does not have a mapping for the selected font, it must not only fallback but also signal the "Style Degradation" to the user/audit-loop to prevent "Perfect Screen / Broken Render" scenarios.

**UX Benefit**: Guarantees that "what you see in the designer" is "what you get in the mp4," down to the specific typography and spacing.

## 187. Volatile State Restoration Audit (Refresh Integrity)

In high-fidelity Single Page Applications (SPAs), complex state (e.g., telop styles, timeline edits) is often maintained in volatile memory (React state). A page refresh flushes this state. If the user then triggers a backend action (e.g., "Approve"), the application may unintentionally send an empty or defaulted configuration if the state restoration logic is flawed.

### Pattern: Persistent State Hydration
Ensure that every critical frontend state has a clear "Source of Truth" and is reliably hydrated from the backend upon initialization.

1.  **Strict State Initialization**: On page load, the frontend must prioritize fetching the "Last Known Good" state from the backend (e.g., `project.shorts[i].telop_config`) before allowing user actions.
2.  **Volatile Guard**: Backend actions (POST/PUT) should include validation to prevent overwriting persistent data with empty or incomplete volatile snapshots (e.g., if `telop_config` is empty in the request, do not delete the existing backend config).
3.  **Visual Indicators**: If the state is lost or defaulted after a refresh, the UI must clearly indicate this to the user (e.g., showing a warning or requiring a re-selection) to prevent "Silent Data Loss."

**UX Benefit**: Prevents the "Refresh Regression" where a user's careful edits are lost or overwritten by a default style simply because the page was reloaded before an action was finalized.

## 188. Inter-Dependent Asset Synchronization (Compositional Coupling)

In complex editing UIs where "The Frame" (Design Template) and "The Content" (Telop Styles) are selected independently, a disconnected state leads to "Broken Composition" where text is styled correctly but positioned in a void or on an incorrect resolution.

### Pattern: The Container-Content Dependency
Ensure that related asset selections are treated as a unified composition task to maintain WYSIWYG integrity.

1. **Explicit Coupling**: If the "Content" (e.g., telops) relies on a specific "Container" resolution (e.g., 1080x1920), the UI should ideally link these selections or warn the user if a mismatch occurs (e.g., "Style 'Basic' is optimized for 9:16 templates").
2. **Atomic Transaction**: Backend actions (like "Approve") must bundle both `template_id` and `render_config` into a single transaction to ensure the renderer receives the complete context.
3. **Implicit Canonical Framing**: If a specific template is not selected, the renderer should still apply "Reference Frame Normalization" (Pattern 184) against a fallback canonical resolution (e.g., translating 1080p design coordinates to the current video resolution) to minimize visual breakage.

**UX Benefit**: Eliminates the "Bare Rendering" bug where a user selects a style and expects the full template result, but only gets the style applied to a raw, un-templated video.

## 189. The "Soft Hardcoding" Trap (Selector Fidelity)

フロントエンドのセレクタ（例：`useMemo` 内でのデータ変形）において、実データが欠落している場合に `textAlign: 'center'` などの固定値をフォールバックとしてハードコードしてしまうと、将来的にその属性がバックエンドから返されるようになっても、ハードコードされた値が優先されたり、不一致の原因になったりします。

- **Resolution**: セレクタ層で特定のスタイルを「決め打ち」せず、常に `(data.attr || DEFAULT)` 形式で実データを優先し、バックエンドのスキーマ進化に対応可能な柔軟性を確保する。

## 190. Unified Snapshot Submission (Persistence Integrity)

テロップの分割やテキスト編集など、構造的な変更を含むデータを保存する際、スタイル属性（`telop_config`）と構造属性（`timeline`）を別々に保存しようとすると、タイミングのズレやシリアライズの衝突により片方が消失するリスクがあります。

- **Resolution**: 保存アクション（Approve等）において、その瞬間の「全ての編集済みコンテキスト」を一つの巨大なスナップショットとして送信し、バックエンドでアトミックに保存する。

## 191. Approval Context Preservation (Optimistic UI Guard)

バックエンドへの保存リクエストを投げた直後、サーバーからの最新データ取得（Re-fetch）が完了する前にページが更新されたり状態が変わったりすると、ユーザーが編集した内容が一時的に「古い状態」に戻って見えることがあります。

- **Resolution**: リクエスト送信後に、送信した「最新のスナップショット」をフロントエンドのローカルステート（React state 等）にも直ちに反映し、バックエンドの保存完了通知を待たずに UI の一貫性を保証する。これにより、「保存ボタンを押した瞬間にテロップが元に戻る」といった不信感を防ぐ。

## 192. Verification Resilience Audit (The Loop Closure Pattern)

「修正しました」という報告に対し、ユーザーから「変化なし（No Change）」と突き返される現象は、開発者エージェントにとって最も深刻な「検証の敗北」です。これを防ぐための、主観（ログ）に頼らない客観的検証プロトコル。

- **The Verification Gap**: 修正を加えたコードの「実行ログ」が正常（Success）であっても、ユーザーが見ている「最終成果物（動画の見た目）」や「ページ更新後の状態」が古いままなら、その修正は市場価値ゼロです。
- **Resolution: browser_subagent Verification**:
    1. **Live State Inspection**: `browser_subagent` を使用し、UI 上で「実際に編集が可能か」「編集後の state が API リクエストに正しく乗っているか」を Network タブで監視する。
    2. **Artifact Parity Check**: レンダリングされた動画のスクリーンショットを撮り、プレビュー画面のスタイル（フォント色等）と、FFmpeg レンダラーが出力したログ（RGBA値）を「突き合わせ」する。
    3. **Lifecycle Persistence Test**: ページをリロードし、`localStorage` や API からの再取得後も「編集内容が残っているか」を自動検証する。
- **Case Study (Visual Conflict)**: フロントエンドのプレビューが「白」であるのに対し、バックエンドの FFmpeg ログが「オレンジ」を出力しているのを `browser_subagent` で検知。この「色の不一致」が、ステート保存ロジックの不備（Pattern 244）を証明する決定打となった。
- **Benefit**: エージェントが「成功した」と思い込む **Positive Bias** を排除し、ユーザーの手元に届く価値を 120% 保証する。

## 193. Traceable State Injections (Lifecycle Verification)

「保存ボタンを押した直後にデータが元に戻る」といった、非同期ライフサイクルにおけるサイレントなデータ消失を検知するための、データドリブンな検証パターン。

- **The Problem**: 複雑な SPA において、ステートは「API 送信時」「レスポンス受信時」「定期的なポーリング（Refetch）」といった複数のタイミングで上書きされます。単に「テキストが残っているか」をチェックするだけでは、偶然の一致やキャッシュによる誤認を招く可能性があります。
- **Resolution: Unique Trace Strings**:
    1. **Injection**: 編集対象のフィールドに、`TRACE_MARKER_001` や `USER_EDIT_CONFIRMED` といった、元のデータには絶対に含まれないユニークな文字列（マーカー）を挿入する。
    2. **Trigger**: `Approve` や `Save` などのライフサイクルイベントを発火させる。
    3. **Lifecycle Audit**: イベント完了後、数秒待機（またはページリロード）してから、そのマーカーが依然として存在するかを自動検証する。
- **Benefit**: マーカーが消失した場合、それは「ステートの上書き」または「永続化の失敗」を意味する客観的な証拠となります。これにより、エンジニアリングチームはログを深追いする前に「何かが壊れている」ことを即座に確信できます。
- **Warning: Post-Verification Cleanup & Fragmentation**: 
    1. **Persistence**: 検証に使用した `FIXED_TEST` などのマーカーは永続化されるため、検証完了後は速やかに手動またはスクリプトで破棄し、プロジェクトデータの整合性を保つ必要がある。
    2. **Fragmentation**: マーカーを含んだまま「セグメントの再分割（Resplit）」などを実行すると、`FIXED` と `_TEST` のようにマーカーが複数のセグメントに泣き別れ（Fragmented）することがある。この場合、単純な文字列一致ではなく、正規表現による一括クリーンアップが必要となる。

## 194. The Loopback Synchronization Paradox (Atomic Guard)

保存リクエスト（`Approve`）を投げた直後に、サーバー側で古い `project.json` がまだ残っているタイミングでフロントエンドが「再取得（Refetch）」を走らせると、フロントエンドが送信したばかりの最新データが、サーバーから返ってきた「古いデータ」によって上書きされてしまう問題。

- **Insight**: 分散システムにおいて、「最新の書き込み」と「最新の読み取り」が整合するには時間がかかる（Eventual Consistency）。
- **Case Study (Partial Context Overwrite)**: `Approve` リクエストにおいて「スタイル」のみを送信し、サーバー側で「コンテンツ」が古いままの状態からレンダリングが開始されると、その後のステート更新（Refetch）によって、フロントエンドに残っていた「未送信の編集済みコンテンツ」が、サーバー側の「古い確定データ」によって上書き（リセット）されてしまう。
- **Resolution**: 保存アクション中は「UI ロック（編集不可）」にするだけでなく、保存完了後にサーバーから返ってくる「確定した最新データ」を受け取るまでは、ローカルの変更済みステートを破棄せず保持し続ける。また、常に **Unified Snapshot (Pattern 190)** を送信し、サーバーとクライアントの「一部だけ違う」という状態を排除する。
- **Backend Responsibility (Loop & Patch)**: バックエンド側でも、受信したスナップショットで既存のオブジェクトを丸ごと上書きするのではなく、必須フィールド（ID等）を保持しながら特定のプロパティのみをマージする「Loop & Patch Strategy（Pattern 250）」を徹底することで、スキーマ整合性とデータ永続性を両立させる。

## 195. The Evaluation Reset (Redo Intent)

AI による生成物の評価（Good/NG）を伴うワークフローにおいて、一度下した評価を取り消し、未評価の状態に戻すための「Retry/Undo」機能。

- **The Problem**: ユーザーは瞬発的に評価ボタン（Good/NG）を押すが、その直後に「やっぱりもう少し細かく調整したい」あるいは「今の評価は間違いだった」と考える。評価が「確定（Finalized）」として扱われ、UI がロックされたり自動的に次のアイテムへ遷移したりすると、ユーザーは自分のミスを修正できず、システムへの不信感につながる。
- **Resolution**:
    1. **Retry/Undo Button**: 評価済み状態の横に「Retry」または「Reset」ボタンを配置し、評価メタデータをクリアして再編集可能な状態に戻す。
    2. **Local state Reversion**: ボタン押下時に、ローカルの `status` プロパティを `DRAFT` や `PENDING` に戻し、UI のアクション（編集ボックス等）を再度有効化する。
    3. **Downstream Invalidation (Critical)**: レンダリングを伴うパイプラインでは、`Approve`（承認）によってリソースが「確定」されるが、Retry はこの承認状態も無効化（Revoke）する必要がある。これにより、ユーザーは誤り（検証マーカーの残留等）を修正した後に、**再度 Approve を押してレンダリングを再実行**することが可能になる。
    4. **Backend Sync**: 非同期でサーバー側の評価フラグをクリアし、AI の学習データや最終出力バッチから除外（または再分類）されるようにする。
- **UX Outcome**: 評価プロセスにおける「手戻り」を許容し、なおかつ最終成果物（動画）の品質に問題があった場合の「修正→再出力」のパスを確保することで、システムの柔軟性と信頼性を最大化する。

## 196. Progressive Approval Lifecycle (Action-Fidelity Mapping)

高機能ダッシュボードにおいて、ユーザーの「ソフトな評価（フィードバック）」と「ハードな承認（プロセス実行）」を明確に区別し、それぞれの期待値に応じた UI フィードバックを提供するパターン。

- **Pattern Components**:
    1.  **Exploratory Phase (Edit)**: 編集内容が逐次保存され、プレビューに反映される。
    2.  **Qualitative Phase (Good/NG)**: ユーザーが生成物の質を AI に伝える。この時点では「後戻り」は容易。
    3.  **Executive Phase (Approve)**: 実際にリソース（CPU/GPU/時間）を消費するレンダリング段階。このフェーズへの移行には、データの整合性（Pattern 250）と副作用の明示が必要。
- **UX Rules**:
    - **No Auto-Advance**: 評価（Good/NG）ボタンを押しても、勝手に次のアイテムに遷移させない。ユーザーが「微調整してから承認する」という自由度を確保するため。
    - **Re-triggerability**: 承認後であっても、Retry によって Executive Phase を巻き戻し、再度承認（Re-render）を行えるようにする（Downstream Invalidation）。
- **Benefit**: ユーザーは「評価」と「編集」を自由に行き来でき、最終的な「承認」という重いアクションを、100% の確信を持って実行できるようになる。

## 204. ZIP-Bundled Collective Export (The "Project Package" Flow)

In high-fidelity production tools, exporting multiple heavy artifacts (e.g., rendered videos) individually causes "Popup Fatigue," creates cluttered local folders, and often triggers browser security blocks.

### Pattern: The ZIP-Encapsulated Handover
Instead of writing to a local directory (which suffers from `showDirectoryPicker` permission restrictions on system folders), bundle all assets into a single ZIP archive on the client-side and prompt for a single save location.

1.  **Atomic Gathering**: Use a library like `JSZip` to fetch all deliverables (as blobs) and add them to a virtual archive.
2.  **Single Commitment**: Use `showSaveFilePicker` to prompt the user for a single ZIP destination. This bypasses the security errors often encountered when trying to access root/system directories with folder-level write permissions.
3.  **Fallback Resilience**: Provide a standard `<a>` tag download for the ZIP blob if the File System Access API is unavailable.
4.  **UX Reinforcement**: Show a unified progress bar (e.g., "Bundling 12 items...") to manage user expectations during compression.

**UX Benefit**: Provides a professional, "One-Click" archiving experience. The user receives a clean, project-labeled package (e.g., `shorts_job_87f2.zip`) rather than a scattered list of files in their generic Downloads folder.

**Implementation (Short Reviewer Success)**:
```tsx
const handleBulkExport = async () => {
    const zip = new JSZip();
    let addedCount = 0;

    for (const id of approvedIds) {
        const res = await fetch(url);
        if (!res.ok) continue; // Skip missing or failing assets
        const blob = await res.blob();
        zip.file(`${id}.mp4`, blob);
        addedCount++;
    }

    if (addedCount === 0) return alert("Nothing to export.");

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    // Use the ACTUAL successfully bundled count for the filename
    const suggestedName = `project_${addedCount}items.zip`;
    const handle = await window.showSaveFilePicker({ suggestedName });
    const writable = await handle.createWritable();
    await writable.write(zipBlob);
    await writable.close();
};
```

5.  **Outcome-Based Counting**: In a distributed pipeline, an item marked as "Approved" doesn't always translate to an immediate "Accessible File" (e.g., render delay).
    - **Actual vs. Target**: The final artifact (ZIP filename) should reflect the **actual number of files packaged**, not the target number selected. This prevents user confusion ("Why does the name say 4 files but there are only 2 inside?").
    - **Validation Alert**: If the `addedCount` is significantly lower than the `targetCount`, provide a clear status message: "2 of 4 items exported. Please ensure all items are finished rendering."

6.  **Pattern 206: CORS Sidechannel Guard for Bulk Exports**:
    - **Problem (The CORS Silence)**: When using `fetch` or `XHR` for bulk asset bundling (e.g., via `JSZip`), browsers may block specific requests due to CORS policy even if the origin appears allowed. This often results in a "Missing File" in the final bundle without a clear UI error (Pattern 203).
    - **Range Header Pitfall**: Large media files often trigger **HTTP 206 (Partial Content)** requests with `Range` headers. 
    - **Resolution (Enhanced Backend Middleware)**:
        - **Allowed Methods**: Must include `OPTIONS` and `GET` (for preflight and actual fetch).
        - **Allowed Headers**: Must explicitly include `Range`. Without this, browsers cannot request specific byte ranges for large videos.
        - **Expose Headers**: Must include `Content-Length`, `Content-Range`, and `Accept-Ranges`. If these aren't exposed, the browser's `fetch` API might treat a `206` response as an opaque or failed request, leading to empty blobs or restricted access.
        - **Context Sensitivity**: Apply CORS headers to **Static File Mounts** specifically. Standard app-level middleware (like FastAPI's `CORSMiddleware`) sometimes processes static file responses differently depending on how they are mounted.
    - **Verification**: Use a browser subagent or manual DevTools check to confirm that **all** requests in the bundling loop return `200` or `206` with the correct `Access-Control-Allow-Origin` and `Access-Control-Expose-Headers` headers.

## 207. Export Outcome Visibility (Pattern 247/249 Extension)

一括エクスポート機能（ZIPダウンロード等）において、ユーザーが「実際の処理結果」を物理的な成果物から直感的に把握できるようにするパターン。

- **The Problem**: 4件選択してエクスポートした際、バックエンドでのレンダリング未完了やネットワークエラーで2件しかZIPに含まれなかった場合、ユーザーは不完全な成果物を納品してしまうリスクがある。
- **Implementation (Step 445-485)**:
    1. **Dynamic Filename Counting**: 保存時のファイル名に実際の成功数を動的に反映（例: `videdit_export_2_of_4files.zip`）。
    2. **Reflective Success Mapping**: JSZip への追加成功時にカウントを行い、期待数と一致しない場合はダウンロード完了後にトースト通知で具体的に「2/4件が完了。他はレンダリング中」等の詳細を提示する。
- **Benefit**: ユーザーが中身を確認する前に「不備」に気づくことができ、納品ミスを防ぐガードレールとなる。

## 208. Standardized Background Import Protocol (Pattern 250)

`subprocess.Popen` 等で実行される独立したバックグラウンド・ワーカースクリプトにおける、インポートの堅牢性を保証するパターン。

- **Problem**: ワーカースクリプト（`render_worker.py`）内で `from config import settings` のような「トップレベル/相対」なインポートを使用すると、実行時の `PYTHONPATH` やカレントディレクトリの状態によって `ModuleNotFoundError` が発生し、レンダリングが即座に失敗する。
- **Requirement**: ワーカー内では常にプロジェクトルートからの絶対パス形式（`from core.config import settings`）を使用し、メインプロセスと同一の環境コンテキスト（`sys.path.insert(0, backend_path)`）を保証する。

## 209. Diagnostic Render Guard (Pattern 251)

外部レンダリングエンジン（FFmpeg等）の「サイレントな失敗」を、複数のシグナル（Exit Code, stderr, File Size）で二重検証するパターン。

- **The Problem**: FFmpeg はフィルタアセットの読み込み失敗や書き込みエラーが発生しても、特定の条件下で `Exit Code 0`（成功）を返す「成功の幻覚」を起こすことがある。
- **Resolution**:
    1. **Full Trace Capture**: `stderr` をサイレントにせず、常にキャプチャしてログファイル（`*_error.log`）に保存する。
    2. **Binary Integrity Check**: 出力ファイルの有無だけでなく、ファイルサイズ（例: 10KB以上）を検証し、極端に小さい場合は「破損」とみなしてタスクを `FAILED` に遷移させる。
    3. **Keyword Scanning**: stderr 内の `Error`, `Failed to open`, `Invalid data` 等のキーワードを検知して診断ログを生成する。

## 210. Post-Persistence Sidechannel Sync (Pattern 252)

Pydantic モデルなどの厳格なスキーマベースの ORM/永続化処理において、スキーマ外の動的データ（Sidechannel Data）が消失（Strip）するのを防ぐ強制同期パターン。

- **Problem (The Pydantic Exclusion Trap)**: `save_project(project)` を実行した際、`teleop_config` のような「スキーマ定義には含まないが物理的な JSON には残しておきたい一時的なフィールド」が、シリアライズ時に除外・上書きされ、その後のレンダリングでスタイルが失われる。
- **Solution**:
    - **Physical Proxy Write**: `save_project` で標準フィールドを保存した直後に、OS レベルで JSON ファイルを直接開き、特定のサイドチャネルデータを物理的に再注入（Patch）して再保存する。
- **Benefit**: システム全体のスキーマを汚染することなく、特定のレイヤー（レンダリング工程）で必要な動的メタデータの永続性を 100% 保証できる。

---
## 49. Mandatory Configuration Fallback (The Safety Net - Pattern 254)

高度な設定（`telop_config` 等）を必要とするアクションにおいて、ユーザーが明示的に設定を行わなかった場合や、永続化レイヤーのデータが欠落している場合に、アクションの実行直前で最低限の機能美を維持した「デフォルト設定」を動的に生成するパターン。

- **The Problem**: 複雑なサブエディタ（TelopDesigner等）を介してデータを生成する際、ユーザーがそのサブエディタを一度も開かずに「承認（Approve）」や「エクスポート」を押すと、送信される設定が「空（0 items）」になり、最終成果物（動画）から主要な視覚要素が消失する。
- **Implementation (Step 380-430)**:
    1. **Triple-Pronged Resolution**: 設定値の決定に優先順位を設ける。
       - Priority 1: 現在のインタラクション（メモリ上の新規設定）
       - Priority 2: 既存の永続化データ（ディスク上の保存値）
       - **Priority 3: 即席のデフォルト生成 (The Fallback Object)**
    2. **Payload Injection**: `telopConfigToSend` が空であることを検知した場合、システム標準の `id`, `fontSize`, `fill`, `shadow` 等を備えたオブジェクトを配列に注入する。
    3. **Transparency**: フォールバックが発動したことを `console.log` やトースト通知で記録し、デバッグ時に「意図的なデフォルト」か「バグによる欠落」かを即座に判別可能にする。

**UX Benefit**: ユーザーが全てのステップを熟知していなくても、システムが背後で「120% の完成度」を下支えするため、不完全な成果物（テロップのない動画など）が生成されるリスクを物理的にゼロにできます。

---
*Updated: 2026-02-06. Configuration Resilience Standard.*

## 47. Long-Running Action Feedback Loop (Pattern 312)

Notion連携やクラウドアップロードなど、完了までに数秒から数分かかる非同期アクションにおいて、ユーザーの不安を解消し、二重実行を防ぐためのパターンです。

### 1. Multi-Step Confirmation
破壊的な操作（ドラフト削除）や、環境設定が必要な操作の前に、具体的な影響範囲を箇条書きで示す `window.confirm` を使用します。

```tsx
const confirmed = window.confirm(
    `プロジェクト「${id}」をアーカイブしますか？\n\n` +
    `・ドラフトファイルが削除されます\n` +
    `・Google Driveにアップロードされます\n` +
    `・Notionにエントリが作成されます`
);
```

### 2. State-Driven Button Disabling
APIレスポンスを待機している間、以下の処理を同時に行います。
- **Label Switching**: 「Archive」から「アーカイブ中...」へテキストを変更。
- **Button Locking**: `disabled={isArchiving}` により再クリックを物理的に遮断。
- **Visual Feedback**: 透明度を下げる (`opacity-50`) ことで、処理中であることを視覚的に伝える。

### 3. Native Result Delivery
複雑なトースト通知を実装する前に、OS標準の `window.alert` を用いて、生成されたリンク（Google DriveのURL等）を確実にユーザーへ届けます。これは、ダッシュボードが再読み込みされても通知が消えない（同期的な停止を伴う）ため、重要情報のバックアップとして機能します。

**UX Benefit**: 「ボタンを押したが反応がない」「裏で何が起きているかわからない」といった不透明性を排除し、完了までユーザーの注意を適切に拘束・保護します。
---
## 48. Strict Typing for API Resilience (Pattern 313)

FastAPI や Pydantic を使用した動的な API モデル定義において、実行時の `NameError` による起動失敗を防ぐためのインポート標準。

### 1. Explicit `typing` Member Imports
Python 3.9+ で `list` や `dict` がジェネリクスをサポートしたとしても、Pydantic v2 や FastAPI のリクエストバリデーション層では、明示的な `typing.List` や `typing.Optional` のインポートが期待されるケースがあります。
- **Standard**: `from typing import List, Optional, Dict, Any` を必須の定型文として含める。
- **Benefit**: サーバー起動時の `NameError: name 'List' is not defined` を回避し、ポータブル環境での CI/CD やローカル開発の「再起動耐性」を高める。

### 2. Startup Guard & Crash Detection
`uvicorn` のリローダーモード運用時、構文エラーやインポートエラーは「ファイル保存直後」に検出されます。エージェントは変更後に必ず `api.py` のインポート正常性を確認し、サーバーログの `Uvicorn running on...` メッセージを待機する必要があります。
