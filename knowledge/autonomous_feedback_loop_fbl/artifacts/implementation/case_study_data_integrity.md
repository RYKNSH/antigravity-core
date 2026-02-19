# Case Study: Silent Rendering Failure in Multi-Process Pipelines

This case study examines a critical debugging session (2026-02-06) that revealed how data serialization and branching logic can cause silent failures in complex media pipelines.

## 1. The Symptom
Videos were being rendered and successfully "completed" (reaching 100% progress and appearing in the download queue), but were **missing telops (subtitles)**. This was inconsistent: some shorts had telops, while others (specifically Short 2) did not.

## 2. Deep Debugging Strategy (120% Quality)

### 2.1 Artifact Inspection: Filter Complex Audit
Standard debugging (checking console logs) was insufficient because the `render_worker.py` ran as a detached process. The breakthrough came from inspecting the **FFmpeg filter script** and associated **PNG overlays** in the `temp/` directory.

- **Discovery**: For the failed render, the filter script and PNGs were outdated (from an earlier run), meaning the latest "successful" render cycle **was not executing the FFmpeg code path that generates overlays**.

### 2.2 Structural Discovery: The Chunking Trigger
Analysis of `renderer.py` revealed a recursive call to `_render_in_chunks`.
- **Finding**: Short 2 had 15 segments. The threshold for chunking was 10.
- **The Gap**: In the chunked path, the `template_id` was cleared to avoid per-chunk overhead, but the final concatenation step only applied the template background, **ignoring the timeline-specific telop overlays**.

### 2.3 Data Integrity: The Pydantic Property Trap
- **Finding**: The `EditSegment.duration` field was a Pydantic `@property`.
- **The Gap**: Properties are **not serialized to JSON** during cross-process transmission.
- **Result**: The rendering worker received `duration: null`, causing FFmpeg filters that rely on time offsets to silently fail or skip text rendering.

## 3. Corrective Patterns

1.  **Temporal Robustness (Pattern 177b)**: Never rely on calculated properties for cross-process data. Always calculate durations from the raw `start` and `end` timestamps at the point of use.
2.  **Cross-Deliverable Integrity (Pattern 182)**: When implementing optimizations like "Chunked Rendering", verify that the **entire feature set** (overlays, telops, audio effects) is preserved across the merge/concat stage.
3.  **Traceable Isolation**: detatched workers must maintain their own job-specific logs (`render.log`) within the project directory to allow for post-mortem analysis of silent failures.

## 4. The "False Positive" Fix & Worker Staleness
Initially, increasing the `CHUNK_SIZE` threshold from **10 to 50** and clearing `__pycache__` was thought to resolve the issue. However, subsequent FBL verification showed:
- **Short 1 (6 segments)**: SUCCESS (telops present).
- **Short 4 (11 segments)**: FAILURE (telops missing).

### 4.1 Discovery: Artifact Timestamp Mismatch
A critical diagnostic step revealed that even when the UI showed "100% Complete" at 11:52, the FFmpeg filter script in the `temp/` directory was still from **02:41**.
- **The Gap**: The detached worker process (`render_worker.py`) was either not picking up the code changes (despite cache clearing) or was failing so early that it didn't even write the filter file.
- **Outcome**: The "120% Quality" standard requires not just verifying the *final* file, but verifying the **chain of evidence** (intermediate build artifacts) to ensure the latest code path was actually traversed.

## 5. Corrective Patterns (Updated 2026-02-06)

1.  **Temporal Robustness (Pattern 177b)**: Never rely on calculated properties for cross-process data. Always calculate durations from raw `start`/`end`.
2.  **Cross-Deliverable Integrity (Pattern 182)**: Avoid "Threshold patches". Optimize the chunked rendering path to support all features (templates + telops) natively.
3.  **Traceable Isolation (Pattern 186)**: detatched workers must maintain their own job-specific logs (`render.log`) and their own timestamped artifacts to prevent "Invisible Stale-ness".
4.  **Artifact Timestamp Verification (Pattern 188)**: In multi-process pipelines, a "Success" status is only valid if the output file and intermediate filter scripts are newer than the job start time.
5.  **Runtime Telemetry Probes (Pattern 191)**: When worker logs are disconnected, inject explicit file-based logging (`with open("/tmp/debug.log", "a")...`) into the worker's target logic to verify the live runtime variables (e.g., `CHUNK_SIZE`, `draft_mode`, `telop_config` presence).

