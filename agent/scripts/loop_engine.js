/**
 * loop_engine.js
 * 
 * The "Harness" for the Antigravity Autonomy Engine.
 * Provides state management, git checkpoints, and safety mechanisms (circuit breakers)
 * for the autonomous development loop.
 * 
 * Commands:
 * - init: Checks environment (dirty, lock), initializes loop state.
 * - checkpoint: Creates a git tag for the current attempt.
 * - verify: Checks the result of the last verification run.
 * - rollback: Resets to the last checkpoint.
 * - next: Increments attempt counter, checks limits.
 * - success: Cleans up tags and lockfile.
 * - abort: Emergency stop.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');
const { safeReadJSON, atomicWriteJSON } = require('./file_utils');

// Constants
const PROJECT_ROOT = process.env.PROJECT_ROOT || process.cwd();
const ANTIGRAVITY_DIR = process.env.ANTIGRAVITY_DIR || path.join(os.homedir(), '.antigravity');
const LOCK_FILE = path.join(PROJECT_ROOT, '.antigravity', 'loop.lock');
const LOGS_DIR = path.join(ANTIGRAVITY_DIR, 'logs');
const VERIFY_RESULT = path.join(LOGS_DIR, 'verify_result.json');

// Colors
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

function log(color, msg) {
    console.log(`${color}[LoopEngine] ${msg}${RESET}`);
}

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function git(cmd) {
    try {
        return execSync(`git ${cmd}`, { cwd: PROJECT_ROOT, stdio: 'pipe' }).toString().trim();
    } catch (e) {
        throw new Error(`Git command failed: git ${cmd}\n${e.stderr.toString()}`);
    }
}

function loadState() {
    return safeReadJSON(LOCK_FILE);
}

function saveState(state) {
    ensureDir(path.dirname(LOCK_FILE));
    atomicWriteJSON(LOCK_FILE, state);
}

// --- Commands ---

function cmdInit(maxRetries = 3, maxCost = 2.0) {
    log(YELLOW, "Initializing Loop...");

    // 1. Clean Slate Rule
    let status;
    try {
        status = git('status --porcelain');
    } catch (e) {
        // If not a git repo, init? No, strict mode requires git.
        log(RED, "Not a git repository. Harness requires Git.");
        process.exit(1);
    }

    if (status.length > 0) {
        // Check if Resurrection is needed (omitted for strictness first)
        log(RED, "🛑 Dirty Working Directory Detected.");
        console.log("The Harness requires a clean slate to operate safely.");
        console.log("Please commit or stash your changes before starting the loop.");
        process.exit(1);
    }

    // 2. Lock Check
    if (fs.existsSync(LOCK_FILE)) {
        const state = loadState();
        log(RED, "🛑 Existing Lock File Found.");
        console.log(`Previous loop (ID: ${state.id}) did not finish correctly.`);
        console.log("Run 'node loop_engine.js abort' to clean up.");
        process.exit(1);
    }

    // 3. Initialize State
    const state = {
        id: Date.now().toString(),
        attempt: 1,
        maxRetries: parseInt(maxRetries),
        maxCost: parseFloat(maxCost),
        startTime: Date.now(),
        history: []
    };
    saveState(state);

    // 4. Initial Tag
    const tagName = `loop-start-${state.id}`;
    git(`tag ${tagName}`);
    log(GREEN, `🚀 Loop Initialized. Tagged: ${tagName}`);
}

function cmdCheckpoint() {
    const state = loadState();
    if (!state) { log(RED, "No active loop."); process.exit(1); }

    const tagName = `attempt-${state.id}-${state.attempt}`;
    // Check if tag exists (idempotency)
    try {
        git(`tag ${tagName}`);
        log(GREEN, `📍 Checkpoint created: ${tagName}`);
    } catch (e) {
        log(YELLOW, `Checkpoint ${tagName} already exists or failed.`);
    }
}

function cmdVerify() {
    const state = loadState();
    if (!state) { log(RED, "No active loop."); process.exit(1); }

    // Read verify result
    const result = safeReadJSON(VERIFY_RESULT);
    if (!result) {
        log(RED, "Verification result missing or corrupted.");
        process.exit(1);
    }

    // Check timestamp (must be recent? for now trust the file)

    if (result.success) {
        log(GREEN, "✅ Verification Passed.");
        process.exit(0);
    } else {
        log(RED, "❌ Verification Failed.");
        log(YELLOW, `Reason: ${result.error || 'Unknown'}`);
        process.exit(1);
    }
}

function cmdRollback() {
    const state = loadState();
    if (!state) { log(RED, "No active loop."); process.exit(1); }

    const tagName = `attempt-${state.id}-${state.attempt}`; // Current attempt start? 
    // Wait, Architect said: "Think (Plan A) -> Start -> Verify(Fail) -> Rollback -> Think"
    // So usually we rollback to the START of the attempt? Or the start of the LOOP?
    // DevOps said: "Stateful & Reversible... 失敗時は即 git reset --hard loop-start"
    // Ah, wait. If we reset to `loop-start`, we lose ALL progress. 
    // If we want "Recursive", maybe we keep some knowledge?
    // But code-wise, we want to reset to clean slate.
    // Let's reset to the *Start of the current Loop Session* (loop-start-ID).
    // Or if we want to iterate (Plan A -> Plan B), we reset to before Plan A code.

    // Consensus: "失敗時は即 git reset --hard loop-start" (DevOps)
    // Okay, we go back to the beginning.

    const targetTag = `loop-start-${state.id}`;

    log(YELLOW, `🔄 Rolling back to ${targetTag}...`);
    git(`reset --hard ${targetTag}`);
    git(`clean -fd`); // Nuke untracked files
    log(GREEN, "✨ Clean Slate Restored.");
}

function cmdNext() {
    const state = loadState();
    if (!state) { log(RED, "No active loop."); process.exit(1); }

    // Update history
    if (fs.existsSync(VERIFY_RESULT)) {
        const result = JSON.parse(fs.readFileSync(VERIFY_RESULT, 'utf8'));
        state.history.push({ attempt: state.attempt, result });
    }

    state.attempt++;

    // Circuit Breakers
    if (state.attempt > state.maxRetries) {
        log(RED, "💥 Max Retries Exceeded. Loop Failed.");
        // Should we cleanup? Or leave for manual inspection?
        // Leave lock for manual inspection.
        process.exit(1);
    }

    // Cost check (Mock)
    // if (currentCost > state.maxCost) ...

    saveState(state);
    log(YELLOW, `⏭️  Advancing to Attempt ${state.attempt}/${state.maxRetries}`);
}

function cmdSuccess() {
    const state = loadState();
    if (!state) { log(GREEN, "No active loop to clean."); return; }

    log(GREEN, "🎉 Loop Success! Cleaning up tags...");

    // Delete tags
    const startTag = `loop-start-${state.id}`;
    try { git(`tag -d ${startTag}`); } catch (e) { }

    for (let i = 1; i <= state.attempt; i++) {
        const tag = `attempt-${state.id}-${i}`;
        try { git(`tag -d ${tag}`); } catch (e) { }
    }

    fs.unlinkSync(LOCK_FILE);
    log(GREEN, "✨ Harness Released.");
}

function cmdAbort() {
    const state = loadState();
    if (state) {
        log(RED, "🚨 Aborting Loop.");
        // Reset?
        // Maybe ask user? For now just remove lock.
        fs.unlinkSync(LOCK_FILE);
        log(YELLOW, "Lock file removed. Manually reset git if needed.");
    } else {
        log(YELLOW, "No active loop found.");
    }
}

// CLI Routing
const args = process.argv.slice(2);
const command = args[0];

if (command === 'init') cmdInit(args[1], args[2]);
else if (command === 'checkpoint') cmdCheckpoint();
else if (command === 'verify') cmdVerify();
else if (command === 'rollback') cmdRollback();
else if (command === 'next') cmdNext();
else if (command === 'success') cmdSuccess();
else if (command === 'abort') cmdAbort();
else {
    console.log("Usage: node loop_engine.js <init|checkpoint|verify|rollback|next|success|abort>");
}
