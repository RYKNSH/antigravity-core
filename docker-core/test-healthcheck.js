#!/usr/bin/env node
/**
 * test-healthcheck.js — HEALTHCHECK TTL 超過で自動復旧することをテストする
 *
 * MS 5.1.3 — HEALTHCHECK 自動再起動テスト
 *
 * このスクリプトは Mac 上で `docker compose` を叩いて以下を検証する:
 * 1. コンテナが起動していること
 * 2. State に action_ttl=5 (秒) の "stuck task" を書き込む
 * 3. 10秒待って HEALTHCHECK が unhealthy を検知するのを待つ
 * 4. Docker が自動再起動したことを確認する（uptime が reset される）
 *
 * Usage:
 *   node test-healthcheck.js
 */

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ANTIGRAVITY_DIR = path.join(process.env.HOME, '.antigravity');
const STATE_FILE = path.join(ANTIGRAVITY_DIR, '.session_state.json');
const CONTAINER_NAME = 'daemon_core';

function run(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf8', stdio: 'pipe', ...opts }).trim();
}

function log(msg) { console.log(`[healthcheck-test] ${msg}`); }
function warn(msg) { console.warn(`[healthcheck-test] ⚠️  ${msg}`); }
function pass(msg) { console.log(`[healthcheck-test] ✅ ${msg}`); }
function fail(msg) { console.error(`[healthcheck-test] ❌ ${msg}`); process.exit(1); }

// --- Step 1: コンテナが起動しているか確認 ---
log('Step 1: コンテナ稼働確認...');
try {
  const running = run(`docker inspect --format '{{.State.Running}}' ${CONTAINER_NAME}`);
  if (running !== 'true') fail(`Container ${CONTAINER_NAME} is not running. Run: docker compose up -d`);
  pass('コンテナ起動中');
} catch (e) {
  fail(`Container not found: ${CONTAINER_NAME}. Run: docker compose up -d`);
}

// --- Step 2: 起動時刻を記録 ---
log('Step 2: 起動時刻（StartedAt）を記録...');
const startTimeBefore = run(`docker inspect --format '{{.State.StartedAt}}' ${CONTAINER_NAME}`);
log(`  StartedAt before: ${startTimeBefore}`);

// --- Step 3: TTL=5秒のスタックタスクをStateに書き込む ---
log('Step 3: action_ttl=5 の stuck task を State に書き込む...');
let state = {};
if (fs.existsSync(STATE_FILE)) {
  try { state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch(e) {}
}
const originalCurrent = JSON.parse(JSON.stringify(state.current || {}));
state.current = {
  ...state.current,
  action: 'healthcheck_test_stuck_task',
  action_ttl: 5,
  action_updated_at: new Date(Date.now() - 10000).toISOString(), // 10秒前の時刻で書き込む → 即TTL超過
};
fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
pass('Stuck task を State に書き込みました（TTL超過状態）');

// --- Step 4: HEALTHCHECK が unhealthy を検知するのを待つ ---
log('Step 4: HEALTHCHECK が unhealthy を検知するのを待つ... (最大30秒)');
let unhealthyDetected = false;
for (let i = 0; i < 30; i++) {
  execSync('sleep 1');
  try {
    const health = run(`docker inspect --format '{{.State.Health.Status}}' ${CONTAINER_NAME}`);
    log(`  ${i + 1}s: health=${health}`);
    if (health === 'unhealthy') {
      unhealthyDetected = true;
      break;
    }
  } catch (e) { /* container may be restarting */ }
}

if (!unhealthyDetected) {
  warn('unhealthy が検知されませんでした。HEALTHCHECK 設定を確認してください。');
  // State を元に戻す
  state.current = originalCurrent;
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  process.exit(1);
}
pass('HEALTHCHECK が unhealthy を検知しました');

// --- Step 5: Docker が自動再起動したことを確認 ---
log('Step 5: Docker による自動再起動を待つ... (最大20秒)');
execSync('sleep 5');
let restarted = false;
for (let i = 0; i < 20; i++) {
  execSync('sleep 1');
  try {
    const startTimeAfter = run(`docker inspect --format '{{.State.StartedAt}}' ${CONTAINER_NAME}`);
    if (startTimeAfter !== startTimeBefore) {
      pass(`コンテナが自動再起動されました`);
      pass(`  Before: ${startTimeBefore}`);
      pass(`  After : ${startTimeAfter}`);
      restarted = true;
      break;
    }
  } catch (e) { /* container may be restarting */ }
}

if (!restarted) {
  fail('コンテナの自動再起動が確認できませんでした。restart: always 設定を確認してください。');
}

// --- 完了 ---
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  MS 5.1.3 HEALTHCHECK 自動再起動テスト: PASS 🎉');
console.log('  Docker が TTL超過を検知し、コンテナを自動再起動することを確認しました。');
