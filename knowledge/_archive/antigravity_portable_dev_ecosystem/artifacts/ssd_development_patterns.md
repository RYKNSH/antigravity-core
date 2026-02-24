# SSD-Centric Development Patterns: Stability & Performance

Building complex applications (Video Pipelines, Tauri, AI Dashboards) directly on external SSDs—especially ExFAT formatted ones—introduces performance bottlenecks, thermal throttling, and OS-level metadata interference. This guide details the standard patterns for the Antigravity ecosystem to bypass these limitations.

---

## 1. The "Portable Factory" Philosophy
We treat the external SSD as a **Self-Contained Portable Factory**. It carries its own compilers (via `uv`), its own binaries (via `.bin/`), and its own knowledge base. The host machine provides only CPU, RAM, and a high-performance scratch volume (the internal APFS SSD).

- **Principle of Non-Interference**: Never allow host-side pathing or system libraries to bleed into the portable environment.
- **APFS Redirection Strategy**: Use the host's internal SSD for IOPS-heavy "hot" data (build targets, venvs) while keeping the source of truth on the portable SSD.
- **Dependency Weight Management**: Minimizing external dependencies (especially complex GUI or renderer frameworks like Remotion or heavy ML runtimes) is critical for portability. When refactoring, always ask if a feature can be implemented using standard binaries (FFmpeg) or leaner local scripts to reduce the "environment surface area" and initialization time.

---

## 2. Python Hermetic Environment (`uv`)

Standard Python installations often fail on ExFAT due to metadata mismatches. We solve this by managing Python as a local tool.

### 2.1 State Redirection (Venv Symlink)
To avoid ExFAT latency and AppleDouble corruption, create the virtual environment on the host's APFS volume and symlink it to the project root.

```bash
# Example bootstrap.sh logic
LOCAL_VENV_ROOT="$HOME/.antigravity/venvs"
PROJECT_ID="videdit-backend"
TARGET_VENV_PATH="$LOCAL_VENV_ROOT/$PROJECT_ID"
LINK_PATH="backend/.venv"

# Create venv on Host (APFS)
uv venv "$TARGET_VENV_PATH" --python 3.11

# Link to project (ExFAT)
ln -s "$TARGET_VENV_PATH" "$LINK_PATH"
```

### 2.2 Symlink Breakage & Recovery
If the SSD is moved to a new Mac, the symlink will break. The system should detect this and trigger a clean-start.
- **Recovery**: `rm -rf .venv && uv venv && uv pip install -r requirements.txt`

### 2.3 Binary Stack Management (Static Binaries)
For dependencies like FFmpeg, `demucs`, or `ffprobe`, use project-local static binaries in a `.bin/` directory. Resolve their paths relative to `sys.executable`.

```python
import sys
from pathlib import Path

# Guaranteed to hit the hermetic binary
ffmpeg_bin = Path(sys.executable).parent / "ffmpeg"
```

---

## 3. Build Redirection (Cargo & Turbopack)

### 3.1 Rust Build Redirection (`CARGO_TARGET_DIR`)
Compiling Rust on ExFAT is extremely slow. Always redirect the target directory to `/tmp`.

```bash
# Redirection prevents UTF-8 panics during Tauri 2 permission scans
export CARGO_TARGET_DIR=/tmp/project-target
pnpm tauri dev
```