## 6. The Ultimate Discovery: Runtime Context Injection
To definitively solve the mystery of why Short 4 (11 segments) still failed after the CHUNK_SIZE fix, the team implemented a **Runtime Telemetry Probe**. By forcing the worker to write its internal state directly to `/tmp/render_worker_debug.log`, they could verify whether the worker was *actually* seeing the updated code or hitting a silent exception before FFmpeg invocation.

### Probe Failure as a Signal
In one iteration, the probe itself introduced a `NameError` (missing `datetime` import). While this caused the render to fail at 0%, the presence of this specific error in the JSON status file provided **100% confirmation** that the code change had reached the worker. This transformed a "failure" into a "successful probe," proving that the worker was no longer running stale bytecode but was indeed executing the newly injected (though buggy) logic.

## 7. Closing the Loop: Verification of Short 5 & Short 2
By iterating with the **Runtime Telemetry Probe**, the team fixed a `NameError` (missing `datetime` import) and successfully rendered Short 5. Further analysis of Short 2 (15 segments) using the enhanced probe revealed a critical data integrity insight:
- `CHUNK_SIZE` was correctly set to 50, bypassing the buggy chunked path.
- `telop_config` returned `False` (missing), but the probe confirmed that **100% of the segments (15/15) contained valid text content**.
- This narrowed the bug down from a "data loss" issue to a "rendering logic" issue: the renderer was correctly receiving the text but failing to apply the `drawtext` filter or failing to fallback to default styles correctly.

### Targeted Logic Probing
To isolate the failure further, the team injected a second, more granular probe inside `renderer.py` specifically at the entrance of the `drawtext` generation loop. The resulting log (`/tmp/renderer_debug.log`) showed:
- `ENTERING drawtext branch!`: This provided physical 100% proof that the rendering engine successfully identified the presence of text segments and entered the filter-generation logic. 

#### The Shadow Artifact Mystery
Despite the probe confirming the logical entry, the file timestamp for the filter script (`*_filter.txt`) in the expected temporary directory remained old. This led to **Pattern 198 (Path Shadowing & Redirection Audit)**: identifying that in complex or proxied environments, the "logical path" in code may be redirected or shadowed by stale processes, necessitating a verification of absolute runtime paths.

### Final Debugging Insight: Ephemeral Evidence
A final mystery—the disappearance of the FFmpeg filter script even after a "successful" render—was solved by identifying an explicit `unlink()` (delete) call at the end of the rendering function. This realized **Pattern 194 (Artifact Auto-Cleanup Awareness)**: in a complex pipeline, success often wipes away the evidence needed to verify *how* that success was achieved.

## 10. The PNG Ghost & FFmpeg Silent Failure
Even after resolving the bytecode staleness, a second layer of failure was uncovered. The FFmpeg filter script was correct and contained 15 `drawtext` filters, but the resulting MP4 still lacked telops.

### 10.1 Asset Mismatch Discovery
- **The Finding**: The filter script used `movie='/path/to/UUID.png'` to apply overlays. However, a manual `ls` on those specific UUID paths returned `No such file or directory`.
- **The Stale Cache Signal**: While the filter script was updated at **12:39**, the PNG files in the `temp/` directory were still from **02:41**. The renderer had generated a new filter script referencing new UUIDs, but failed to actually generate the corresponding PNG files on disk.

### 10.2 The Silence of DEVNULL
The primary reason this remained invisible was **Pattern 166 (Pipe Safety via DEVNULL)**. Because `stderr` was directed to `DEVNULL` to prevent deadlocks, FFmpeg's error message (`Failed to open /.../UUID.png`) was never logged or seen. 

