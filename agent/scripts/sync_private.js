const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ANTIGRAVITY_DIR = process.env.ANTIGRAVITY_DIR || path.join(process.env.HOME, '.antigravity');

function run(command) {
    try {
        execSync(command, { cwd: ANTIGRAVITY_DIR, stdio: 'inherit' });
    } catch (e) {
        console.error(`❌ Command failed: ${command}`);
        // Don't exit, try to continue
    }
}

function main() {
    console.log('\n🔄 Starting Private Sync Routing...');

    // 1. Check if private remote exists
    try {
        execSync('git remote get-url private', { cwd: ANTIGRAVITY_DIR, stdio: 'ignore' });
    } catch (e) {
        console.log('⚠️  Remote "private" not found. Skipping sync.');
        return;
    }

    // 2. Define files to sync (Personal Assets)
    const FILES_TO_SYNC = [
        'brand_concept.md',
        'USAGE_TRACKER.md',
        '.session_state.json'
    ];

    // Check availability
    const availableFiles = FILES_TO_SYNC.filter(f => fs.existsSync(path.join(ANTIGRAVITY_DIR, f)));
    if (availableFiles.length === 0) {
        console.log('ℹ️  No personal files to sync.');
        return;
    }

    console.log(`📦 Syncing files to [private]: ${availableFiles.join(', ')}`);

    // 3. Switch to (or create) private-sync branch
    // strategy: Detached HEAD or temporary branch to avoid messing with main?
    // Better: Commit to a separate orphan branch or just a branch based on main but with extra commits.
    // Let's use 'private-sync' branch.

    try {
        // Stash current changes to be safe
        run('git stash push -m "Sync Stash" --include-untracked');

        // Checkout private-sync or create it from main
        // We always want it to be "Main + Personal Files".
        // So maybe we should reset it to main first?

        // Check if branch exists
        let branchExists = false;
        try { execSync('git show-ref --verify refs/heads/private-sync', { cwd: ANTIGRAVITY_DIR }); branchExists = true; } catch (e) { }

        if (branchExists) {
            run('git checkout private-sync');
            run('git merge main --allow-unrelated-histories -m "Merge main into private-sync"');
        } else {
            run('git checkout -b private-sync main');
        }

        // 4. Force Add Personal Files (files are ignored in main, so -f is needed)
        // We need to restore them from stash/working directory if we switched branches?
        // Wait, if we stashed them, we need to pop them?
        // Actually, 'brand_concept.md' is untracked in main. So valid stash would have them.

        run('git stash pop || true'); // Restore files

        // Add specific files
        availableFiles.forEach(f => {
            run(`git add -f "${f}"`);
        });

        // 5. Commit and Push
        run('git commit -m "chore(sync): Update personal configuration" || true');
        run('git push private private-sync:main --force'); // Push to 'main' on private repo? Or 'private-sync'? User said "routing". Often private repo just has main.
        // Safer to push to 'main' of private repo if it's dedicated.

        console.log('✅ Pushed to private repository.');

        // 6. Return to main
        run('git checkout main');

        console.log('🔄 Sync complete. Back on main.');

    } catch (e) {
        console.error('❌ Sync failed:', e);
        // Try to recover to main
        run('git checkout main');
    }
}

main();