### 3.2 Next.js & Turbopack Optimizations
- **Database Corruption**: If Turbopack fails with `Loading persistence directory failed: invalid digit found in string` or `Unable to remove invalid database`, it indicates a corrupted cache on ExFAT. 
- **Specific Error**: `[Error: Failed to check database invalidation and cleanup. Caused by: 0: Unable to remove invalid database. ... No such file or directory (os error 2)]`
- **Immediate Fix**: Run `rm -rf apps/dashboard/.next /tmp/next-*` immediately. Specifically, deleting `.next/dev/cache/turbopack` within the project root is often required if recursive deletion of `.next` fails due to metadata locks. This often occurs when the dev server is interrupted during a hot-reload or large I/O burst.
- **Persistence Errors**: SSD の低速な I/O や書き込み競合により、`Persisting failed: Another write batch or compaction is already active` や `Failed to restore task data (corrupted database or bug)` というパニックが発生することがある。
- **Recovery Protocol**:
    1.  **Process Kill**: `pkill -9 -f "next\|node"`
    2.  **Cache Purge**: `rm -rf apps/dashboard/.next /tmp/next-*` (プロジェクトルート)
    3.  **Fresh Execution**: `nohup pnpm dev </dev/null >/tmp/dashboard.log 2>&1 &`
- **Lock File Recovery**: Manually remove `apps/dashboard/.next/dev/lock` if the server fails to start after an abrupt disconnect.
- **Aggregate Cleanup**: Always purge `.next` before swapping PCs to ensure fresh hydration.
- **Port Reuse Recovery**: If `Address already in use` persists after a crash, use `lsof -ti :8000,:3000 | xargs kill -9` before the cache purge.
- **Monorepo Dependency Sync**: In monorepos, version mismatches across packages can lead to silent failures. Always run `pnpm update` or use `pnpm recursive update` to align versions across the workspace.

### 3.3 Media Processing Hot-Path Redirection (Copy-Process-Copy)
Heavy I/O operations like audio extraction (FFmpeg) or PSD parsing on ExFAT SSDs can cause kernel-level wait states (`UN` state). 
**Pattern**: Redirect the *entire* I/O hot-path to the host's `/tmp` (APFS).
1.  **Stage**: Copy input file from SSD to `/tmp/input`.
2.  **Process**: Execute target binary (FFmpeg, ImageMagick) with `/tmp/input` as source and `/tmp/output` as destination.
3.  **Commit**: Copy results from `/tmp/output` back to the SSD-resident project directory.
4.  **Cleanup**: Remorselessly purge `/tmp/*` assets.

### 3.4 Media Processing: FFmpeg Path-Robustness (-i Pattern)
FFmpeg's `movie=` filter is notoriously fragile when handling multibyte characters (Japanese) or NFD/NFC normalization mismatches on External SSDs. It often hangs or fails to open the file silently.
- **Pattern**: Always use the **Multi-Input (`-i`) Strategy**.
- **Implementation**: Instead of passing paths inside a `filter_complex` string, load all assets as separate `-i` arguments (e.g., `-i video.mp4 -i bg.png`) and reference them by stream indices (`[0:v]`, `[1:v]`) in the filter graph. This eliminates path-escaping and Unicode parsing issues within the filter string itself.

---

## 4. Watcher & Ingest Patterns

### 4.1 ⚡ Direct Ingest Trigger Pattern
Native OS watchers (inotify/FSEvents) are unreliable on ExFAT and network volumes. We use **Direct Triggers** instead of polling.
- **Implementation**: Call `orchestrator.submit_job(path)` directly inside the upload API handler or CLI ingest command.
- **Watcher as Fallback**: Use a background watcher only as a fallback for manually placed files, ensuring it filters out `._*` metadata files immediately.

### 4.2 Zero-Copy Ingest (Watch Folder)
For 10GB+ raw footage, avoid copying files through the API.
1.  **Watch Folder**: Define a folder like `/Volumes/PortableSSD/input`.
2.  **Metadata Ingest**: The orchestrator "claims" the file by creating a symlink or moving it into the project's internal `source/` folder.
3.  **Stability Check**: Verify the file size is constant for N seconds before starting heavy processing (transcription/rendering).

---

## 5. Network & Process Management

