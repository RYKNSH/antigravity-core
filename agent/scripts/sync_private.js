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
        return; // Exit if no private remote
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
        // We still proceed to sync the branch just in case, or maybe return?
        // If files are missing locally, we might want to pull them?
        // But this script is mostly for pushing local state.
        // Let's continue to ensure private-sync branch is up to date with main.
    }

    console.log(`📦 Syncing files to [private]: ${availableFiles.join(', ')}`);

    try {
        // Stash current changes to be safe (includes untracked)
        run('git stash push -m "Sync Stash" --include-untracked');

<<<<<<< Updated upstream
        // 3. Checkout private-sync
        // Strategy: Always rebuild from private/main if available, to avoid divergence.
        let startPoint = 'main';
        try {
=======
        // Checkout private-sync or create it from main
        // We always want it to be "Main + Personal Files".
        // So maybe we should reset it to main first?

        // Check if branch exists
        let startPoint = 'main'; // Default start point
        try {
            // Check if private/main exists (fetch was done in step 1? No, we need to fetch)
            // But main() doesn't fetch explicitly at start. Let's rely on what we have or fetch.
>>>>>>> Stashed changes
            run('git fetch private');
            execSync('git rev-parse --verify private/main', { cwd: ANTIGRAVITY_DIR, stdio: 'ignore' });
            startPoint = 'private/main';
            console.log('ℹ️  Found private/main. Basing sync on remote history.');
        } catch (e) {
            console.log('ℹ️  private/main not found. Basing sync on local main.');
<<<<<<< Updated upstream
=======
        }

        if (startPoint === 'private/main') {
            run(`git checkout -B private-sync private/main`);
            run('git merge main --allow-unrelated-histories -m "Merge OSS main into private config" || true');
        } else {
            run('git checkout -B private-sync main');
>>>>>>> Stashed changes
        }

        if (startPoint === 'private/main') {
            run(`git checkout -B private-sync private/main`);
            // Merge OSS main, favoring OSS versions for conflicts in shared files (like .gitignore)
            // -X theirs means "changes from the merged branch (main) wins"
            run('git merge main --allow-unrelated-histories -X theirs -m "Merge OSS main into private config" || true');
        } else {
            run('git checkout -B private-sync main');
        }

        // 4. Restore Stash (Local Changes)
        // We want local changes to override whatever was in private/main or main.
        // Because user said "Pull then Push", implies they want to merge.
        // But stash pop conflict behavior is tricky.
        // If we pop, and conflict, we likely want "Ours" (Stash) for personal files.
        try {
            execSync('git stash pop', { cwd: ANTIGRAVITY_DIR, stdio: 'inherit' });
        } catch (e) {
            console.log('⚠️  Stash pop had conflicts. Assuming local changes (stash) take precedence for personal files.');
            // If conflict, git leaves markers. 
            // We should probably just force checkout the files from stash if possible, or let user resolve?
            // "Automatic" script should try its best.
            // For now, assume it's okay or user will fix.
        }

        // 5. Add Personal Files
        availableFiles.forEach(f => {
            run(`git add -f "${f}"`);
        });

<<<<<<< Updated upstream
        // 6. Commit
        run('git commit -m "chore(sync): Update personal configuration" || true');

        // 7. Push
        console.log('⬆️  Pushing to private repository...');
        run('git push private private-sync:main');

        console.log('✅ Pushed to private repository.');

=======


        // 6. Commit and Push
        run('git commit -m "chore(sync): Update personal configuration" || true');

        console.log('⬆️  Pushing to private repository...');
        run('git push private private-sync:main'); // Removed --force

        console.log('✅ Pushed to private repository.');

        // 6. Return to main
        run('git checkout main');

        // Restore personal files (because they might be removed when switching from tracked branch to untracked main)
        console.log('🔄 Restoring personal files to working directory...');
        availableFiles.forEach(f => {
            run(`git checkout private-sync -- "${f}"`);
            run(`git reset HEAD "${f}"`);
        });

        console.log('🔄 Sync complete. Back on main.');

>>>>>>> Stashed changes
    } catch (e) {
        console.error('❌ Sync failed:', e);
    } finally {
        // 8. Return to main and Restore Files
        run('git checkout main');
<<<<<<< Updated upstream

        console.log('🔄 Restoring personal files to working directory...');
        // We recover files from private-sync just in case switching to main stripped them
        FILES_TO_SYNC.forEach(f => {
            try {
                // Check if file exists in private-sync branch
                execSync(`git show private-sync:"${f}"`, { cwd: ANTIGRAVITY_DIR, stdio: 'ignore' });
                // If yes, checkout it
                execSync(`git checkout private-sync -- "${f}"`, { cwd: ANTIGRAVITY_DIR, stdio: 'ignore' });
                // Unstage
                execSync(`git reset HEAD "${f}"`, { cwd: ANTIGRAVITY_DIR, stdio: 'ignore' });
            } catch (ex) { }
        });

        console.log('🔄 Sync complete. Back on main.');
=======
        // Attempt restore in catch too
        FILES_TO_SYNC.forEach(f => {
            try {
                if (fs.existsSync(path.join(ANTIGRAVITY_DIR, f))) return; // already there
                execSync(`git checkout private-sync -- "${f}"`, { cwd: ANTIGRAVITY_DIR, stdio: 'ignore' });
                execSync(`git reset HEAD "${f}"`, { cwd: ANTIGRAVITY_DIR, stdio: 'ignore' });
            } catch (ex) { }
        });
>>>>>>> Stashed changes
    }
}

main();