### 10.3 The Exit 0 Trap
The most dangerous discovery was that FFmpeg returned an **Exit Code 0 (Success)** despite failing to load critical overlay assets. 
- **The Mechanism**: FFmpeg's filter graph is resilient; if a non-fatal filter (like a single `movie` input in a complex chain) fails to initialize, FFmpeg may skip that specific branch but continue to render the rest of the timeline as long as the primary video stream remains valid.
- **The Result**: A "successful" MP4 was produced, the worker reported "COMPLETED," and the system wiped the temporary logs, leaving no trace of the failure until manual visual inspection.
- **Learning**: **A process's exit code is a measure of execution completion, not content correctness.** 120% Quality requires active verification of internal filter state or post-rendering analysis of stderr logs.

## 11. Case Study: The Sticky Selection Paradox (Pattern 206)
 
This study (2026-02-06) highlights the danger of "In-Place Updates" in stateful systems, where the absence of a value is not treated as a command to clear it.
 
### 11.1 The Symptom
Users could select "None" in the UI for a template, but the final render would still use the *previously* selected template. 
 
### 11.2 Root Cause Discovery
By tracing the `approve_short` API call into the backend Orchestrator, the team identified a **conditional assignment** that lacked an `else` branch for clearing.
 
1.  **Logical Guard**: The code used `if template_id:` to apply changes.
2.  **State Persistence**: Since the object was loaded from a persistent store (`project.json`), the old `template_id` remained in memory.
3.  **Silent Inheritance**: The renderer, seeing a non-null `template_id` on the object, proceeded to apply the template composition graph.
 
### 11.3 Corrective Pattern: Explicit State Reset
120% Quality requires that selection UI states and backend processing states be perfectly synchronized.

- **The Resolution**: The backend `orchestrator.py` was updated to explicitly reset the state when an override is absent.
  ```python
  if template_id:
      target_short.template_id = template_id
  else:
      target_short.template_id = None  # Force reset
  ```
- **Verification**: UI tests must verify not only that "Selecting A works" but that "Selecting A then selecting None" correctly removes A from the final binary output.

## 12. Case Study: The Scaling Blind Spot (Pattern 209)

This study (2026-02-06) explores the mismatch between **Design-time Canvas** and **Runtime Resolution**.

### 12.1 The Symptom
Despite a working preview, exported videos (Shorts without templates) were missing telops. Investigation via `Runtime Telemetry Probes (Pattern 191)` confirmed that the `drawtext` filters were executing, but with coordinates like `y=1600`.

### 12.2 The Discovery
- **The Design Canvas**: The React UI uses a fixed 1080x1920 coordinate system for consistency.
- **The Runtime Reality**: A standard cropped Short (9:16) has a resolution of **606x1080**.
- **The Failure**: Applying `y=1600` to a video only `1080` pixels high resulted in "Invisible Success"—the filter worked, but the pixels were off-screen.