### 5.1 TTY Suspension & Nohup Detachment
When running servers or AI agents in the background (`&`) on an external SSD, the process often enters a `suspended (tty output)` state (SIGTTOU) when trying to write to `stdout`, rendering it unreachable.
- **Standard Protocol**: Use `nohup ... </dev/null >/tmp/app.log 2>&1 &` to decouple the process from the controlling terminal. This is critical for maintaining "Immortal Agent" uptime during long-form rendering tasks.

### 5.2 Network Resolution Strategy (IPv6 vs IPv4)
On many portable setups (especially with proxies or mobile tethering), `localhost` is resolved to IPv6 `::1`, but the backend binds to IPv4 `127.0.0.1`. This results in `Connection Refused` on the dashboard.
- **Pattern**: Always explicitly use `127.0.0.1` in the frontend fetch URLs and backend server configuration.

### 5.3 Port Cleanup (Address Already in Use)
SSD environments often crash or disconnect while servers are running, leaving zombie processes that occupy ports (3000, 8000, 1420).
- **Mandatory Kill-before-Start**: Standardize `lsof -ti:{port} | xargs kill -9 2>/dev/null` as part of the startup script or `pnpm run dev` task.

### 5.4 Automated Workspace Cleanup & Hang Mitigation
In environments with frequent process crashes or high I/O latency, implement a "Purge on Boot" protocol.
- **Backend Hangs (UN State)**: On ExFAT SSDs, heavy file operations (like PSD parsing or rendering) can put `uvicorn` or `python` into an interruptible sleep (`UN` state). If the server stops responding but the process is visible in `ps aux`, it is likely hung on a system call or a **Pipe Buffer Deadlock**.
- **Pipe Buffer Deadlock**: In SSD environments where media processing logs are voluminous, using `subprocess.PIPE` for `stderr` or `stdout` can cause an OS-level hang once the 64KB buffer is full. 
- **Residual Starvation**: Even after switching to `DEVNULL`, a "Silent Stall" (Negligible CPU usage after several minutes) can occur within the app context. This is caused by synchronous `subprocess.run` calls (even if threaded) entering kernel-level lock contention on high-latency I/O.
- **Recovery & Prevention (Pattern 170)**: Move from threaded execution to **Multi-Process Isolation** using a dedicated background worker script initiated via `subprocess.Popen`. This is superior to `multiprocessing.Process` on macOS, as it handles the "spawn" method's package visibility issues more reliably by creating a entirely fresh OS process. Use file-based IPC (status JSONs) to ensure state persists across worker boundaries and process restarts.
- **Pattern 171 (Dedicated Worker Infrastructure)**: 
    1. **Standalone Script**: Create a `worker.py` (e.g., `render_worker.py`) that acts as a CLI entry point.
    2. **Explicit Context Injection**: Resolve absolute backend paths in the parent and pass them as arguments to the worker.
    3. **Bootstrapping**: Manually inject the root into `sys.path` within the worker script *before* importing any internal modules to prevent `ModuleNotFoundError`.
    4. **Traceback Persistence**: Use `traceback.format_exc()` to log fatal errors to the IPC JSON status file, ensuring "Invisible" crashes in detached processes are diagnosable.
- **Initial Clean**: Clear `.next`, `.turbo`, and temporary rendering buffers (`/tmp/videdit_*`) as part of the session initialization (/checkin).

### 5.5 Direct Execution Benchmarking (The Gold Standard)
When a subprocess (FFmpeg, Whisper) appears stalled or fails with cryptic errors on an ExFAT volume, use **Direct Execution** to isolate the system layer.
- **Pattern**: Capture the exact command and arguments from logs and execute them directly in a native terminal environment.
- **Diagnostic Value**: If the command runs successfully in the terminal but remains stalled in the app (CPU Time ~0s), the issue is confirmed as **Subprocess Orchestration Starvation** (Thread pool saturation or synchronous wait contention) rather than a logic error in filters. This is the definitive check for "Silent Stalls."

