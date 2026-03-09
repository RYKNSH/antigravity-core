#!/usr/bin/env node
/**
 * test_overseer.js
 * 
 * 意図的に無限ループ（または長時間Sleep）に入り、
 * The Overseer が正しく SIGKILL を送ってくるかをテストするスクリプト。
 */
const { execSync } = require('child_process');
const path = require('path');

const SESSION_STATE_BIN = path.join(__dirname, 'session_state.js');

console.log('🧪 [TEST] Starting Immortal Architecture Test...');
console.log(`🧪 [TEST] My PID is: ${process.pid}`);

// アクションをセット (TTL: 10秒)
console.log('🧪 [TEST] Setting action "test_infinite_loop" with TTL 10s...');
execSync(`node "${SESSION_STATE_BIN}" set-action "test_infinite_loop" 10 ${process.pid}`, { stdio: 'inherit' });

console.log('🧪 [TEST] Entering busy wait for 30 seconds. The Overseer should kill me in ~10 seconds.');

// 意図的なBusy Wait (Node.jsのイベントループもブロックする)
const start = Date.now();
while (Date.now() - start < 30000) {
  // block
}

// ここには到達しないはず
console.log('❌ [TEST] FAILED: I survived for 30 seconds!');