### 12.3 Corrective Pattern: Coordinate Scaling Parity
120% Quality requires that all design-time parameters be transformed based on the **Runtime Context**.
- **The Fix**: The renderer now calculates `scale_y = output_height / 1920` and adjusts all `y` and `fontSize` parameters before generating the FFmpeg filter chain.
- **The Ghosting Resolution**: Post-scaling verification revealed a **"Ghosting Artifact"**. Text was legible but visually "thickened" or doubled. Investigation revealed two active rendering paths (Legacy PNG Overlay + Direct Drawtext). The redundant legacy path was pruned.
- **The Template Overlap Resolution**: Subsequent testing with templates revealed a **Third Rendering Path**. Telops were being rendered both by the template's layer-composing logic and the standalone `drawtext` loop. This was resolved by implementing strict **Composition Priority (Pattern 213)**, guarding the standalone loop with an `if not blueprint.template_id` condition. Result: Pixel-perfect parity confirmed in both template and non-template modes.
- **The Success Hallucination (Pattern 215)**: A critical desync was identified where the agent reported "Success" after observing a video at a query-parameterized URL (`?fix_final_test`), but the user saw a full-screen video with no template. 
    - **Forensic Discovery**: Log analysis showed the `Orchestrator` applied the template to "Short #1" while the `RenderWorker` started "Short #0". This 0-vs-1 index drift meant the agent was validating a different (or stale) asset than the one actually being served to the user.
    - **Physical Existence Paradox (Pattern 216)**: Further investigation showed the agent's shell (`ls`, `ffprobe`) reported "No such file" for paths that the API successfully served (200 OK). This was traced to **URL-encoding desyncs** (Japanese characters) and the API's static mount persistence vs. shell path resolution on the external SSD.
    - **The Branch Hallucination (Pattern 217/218)**: Even after fixing indices, a "Silent Failure" occurred where a project JSON explicitly contained `template_id` but the video rendered full-screen. This necessitated **Trace-Driven Boundary Verification (Phase 33)**, injecting debug logs directly into the renderer's `if` branches.
    - **The Vanishing Trace Discovery (Pattern 219)**: Injected logs initially failed to appear in `backend.log` due to the **DEVNULL Trap**.
    - **The Resolution Probe (Pattern 220)**: `ffprobe` confirmed **1080x1920**, proving the template code was active but visuals were occluded.
    - **The Filter Graph Forensic (Pattern 221)**: By injecting a mandatory file dump (`/tmp/filter_debug.txt`), the team successfully extracted the generated FFmpeg filter chain, confirming the correct layer Z-order.
    - **The Cache Hallucination (Pattern 222)**: Despite the fix being verified on disk, the user reported no change. This was identified as browser cache, resolved by **Out-of-Band Frame Export (Phase 37)** (FFmpeg image extraction).
    - **The State Propagation Gap (Pattern 223)**: Final analysis revealed that while templates were applied, custom styles (e.g., "basic") were missing because `telop_config` was `None` in the persisted JSON, leading to **Status Persistence Audit (Phase 38)**.

## 13. Conclusion
"120% Quality" is achieved by recognizing that **Silence is Lying**. By auditing temporary build artifacts, injecting physical telemetry probes (Phase 33-36), and understanding the auto-cleanup lifecycles, the team transformed a brittle, multi-processed pipeline into any entirely traceable engine.

## 14. Case Study: The Centering Paradox (Pattern 238)

2026-02-06 に発生した、UI で「中央」を指定したテロップが、特定テンプレート適用時のみ「右寄り」に表示される現象。

### 14.1 The Hidden Offset Logic
調査の結果、`renderer.py` の CAPTION レイヤー処理において、x座標の計算式が固定されていたことが判明：
- **Formula**: `x = caption_x + (caption_width - text_w) / 2`
- **Context**: 
    - テンプレート定義（`caption_config`）では `caption_x` は「描画領域の左端（Offset）」を指す。
    - UI (`telop_config`) では `x` は「テロップの中心点（Pivot）」を指す。
- **The Collision**: UI の `x=540` (画面中央) をテンプレートの左端オフセットとして扱ったため、中央から右に大きくずれる結果となった（540 + α）。

### 14.2 Corrective Action: Coordinate Semantic Mapping (Pattern 238)
120% 品質のためには、**データの「数値」だけでなく「意味（Semantics）」**を座標系ごとに切り分ける。

- **Resolution (Branching Logic)**:
    - **UI Style Presence**: `x = center_x - text_w/2` (中心点ベースの配置。FFmpeg の `x=540-(text_w/2)` 式に変換)
    - **Template Only**: `x = x_offset + (width - text_w)/2` (領域内中央揃え)
- **Code Fix**: `renderer.py` 内で `if style:` 分岐を導入し、UI 由来の座標とテンプレート由来の座標で解釈を明示的に切り分けた。