### 5.6 Reload Drift & Hard Restarts
In development environments utilizing hot-reloading (Uvicorn, Next.js), high I/O latency can lead to **Reload Drift**.
- **Symptom**: Code changes are saved and the reloader triggers, but the active worker threads continue to use stale logic or the process enters a "Zombified" state where it survives the reload but stops responding to the event loop.
- **Pattern 169 (Multi-Worker Scaling)**: Launching with `--workers N` (e.g., 4) effectively creates multiple event loops. This ensures that even if one worker's event loop is blocked by a kernel-locked I/O wait, other workers remain available to the OS scheduler and the API gateway.
- **Standard Protocol**: During core media-pipeline debugging, **disable --reload** and use **Multi-Worker Scaling** to maximize process-level isolation and stability. Supplement with a manual `kill -9` restart strategy to ensure the process memory is entirely fresh.

### 5.7 Pattern 172: The 200 OK Paradox (Path Resolution Desync)
In SSD-based portable environments, a "Success" in the browser/API layer (200 OK) can coexist with a "FileNotFound" in the shell/CLI layer on the *same apparent absolute path*.
- **The Symptom**: Browser displays `http://localhost:8000/projects/A/short_1.mp4` correctly, but `ls /Volumes/PortableSSD/.../A/short_1.mp4` returns "No such file or directory".
- **Root Cause**: 
    1. **URL Encoding Mismatch**: Project names with Japanese characters or spaces may be URL-encoded in the API logs/URLs but non-encoded in the shell. 
    2. **Static Mount Persistence**: The web server's static mount may have a handle to a file that was deleted or moved, but still served from buffer/cache, or the mount point shifted while the server was running.
    3. **Volume Mount Lag**: macOS occasionally lazily mounts subdirectories or handles symlinks inconsistently across different process contexts.
- **Verification Protocol**:
    - **Physical Existence First**: Use `find {mount_point} -name "*short_1.mp4"` to locate the file's *actual* current position rather than assuming the code's path projection is correct.
    - **In-App Probe**: Inject `os.path.exists()` logs into the API handler *just before* the response is sent to verify what the web-process sees vs what the developer-process sees.

### 5.8 Pattern 173: Next.js/Turbopack "Invalid Digit" Resilience
In some Next.js/Turbopack versions, local state persistence (often using an embedded database like PGLite) can become corrupted on ExFAT volumes, leading to `invalid digit found in string` errors during boot.
- **Root Cause**: Incomplete write batches during hot-reloads or aborted sessions on high-latency I/O.
- **Deep Clean Protocol**: If `rm -rf .next/cache` is insufficient, perform a **Project-Level State Purge**:
    1.  `rm -rf .next` (Total deletion of build artifacts)
    2.  `rm -rf node_modules/.cache`
    3.  `pnpm install --force` (To ensure native bindings and lockfile integrity)
    4.  `next dev --turbo --clear` (If available) or just `next dev`.

### 5.9 Pattern 174: Symlink Venv Integrity Validation
When using symlinked venvs (Pattern 2.1), the project-root `.venv` behaves like a file but refers to a path on the host. If the host-side venv is deleted or moved, `source .venv/bin/activate` fails with "No such file or directory".
- **Symptom**: `ls -l .venv` shows a valid link visually, but the target is missing.
- **Verification**: Always run `[ -d .venv/bin ]` or `readlink -f .venv` to verify the underlying directory is actually reachable before attempting to activate.

---

## 6. Recommended Environment Variables
Set these in your `~/.zshrc` or project-specific `.env`:
- `UV_LINK_MODE=copy`: Essential for cross-filesystem moves.
- `COPYFILE_DISABLE=1`: Prevents resource fork creation during `cp`.
- `PYTHONDONTWRITEBYTECODE=1`: Keeps the SSD clean of `__pycache__`.
- `CARGO_TARGET_DIR=/tmp/your-project`: Moves build heat to internal storage.
- `env_file="/tmp/your-project.env"` (Application level): Forces environment library to read from a reliable APFS-backed location.

