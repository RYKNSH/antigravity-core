#!/usr/bin/env node
/**
 * overseer.js — The absolute watcher daemon for Antigravity's Immortal Architecture
 * 
 * 常にバックグラウンドで起動し、The Eternal Loop（AIエージェントの処理）を監視する。
 * `.session_state.json` に記録された現在のアクション（Action）のTTLを超過した場合、
 * 容赦無く該当PIDを SIGKILL し、そのActionをFatal Blacklistに叩き込む。
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ANTIGRAVITY_DIR = process.env.ANTIGRAVITY_DIR || path.join(process.env.HOME, '.antigravity');
const STATE_FILE = path.join(ANTIGRAVITY_DIR, '.session_state.json');
const SESSION_STATE_BIN = path.join(__dirname, 'session_state.js');

function safeReadJSON(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    return null;
  }
}

function checkAndKill() {
  const state = safeReadJSON(STATE_FILE);
  if (!state || !state.current || !state.current.action || !state.current.action_ttl || !state.current.action_updated_at) {
    return; // No active action to monitor
  }

  const now = new Date();
  const updatedAt = new Date(state.current.action_updated_at);
  const elapsedSeconds = (now - updatedAt) / 1000;
  
  if (elapsedSeconds > state.current.action_ttl) {
    console.log(`[OVERSEER] ⚠️ Action "${state.current.action}" TIMED OUT! (${elapsedSeconds.toFixed(1)}s > ${state.current.action_ttl}s)`);
    
    // Kill the PID
    if (state.current.pid) {
      try {
        console.log(`[OVERSEER] 💀 Sending SIGKILL to PID ${state.current.pid}...`);
        process.kill(state.current.pid, 'SIGKILL');
        console.log(`[OVERSEER] ✅ Successfully killed PID ${state.current.pid}`);
      } catch (err) {
        console.log(`[OVERSEER] ℹ️ Failed to kill PID ${state.current.pid} (process might already be dead): ${err.message}`);
      }
    }
    
    // Add to fatal blacklist
    try {
      console.log(`[OVERSEER] 📝 Adding action to Fatal Blacklist...`);
      execSync(`node "${SESSION_STATE_BIN}" add-fatal-blacklist "${state.current.action}" "The Overseer SIGKILL: TTL exceeded (${state.current.action_ttl}s)"`, { stdio: 'inherit' });
    } catch (err) {
      console.error(`[OVERSEER] ❌ Error updating blacklist: ${err.message}`);
    }
  }
}

console.log('👁️  [OVERSEER] Started absolute monitoring... interval: 5 seconds');
setInterval(checkAndKill, 5000);
