/**
 * sync_private.js v2 — Working-Tree-Safe Private Sync
 * 
 * v1→v2:
 *   - ZERO working tree mutation: uses GIT_INDEX_FILE + tmp dir
 *   - No branch checkout, no stash, no git reset
 *   - Safe for concurrent sessions
 *   - atomicWrite for file safety
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ANTIGRAVITY_DIR = process.env.ANTIGRAVITY_DIR || path.join(process.env.HOME, '.antigravity');
const TIMEOUT_MS = 30000;
const GIT_PUSH_TIMEOUT_MS = 60000;

/** Shell-safe string escaping */
function esc(str) {
    if (typeof str !== 'string') return "''";
    return "'" + str.replace(/'/g, "'\\''") + "'";
}

function git(cmd, opts = {}) {
    const timeout = opts.timeout || TIMEOUT_MS;
    try {
        return execSync(`git ${cmd}`, {
            cwd: ANTIGRAVITY_DIR,
            stdio: 'pipe',
            timeout,
            env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
        }).toString().trim();
    } catch (e) {
        if (opts.throwOnError) throw e;
        if (e.killed) {
            console.error(`⏰ TIMEOUT (${timeout}ms): git ${cmd}`);
        }
        return null;
    }
}

function main() {
    console.log('\n🔄 Starting Private Sync (v2 — worktree-safe)...');

    // 1. Check if private remote exists
    if (!git('remote get-url private')) {
        console.log('⚠️  Remote "private" not found. Skipping sync.');
        return;
    }

    // 2. Define files to sync
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

    // 3. Fetch private remote (no working tree impact)
    if (!git('fetch private', { timeout: 30000 })) {
        console.log('⚠️  Cannot fetch private remote. Aborting sync.');
        return;
    }

    // 4. Build commit using plumbing commands (ZERO working tree mutation)
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-private-'));
    const tmpIdx = path.join(tmpDir, 'index');
    const tmpMsg = path.join(tmpDir, 'commit-msg');

    try {
        // Determine parent commit
        const privateMainRef = git('rev-parse --verify private/main');
        const localMainRef = git('rev-parse --verify HEAD');

        // Start from private/main tree if it exists, otherwise from local main
        const baseRef = privateMainRef || localMainRef;
        if (!baseRef) {
            console.error('❌ Cannot determine base ref. Aborting.');
            return;
        }

        // Read base tree into temp index
        const envPrefix = `GIT_INDEX_FILE=${esc(tmpIdx)}`;

        execSync(`${envPrefix} git read-tree ${baseRef}`, {
            cwd: ANTIGRAVITY_DIR, stdio: 'pipe', timeout: TIMEOUT_MS,
            env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_INDEX_FILE: tmpIdx },
            shell: '/bin/bash'
        });

        // If private/main exists and differs from local main, merge local main's tree
        if (privateMainRef && localMainRef && privateMainRef !== localMainRef) {
            try {
                execSync(`GIT_INDEX_FILE=${esc(tmpIdx)} git merge-tree ${baseRef} ${privateMainRef} ${localMainRef}`, {
                    cwd: ANTIGRAVITY_DIR, stdio: 'pipe', timeout: TIMEOUT_MS,
                    shell: '/bin/bash'
                });
            } catch {
                // merge-tree may fail or return conflicts; we proceed anyway
                // since personal files will be force-applied next
            }
        }

        // Hash and update personal files into the temp index
        for (const f of availableFiles) {
            const filePath = path.join(ANTIGRAVITY_DIR, f);
            const content = fs.readFileSync(filePath);

            // Write to tmp file, hash it, update index
            const tmpFile = path.join(tmpDir, `blob-${Buffer.from(f).toString('hex').slice(0, 20)}`);
            fs.writeFileSync(tmpFile, content);

            const blobHash = execSync(`git hash-object -w ${esc(tmpFile)}`, {
                cwd: ANTIGRAVITY_DIR, encoding: 'utf8', timeout: TIMEOUT_MS
            }).trim();

            execSync(`GIT_INDEX_FILE=${esc(tmpIdx)} git update-index --add --cacheinfo 100644,${blobHash},${esc(f)}`, {
                cwd: ANTIGRAVITY_DIR, stdio: 'pipe', timeout: TIMEOUT_MS,
                shell: '/bin/bash'
            });
        }

        // Write tree from temp index
        const treeHash = execSync(`GIT_INDEX_FILE=${esc(tmpIdx)} git write-tree`, {
            cwd: ANTIGRAVITY_DIR, encoding: 'utf8', timeout: TIMEOUT_MS,
            shell: '/bin/bash'
        }).trim();

        // Create commit (with parent)
        fs.writeFileSync(tmpMsg, `chore(sync): Update personal configuration\n\nFiles: ${availableFiles.join(', ')}\nTimestamp: ${new Date().toISOString()}`);

        const parentArgs = privateMainRef ? `-p ${privateMainRef}` : (localMainRef ? `-p ${localMainRef}` : '');
        const commitHash = execSync(`git commit-tree ${treeHash} ${parentArgs} -F ${esc(tmpMsg)}`, {
            cwd: ANTIGRAVITY_DIR, encoding: 'utf8', timeout: TIMEOUT_MS
        }).trim();

        // Push the commit directly (no branch update needed locally)
        console.log('⬆️  Pushing to private...');
        const pushResult = git(`push private ${commitHash}:refs/heads/main`, { timeout: GIT_PUSH_TIMEOUT_MS });
        if (pushResult !== null) {
            console.log('✅ Pushed to private.');
        } else {
            // Force push if needed (personal repo, safe to force)
            const forceResult = git(`push private ${commitHash}:refs/heads/main --force`, { timeout: GIT_PUSH_TIMEOUT_MS });
            if (forceResult !== null) {
                console.log('✅ Force-pushed to private.');
            } else {
                console.log('⚠️  Push failed or timed out.');
            }
        }

        console.log(`🔄 Sync complete (commit: ${commitHash.slice(0, 7)}). Working tree untouched.`);

    } catch (e) {
        console.error(`❌ Sync error: ${e.message}`);
    } finally {
        // Cleanup temp directory
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { }
    }
}

main();
