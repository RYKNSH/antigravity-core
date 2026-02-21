const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ANTIGRAVITY_DIR = process.env.ANTIGRAVITY_DIR || path.join(process.env.HOME, '.antigravity');
const TIMEOUT_MS = 30000; // 30s max per git command
const GIT_PUSH_TIMEOUT_MS = 60000; // 60s for push

function run(command, opts = {}) {
    const timeout = opts.timeout || TIMEOUT_MS;
    try {
        execSync(command, {
            cwd: ANTIGRAVITY_DIR,
            stdio: 'pipe', // Capture output instead of inherit (prevents TTY hangs)
            timeout,
            env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } // Never prompt for credentials
        });
        return true;
    } catch (e) {
        if (e.killed) {
            console.error(`⏰ TIMEOUT (${timeout}ms): ${command}`);
        } else {
            console.error(`❌ Failed: ${command} → ${(e.stderr || e.message || '').toString().slice(0, 200)}`);
        }
        return false;
    }
}

function runOutput(command) {
    try {
        return execSync(command, {
            cwd: ANTIGRAVITY_DIR,
            stdio: 'pipe',
            timeout: TIMEOUT_MS,
            env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
        }).toString().trim();
    } catch {
        return null;
    }
}

function main() {
    console.log('\n🔄 Starting Private Sync...');

    // 1. Check if private remote exists
    if (!runOutput('git remote get-url private')) {
        console.log('⚠️  Remote "private" not found. Skipping sync.');
        return;
    }

    // 2. Remember current branch for safe return
    const originalBranch = runOutput('git rev-parse --abbrev-ref HEAD') || 'main';

    // 3. Define files to sync
    const FILES_TO_SYNC = [
        'brand_concept.md',
        'USAGE_TRACKER.md',
        '.session_state.json'
    ];

    const availableFiles = FILES_TO_SYNC.filter(f => fs.existsSync(path.join(ANTIGRAVITY_DIR, f)));
    if (availableFiles.length === 0) {
        console.log('ℹ️  No personal files to sync.');
        return;
    }

    console.log(`📦 Syncing: ${availableFiles.join(', ')}`);

    // 4. Save copies of personal files BEFORE any git operations
    const fileBackups = {};
    availableFiles.forEach(f => {
        const fp = path.join(ANTIGRAVITY_DIR, f);
        try { fileBackups[f] = fs.readFileSync(fp); } catch { }
    });

    try {
        // 5. Stash current changes
        run('git stash push -m "sync-stash" --include-untracked');

        // 6. Fetch private remote
        if (!run('git fetch private', { timeout: 30000 })) {
            console.log('⚠️  Cannot fetch private remote. Aborting sync.');
            return;
        }

        // 7. Create/reset private-sync branch
        let hasPrivateMain = !!runOutput('git rev-parse --verify private/main');
        if (hasPrivateMain) {
            run('git checkout -B private-sync private/main');
            // Merge OSS main, auto-resolve conflicts favoring main (theirs)
            run('git merge main --no-edit --allow-unrelated-histories -X theirs');
        } else {
            run('git checkout -B private-sync main');
        }

        // 8. Force-apply personal files from backup (always use local versions)
        availableFiles.forEach(f => {
            if (fileBackups[f]) {
                fs.writeFileSync(path.join(ANTIGRAVITY_DIR, f), fileBackups[f]);
            }
        });

        // 9. Stage & commit
        availableFiles.forEach(f => run(`git add -f "${f}"`));
        run('git commit --no-verify -m "chore(sync): Update personal configuration" --allow-empty');

        // 10. Push with timeout
        console.log('⬆️  Pushing to private...');
        if (run('git push private private-sync:main', { timeout: GIT_PUSH_TIMEOUT_MS })) {
            console.log('✅ Pushed to private.');
        } else {
            console.log('⚠️  Push failed or timed out.');
        }

    } catch (e) {
        console.error('❌ Sync error:', e.message);
    } finally {
        // 11. ALWAYS return to original branch
        run(`git checkout ${originalBranch}`);

        // 12. Restore personal files from backup
        Object.entries(fileBackups).forEach(([f, data]) => {
            try {
                fs.writeFileSync(path.join(ANTIGRAVITY_DIR, f), data);
                run(`git reset HEAD "${f}"`);
            } catch { }
        });

        // 13. Pop stash if exists
        try {
            const stashList = runOutput('git stash list');
            if (stashList && stashList.includes('sync-stash')) {
                run('git stash pop');
            }
        } catch { }

        console.log('🔄 Sync complete. Back on ' + (runOutput('git rev-parse --abbrev-ref HEAD') || 'main'));
    }
}

main();
