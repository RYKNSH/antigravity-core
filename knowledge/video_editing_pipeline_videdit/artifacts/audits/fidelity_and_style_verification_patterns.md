# Videdit Fidelity & Style Verification Patterns

This document defines the advanced verification patterns established during the Feb 2026 audits to ensure 100% fidelity between the React-based Telop Designer (Preview) and the Python/FFmpeg-based Render Engine.

## 1. Pattern 242: Compositional Coupling (Style-Template Parity)
Ensures that telop style overrides (font, size, weight) and template-specific settings (background alpha, stroke width) are strictly coupled and serialized.

- **The Problem**: Changes in the Designer's "Style" panel sometimes fail to propagate to the "Template" selection, leading to a preview that looks correct but renders with default template colors.
- **Verification Protocol**:
    1. **Style Injection Audit**: Verify that `telop_config` contains both `style_overrides` and `template_id`.
    2. **Cascading Resolution Check**: Ensure the Render Engine resolves `style_overrides` *after* applying the template defaults.
    3. **Serialization Proof**: Export a JSON configuration and re-import it; the visual output must be identical across page refreshes (linked to Pattern 241).

## 2. Pattern 243: FFmpeg Style Fidelity Mapping (Attr Mapping)
Defines the mapping between CSS-like style attributes (shadow, opacity, multi-stroke) and FFmpeg `drawtext` filters.

- **The Problem**: FFmpeg's `drawtext` has limited support for complex styling like internal shadows or multi-stage strokes.
- **Mapping Standard**:
    - **Shadow**: Maps `shadowOffset` and `shadowBlur` to `shadowx`, `shadowy`, and `shadowcolor`. Note: FFmpeg's shadow is hard-edged; for soft shadows, use the "Box Blur" pre-overlay filter.
    - **Stroke**: Maps `strokeColor` and `strokeWidth` to `borderw` and `bordercolor`.
    - **Opacity**: Use a global `alpha` multiplier rather than per-color RGBA to ensure consistency across stacked layers.
- **Verification**: Execute a `Preview vs. Render` visual diff (side-by-side) to ensure alignment within a <2% color variance.

## 3. Pattern 244: Temporal Sync Assertion (Timeline Integrity)
Ensures that the rendered video's telop transitions match the timeline timestamps precisely.

- **The Problem**: Frame rate drift (30fps vs 29.97fps) or asynchronous processing lag can cause telops to appear/disappear one to three frames off target.
- **Audit Procedure**:
    1. **PTS Alignment Check**: Verify the `enable` filter's `between(t, start, end)` matches the project `timeline` data.
    2. **Zero-Frame Jitter Probe**: Render a test file with a 1-second burst telop; verify its entry and exit frame in the exported MP4 using `ffprobe`.
- **Outcome**: Ensures a "tight" feel where text and visual transitions are frame-locked.

## 4. Pattern 303: Range-Aware CORS Integrity (Export Protocol)
Ensures that static media files (MP4) can be reliably downloaded via browser proxies or JS frameworks (JSZip) even when the browser initiates Range-based chunk requests.

- **The Problem**: Browser `fetch` calls for large video files during ZIP packaging can trigger `HTTP 206 (Partial Content)` requests. If the backend CORS middleware doesn't explicitly expose `Content-Range` or `Accept-Ranges`, the browser may block the response, causing "missing files" in the exported ZIP.
- **Verification Protocol**: 
    1. **Header Inspection**: Verify `Access-Control-Allow-Headers` includes `Range` and `Access-Control-Expose-Headers` includes `Content-Range, Accept-Ranges, Content-Length`.
    2. **Multi-Chunk Fetch Audit**: Trigger a JSZip export and verify in the Network tab that `HTTP 206` responses are status OK and the blob is correctly reconstructed.

## 6. Pattern 307: Multi-Process Render Integrity Verification (Subagent Audit Loop)
Ensures that files marked as `COMPLETED` are physically valid and match the design intent by auditing codec, resolution, and binary size post-render and post-download.

- **The Problem**: FFmpeg may produce files that are "readable" by VLC but "corrupted" for QuickTime, or 0-byte ghosts that appear "successful" in logs.
- **Verification Protocol**:
    1. **Codec & Binary Audit**: Use `ffprobe` to verify `h264/yuv420p` and a physical size > 1MB.
    2. **Dimension Logic Check**: Verify dimensions (e.g., 606x1080) match the 9:16 crop or 1080p template logic.
    3. **Blob Size Parity**: During ZIP export, verify that the browser-downloaded blob size matches the backend file size to 100% precision.

## 7. Pattern 252: Post-Persistence Sidechannel Sync (Wipeout Guard)
Protects dynamic data (like `telop_config`) from being erased by Pydantic's `model_dump()` during job status updates.

- **The Problem**: Pydantic models often strip fields not explicitly defined in the schema. When `save_project()` is called to update a status to `COMPLETED`, it can inadvertently wipe existing `telop_config` from the JSON.
- **Verification Protocol**:
    1. **Sidechannel Audit**: Immediately after a project save, read the raw JSON file from disk to verify the `telop_config` key exists and contains data.
    2. **Atomic Re-Injection**: If data is missing, the worker must re-inject the configuration from its memory state into the physical file.

---
*Verified: 2026-02-06. Global Videdit Fidelity 120% Assertion.*

## Appendix: Summary of Feb 2026 Fidelity Audit

### Identified Discrepancies
1. **Temporal Relativity**: Preview uses `timelineOffset` for 0:00 relative time, while Backend managed `current_output_time`. Fixed via `enable='between(t, start, end)'` with standardized segment references.
2. **Style Fallback Hierarchy**: Standardized fallback order: `telop_config` -> `My Style (Store)` -> `Template Default`.
3. **Styling Parity**: Addressed gaps between CSS multi-shading and FFmpeg `drawtext` via filter chaining (Pattern 199).

### Implementation Results
- **RESOLVED**: Introduced `_resolve_font_path` and `_get_x_expression` in `renderer.py`.
- **Coordinate Parity**: Implemented dynamic `x` expressions to respect `textAlign` and designer-specified anchors.
- **Font Parity**: Unified font inventory between Telop Store and Backend `fonts.json`.