---

## 7. Configuration Strategy: Cascading .env Discovery

Standard environment loading libraries can exhibit non-deterministic behavior when reading `.env` files directly from ExFAT partitions. Furthermore, `/tmp` is cleared on reboot, leading to silent API failures (e.g., Whisper 401 Unauthorized). 

The **Cascading Discovery** pattern ensures persistence across reboots while maintaining portability.

### 7.1 Discovery Logic (Python/Pydantic)
Prioritize persistent, host-secure locations over SSD-resident or temporary ones.

```python
def _find_env_file() -> str:
    """
    Find the most reliable .env file in order of priority:
    1. Host-relative secure (~/.secrets/antigravity/.env) - BEST/PERSISTENT
    2. Portable SSD relative (/Volumes/SSD/.antigravity/.env) - PORTABLE
    3. Host-relative temporary (/tmp/videdit.env) - LEGACY/FALLBACK
    """
    candidates = [
        Path.home() / ".secrets" / "antigravity" / ".env",
        Path("/Volumes/PortableSSD/.antigravity/.env"),
        Path("/tmp/videdit.env"),
    ]
    for path in candidates:
        if path.exists():
            return str(path)
    return str(candidates[0])

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_find_env_file(),
        env_file_encoding="utf-8"
    )
```

### 7.2 Setup Protocol
1.  **Persistence**: Store sensitive API keys in `~/.secrets/antigravity/.env` on the host machine.
2.  **Fallthrough**: If moving to a new machine, the application will fallback to the SSD-resident `.env` (if present) or fail gracefully, preventing the "empty key" bug.
3.  **Outcome**: Resolves the **"2-Second Archive Bug"** where Whisper failure (due to missing keys after reboot) resulted in empty transcriptions and truncated video timelines.

---

## 8. ExFAT Metadata Conflicts (AppleDouble)

macOS creates hidden `._*` files for metadata on ExFAT volumes. These files often cause `Permission Denied` or `FileNotFoundError` during recursive deletions (like `rm -rf` or `shutil.rmtree`).

### 7.1 Robust Recursive Deletion
Standard `rm -rf` may fail if the metadata file is locked or out of sync. Use `find` with `-delete` for more atomic results.
```bash
# Robust deletion pattern
find /path/to/target -name "._*" -delete
rm -rf /path/to/target
```

### 7.2 Python `shutil.rmtree` Robustness
When cleaning up temporary directories or project folders in Python, always use `ignore_errors=True` to prevent the entire process from crashing due to AppleDouble metadata conflicts.
```python
import shutil
from pathlib import Path

def safe_cleanup(dir_path: Path):
    if dir_path.exists():
        # Essential for stability on ExFAT SSDs
        shutil.rmtree(dir_path, ignore_errors=True)
```

### 7.3 Unicode Normalization (NFC vs NFD)
When working with Japanese filenames on portable SSDs (ExFAT) and cross-platform environments (macOS host vs Linux-based backend), character encoding mismatches often occur.
- **The Issue**: macOS uses **NFD** (Decomposed) internally for filenames, while Linux/FFmpeg/standard Python often expect **NFC** (Composed). This leads to `FileNotFoundError` or HTTP 404s even if the file is visually present.
- **Pattern**: Always normalize string paths to **NFC** at the application boundary (API request or file ingest) using `unicodedata.normalize('NFC', path)` or frontend `.normalize('NFC')`.

