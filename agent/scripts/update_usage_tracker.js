#!/usr/bin/env node
/**
 * update_usage_tracker.js - Update USAGE_TRACKER.md workflow usage counts.
 * Rewritten in Node.js for cross-platform stability and atomic locking.
 */

const fs = require('fs/promises');
const path = require('path');

const ANTIGRAVITY_DIR = process.env.ANTIGRAVITY_DIR || path.join(process.env.HOME, '.antigravity');
const TRACKER_FILE = path.join(ANTIGRAVITY_DIR, 'USAGE_TRACKER.md');
const LOCK_DIR = path.join(ANTIGRAVITY_DIR, '.locks', 'usage_tracker.lock');
const WORKFLOW = process.argv[2] || 'unknown';
const TODAY = new Date().toISOString().split('T')[0];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function acquireLock() {
  await fs.mkdir(path.join(ANTIGRAVITY_DIR, '.locks'), { recursive: true }).catch(() => {});
  for (let i = 0; i < 10; i++) {
    try {
      await fs.mkdir(LOCK_DIR);
      await fs.writeFile(path.join(LOCK_DIR, 'pid'), process.pid.toString());
      await fs.writeFile(path.join(LOCK_DIR, 'ts'), Date.now().toString());
      return true;
    } catch (e) {
      if (e.code === 'EEXIST') {
        try {
            const tsStr = await fs.readFile(path.join(LOCK_DIR, 'ts'), 'utf-8');
            const ts = parseInt(tsStr, 10);
            if (Date.now() - ts > 60000) { // 60 seconds stale lock timeout
                console.warn(`⚠️ Stale lock detected (age: ${Math.round((Date.now() - ts)/1000)}s). Removing...`);
                await fs.rm(LOCK_DIR, { recursive: true, force: true });
                continue;
            }
        } catch(err) {
            // ts file might not exist yet if mkdir just passed but writeFile hasn't
        }
        await sleep(1000);
      } else {
        throw e;
      }
    }
  }
  return false;
}

async function releaseLock() {
  try {
    const pidStr = await fs.readFile(path.join(LOCK_DIR, 'pid'), 'utf-8');
    if (parseInt(pidStr, 10) === process.pid) {
        await fs.rm(LOCK_DIR, { recursive: true, force: true });
    }
  } catch (e) {}
}

async function main() {
    // Watchdog timer
    const watchdog = setTimeout(() => {
        console.error("⚠️ update_usage_tracker.js: timeout 15s — force exit");
        process.exit(1);
    }, 15000);

    let lockAcquired = false;
    try {
        const wfName = WORKFLOW.replace(/^\//, '');
        const wfPath = path.join(ANTIGRAVITY_DIR, 'agent', 'workflows', wfName + '.md');

        try {
            await fs.access(wfPath);
        } catch {
            console.warn(`⚠️ Workflow file not found: ${wfPath}. Skipping tracking.`);
            process.exit(0);
        }

        try {
            await fs.access(TRACKER_FILE);
        } catch {
            console.error(`❌ USAGE_TRACKER.md not found at ${TRACKER_FILE}`);
            process.exit(1);
        }

        lockAcquired = await acquireLock();
        if (!lockAcquired) {
            console.warn(`⚠️ Could not acquire lock on ${TRACKER_FILE} (timeout 10s). Skipping.`);
            process.exit(1);
        }

        let content = await fs.readFile(TRACKER_FILE, 'utf-8');
        const lines = content.split('\n');
        
        let found = false;
        let lastRowIdx = -1;
        
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith(`| /${wfName} |`)) {
                found = true;
                const parts = lines[i].split('|');
                if (parts.length >= 4) {
                    const count = parseInt(parts[2].trim(), 10) || 0;
                    parts[2] = ` ${count + 1} `;
                    parts[3] = ` ${TODAY} `;
                    lines[i] = parts.join('|');
                    console.log(`✅ Updated /${wfName}: ${count} → ${count + 1} (Last: ${TODAY})`);
                }
                break;
            }
            if (lines[i].startsWith('| /')) {
                lastRowIdx = i;
            }
        }

        if (!found) {
            const newRow = `| /${wfName} | 1 | ${TODAY} |`;
            if (lastRowIdx !== -1) {
                lines.splice(lastRowIdx + 1, 0, newRow);
            } else {
                lines.push(newRow);
            }
            console.log(`✅ Added /${wfName}: 1 (Last: ${TODAY})`);
        }

        await fs.writeFile(TRACKER_FILE, lines.join('\n'));
        
    } catch(err) {
        console.error("Error updating tracker:", err.message);
        process.exit(1);
    } finally {
        if (lockAcquired) await releaseLock();
        clearTimeout(watchdog);
    }
}

main();