### 14.3 Final Verification: Task 04220d2a
2026-02-06 14:54 に実施された **Browser Subagent** による自動テストにて、Task ID `04220d2a` が `COMPLETED` となり、テロップが意図通り画面中央（x=540）に、指定した「Basic (黄色 #ffc800)」スタイルで描画されていることを目視および FFmpeg フレームダンプで確認。

### 14.4 Residual Insight: Font Asset Parity (Pattern 239)
座標と色の不整合を解決した後、「フォント名の一致（M PLUS 1p）」が課題として残った。
- **The Discovery**: UI で指定したフォント名がバックエンドの `FONT_MAP` に登録されていない、またはシステムにインストールされていない場合、サイレントにデフォルトフォント（ヒラギノ等）へフォールバックし、文字幅の変化によるレイアウトの微妙なズレ（Visual Drift）を引き起こす。
- **Action**: UI 側で使用可能なフォントリストと、バックエンドの `FONT_MAP` を 1:1 で同期させる「Visual Registry Synchronization」が、将来的な 120% 品質維持に不可欠である。

### 14.5 Verification Trap: The Stale Artifact (Pattern 240)
修正後の検証フェーズにおいて、エージェントが「120% 品質」の基準を危うくする罠に遭遇した。
- **Symptom**: `renderer.py` を修正して再レンダリングを実行（Task `04220d2a`）した後、エージェントがデバッグログ `/tmp/filter_debug.txt` を確認したところ、修正前の古い FFmpeg フィルター式が表示されていた。
- **Initial Hallucination**: 一見すると「修正が反映されていない」ように見えたが、タイムスタンプを確認したところ、ログファイルは **14:48** のもので、現在の時刻（**14:56**）よりも 8 分間も古いことが判明。
- **Resolution**: 
    1. **Process Purge**: サブプロセスとして常駐していた可能性のある `render_worker` をキル。
    2. **Freshness Assert**: 旧ファイルの存在を無視し、最新の成果物ビデオ（`short_1.mp4`）が **14:56** に更新されていることを確認。
    3. **Ground Truth**: 物理ビデオから直接フレームをダンプし、修正（中央配置）が反映されていることを目視で確定。
- **Insight**: ログや中間ファイルは「消えないエビデンス」ではない。検証プロセスには必ず **Artifact Freshness Assertion (Phase 45)** を組み込み、タイムスタンプによる物理的な生存期間の検証を行わなければならない。

### 14.6 The Refresh Regression: Overwrite by Volatile Default (Pattern 241)

レイアウト修正（Pattern 238）の最終確認段階で、予期せぬ退行（Regression）が発生した。

- **Symptom**: 1回目の Approve（Task `04220d2a`）ではスタイルが適用されたが、検証用の再実行（Task `8e2d49e6`）では、テロップが「白色」に戻り、テンプレートも適用されない状態になった。
- **Diagnosis**: バックエンドログの差分分析により、2回目の Approve リクエストには `telop_config` が含まれていなかったことが判明。
    - **1st Approve**: `INFO:api:[Approve] Received telop_config with 1 items` ✓
    - **2nd Approve**: (該当ログなし) ✗
- **The Stale State Trap**: 
    1. テスト手順の中でブラウザの **ページリフレッシュ** を実行。
    2. Frontend (React) のメモリ内にある `telops` ステートが消失し初期化された。
    3. `page.tsx` の `handleApprove` が、「空の telops」または「未取得の telop_config」をそのままリクエストとして送信。
    4. バックエンド側で、既存の正しい設定が空のデータでサイレントに上書きされた。
- **Resolution**: Frontend において、ページ更新直後でもバックエンドの永続化データから確実にステートを復元する（Hydration）ロジックの強化と、空のステートによる上書きをバックエンド側でガードするバリデーションが必要。
- **Insight**: **Refresh-Resilience Audit (Phase 46)** は、不安定な通信環境や開発中の再読み込みが頻発する SPA において、データ整合性を守るための最終防衛線である。