### 8.4 Zombie AppleDouble Directories (Un-removable Dir)
ExFAT file systems can occasionally enter a corrupted state where a directory cannot be deleted (`Directory not empty`) even if `ls -la` shows it as empty. This is caused by corrupted `._*` (AppleDouble) metadata files that are partially unlinked but still occupy directory entries.
- **Symptoms**: `rm -rf` fails, `dot_clean` fails, and `find -delete` reports `No such file or directory` yet the parent directory remains.
- **Root Cause**: High-concurrency I/O during heavy processing (e.g., recursive `rm` while another process is scanning the same path).
- **Standard Recovery**:
    1.  **Check for Dissenters**: If `diskutil unmount` fails, identify the blocking process.
        ```bash
        # Identify the "Dissenter"
        diskutil unmount /Volumes/PortableSSD
        # Example Output: dissented by PID 3969 (/Applications/Antigravity.app/...)
        ```
    2.  **Unmount/Mount**: Most reliable fix. `diskutil unmount Force /Volumes/PortableSSD` followed by `diskutil mount`.
    3.  **Post-Mount Cleanup**: After remounting, the corrupted directory entry is often "resurrected". Immediately run a clean `rm -rf` or use Finder to empty the bin.
    4.  **OS Check**: Run `First Aid` in Disk Utility to rebuild the directory index if persistence continues.
    5.  **Preventative Pattern**: Use the **Copy-Process-Copy** strategy to ensure high-entropy I/O (deletion/creation) happens on APFS, only committing final results to ExFAT.

### 8.5 Pattern 175: AppleDouble Input Contamination (Watcher/Pipeline)
In macOS, especially on ExFAT SSDs, hidden `._*` (AppleDouble) files are automatically generated as mirrors for legitimate files. These metadata files are often picked up by naive `glob` patterns or directory watchers, leading to processing collisions.
- **Symptom**: A pipeline fails with `FileExistsError` or `PermissionError` when trying to create a project directory (e.g., `projects/video_name/`) because it's attempting to process `._video_name.mp4` and creating a directory that already visually exists or conflicts with the legitimate file's project.
- **Root Cause**: The AppleDouble file inherits the name of the source but with a `._` prefix. If the processing logic simply strips the extension (e.g., `path.stem`), it might attempt to create identical project structures for both `file.mp4` and `._file.mp4`.
- **Mitigation Protocols**:
    1.  **Filter at Entry**: Explicitly ignore any path starting with `._` in your `glob` or `os.walk` loops.
    2.  **Scrubbing**: Use `dot_clean -m /Volumes/SSD/path/to/input` before starting a batch process to merge/delete these metadata files.
    3.  **Existence Guard**: In `path.mkdir(exist_ok=True)`, if a file with the name already exists but is actually a directory (or vice versa), handle the exception by checking the filename prefix.

### 8.6 Pattern 176: Service Health Discrepancy (Ghost Running)
High latency or I/O wait states on ExFAT can cause a complex startup script (e.g., launching both a watcher and an API server) to partially fail. The main process might exit or remain alive without the network listener.
- **Symptom**: The terminal/agent reports the command as `RUNNING` (CommandId is active), but the browser (Frontend) displays "OFFLINE" or returns `ERR_CONNECTION_REFUSED` on the service port (e.g., 8000).
- **Root Cause**: The API server (Uvicorn/Next.js) crashed during bootstrap due to a file lock or port conflict, but the parent shell/script (or a sibling watcher) stayed active.
- **Mitigation Protocols**:
    1.  **Port-First Audit**: Never trust `command_status`. Always verify the service using `lsof -ti:{port}` or `curl -I http://127.0.0.1:{port}`.
    2.  **Health-Enforced Startup**: Implement a loop in the startup script that verifies the port is active before reporting "Ready".
    3.  **Browser Probe**: Use a browser subagent (headless) to check the `/docs` or `/health` endpoint if an "Offline" status is suspected.

### 8.7 Pattern 177: OS Interactivity Resilience (Interactive Prompt Handling)
When executing cleanup or automation tasks (like `/checkin`), macOS/Zsh may trigger interactive confirmation prompts (e.g., `RM_STAR_WAIT`).
- **Symptom**: An automated script appears to "hang" or take too long.
- **Verification**: Check `command_status` output for strings like `sure you want to delete... [yn]?`.
- **Mitigation**: Use `send_command_input` to provide the necessary key (e.g., `y`). Avoid `rm -f` in some contexts if you want the agent to explicitly acknowledge the deletion for safety, but use it for routine cache purges.

