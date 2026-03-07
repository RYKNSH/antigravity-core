const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

/**
 * Antigravity Daemon (The Heart)
 * Runs 24/365 to manage the Studio.
 */

const ANTIGRAVITY_DIR = process.env.ANTIGRAVITY_DIR || path.join(require('os').homedir(), '.antigravity');
const INBOX_DIR = path.join(ANTIGRAVITY_DIR, 'inbox');
const LOG_DIR = path.join(ANTIGRAVITY_DIR, 'logs');

// Ensure Logs exist
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

function log(message) {
    const timestamp = new Date().toISOString();
    const logMsg = `[${timestamp}] ${message}`;
    console.log(logMsg);
    fs.appendFileSync(path.join(LOG_DIR, 'daemon_activity.log'), logMsg + '\n');
}

function watchInbox() {
    log('👁️  Watching Inbox for Impulses...');

    fs.watch(INBOX_DIR, (eventType, filename) => {
        if (eventType === 'rename' && filename && !filename.startsWith('.')) {
            const filePath = path.join(INBOX_DIR, filename);
            if (fs.existsSync(filePath)) {
                log(`⚡ Impulse detected: ${filename}`);
                processImpulse(filePath);
            }
        }
    });
}

function processImpulse(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const filename = path.basename(filePath);
    log(`🧠 Processing Impulse: ${content.trim().substring(0, 50)}...`);
    const archivePath = path.join(ANTIGRAVITY_DIR, 'archive', `processed_${Date.now()}_${filename}`);
    fs.renameSync(filePath, archivePath);
    log(`✅ Impulse processed & archived to ${archivePath}`);
}

function scheduleMidnightRefactor() {
    setInterval(() => {
        const now = new Date();
        if (now.getHours() === 3 && now.getMinutes() === 0) {
            log('🌙 Starting Midnight Refactor...');
        }
    }, 60000);
}

log('🚀 Antigravity Daemon Online.');
watchInbox();
scheduleMidnightRefactor();