### 8.8 Pattern 178: Persistent Background Execution (Nohup-Daemon Strategy)
In a development ecosystem where the agent manages multiple long-running services (API, Dashboard, Watchers), foreground processes in the terminal are prone to accidental termination when the agent's command context shifts or when `CTRL+C` signals are inadvertently propagated.
- **Symptom**: A service starts correctly (verified by logs) but stops shortly after the agent completes the command, or the client reports `Connection Refused` after the first interaction.
- **Root Cause**: The process is tethered to the agent's active PTY (Pseudo-Terminal). When the agent finishes the task or switches to a new command, the TTY session may close or send signals that terminate backgrounded jobs (`&`).
- **Standard Protocol (Immortal Service)**:
    1.  **Kill Existing**: Always clear the port first: `lsof -ti:{port} | xargs kill -9 2>/dev/null`.
    2.  **Daemonize**: Use `nohup` with full redirection: 
        `nohup {command} > /tmp/service.log 2>&1 &`
    3.  **Verify via Probe**: Immediately follow with a `sleep 2 && curl -I http://localhost:{port}` or `lsof -i:{port}` to ensure the detached process successfully initialized.
    4.  **Log Redirection**: Avoid writing logs to the SSD (ExFAT) if high frequency; keep them in `/tmp` (APFS) to prevent I/O blocking.

---

### 8.8 Pattern 179: Git Shadow Configuration (Metadata Volatility)
ExFAT volumes lack the robust metadata journaling of APFS/NTFS. During high-load I/O (like concurrent pnpm and rendering), the `.git/config` or `.git/HEAD` files can enter a "Locked" or "Partially Truncated" state on macOS, causing the repository to appear corrupted or lose its remote definitions.
- **Symptom**: `fatal: 'origin' does not appear to be a git repository` or `fatal: not a git repository`.
- **Root Cause**: Desynchronization between the OS's file handle and the physical drive index on ExFAT.
- **Resolution: Shadow Restore Protocol**:
    1.  **Check Physical `.git/config`**: `cat .git/config` to see if the content is still there. If empty/corrupted, restore from a backup or re-add the remote.
    2.  **Remote Re-linking**:
        ```bash
        git remote add origin <url>
        git fetch origin
        git branch --set-upstream-to=origin/main main
        ```
    3.  **Remount Recovery**: If `.git` is completely invisible but `ls -a` shows other files, follow **Pattern 8.4 (Unmount/Mount)** to force a directory index rebuild.
- **Preventative Pattern**: Periodically run `git fsck` and keep a `.git_config_backup` in the project root on the SSD.

---

## 9. Snappy Runtime Startup (Lazy Loading for Heavy Libraries)

In environments where the project root is on a portable SSD, importing heavy libraries (`librosa`, `torch`, `spacy`, `numpy`, `scipy`, `pandas`) at the top of a module can cause significant delays in API startup or CLI tool responsiveness due to ExFAT I/O latency.

### 9.1 The "Import-on-Execution" Pattern
Instead of top-level imports, use a private `_ensure_dependencies()` method or local imports within functions.

- **Benefit**:
    - **Speed**: The main application (e.g., FastAPI) starts instantly, improving the developer experience and system snappiness.
    - **Resilience**: If a library is missing in a sub-optimal environment, the entire system doesn't crash on start—only the specific feature fails gracefully.

### 9.2 Implementation Standard (Python)
```python
class DeepAnalyzer:
    def __init__(self):
        self._lib = None # Placeholder

    def _ensure_lib(self):
        if self._lib is None:
            # Import only when actually needed
            import heavy_ml_library as lib
            self._lib = lib
        return self._lib

    def analyze(self, data):
        lib = self._ensure_lib()
        return lib.process(data)
```
