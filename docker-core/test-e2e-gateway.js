#!/usr/bin/env node
/**
 * test-e2e-gateway.js — Gateway E2E テスト
 * 
 * MS 5.1.5 — Gateway E2E: /core-run → Daemon検知 → ログ出力
 *
 * 検証すること:
 * 1. core-run.js でタスクを pending_tasks に Push できる
 * 2. コンテナ内の daemon-loop がタスクを検知してログを出す
 * 3. タスクが pending → in_progress → (completed 予定) と遷移する
 *
 * Usage (Mac 上):
 *   node test-e2e-gateway.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ANTIGRAVITY_DIR = path.join(process.env.HOME, '.antigravity');
const STATE_FILE = path.join(ANTIGRAVITY_DIR, '.session_state.json');
const CONTAINER_NAME = 'daemon_core';
const CORE_RUN = path.join(ANTIGRAVITY_DIR, 'agent/scripts/core-run.js');

let passed = 0;
let failed = 0;

function run(cmd) { return execSync(cmd, { encoding: 'utf8', stdio: 'pipe' }).trim(); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function pass(msg) { console.log(`  ✅ ${msg}`); passed++; }
function fail(msg) { console.error(`  ❌ ${msg}`); failed++; }
function log(msg)  { console.log(`[e2e] ${msg}`); }

async function main() {
  console.log('\n🚀 Gateway E2E テスト — MS 5.1.5\n');

  // --- Step 1: docker compose が起動しているか確認 ---
  log('Step 1: コンテナ稼働確認');
  try {
    const running = run(`docker inspect --format '{{.State.Running}}' ${CONTAINER_NAME}`);
    if (running === 'true') pass('コンテナ起動中');
    else { fail('コンテナが起動していない。先に: docker compose up -d'); process.exit(1); }
  } catch (e) { fail(`コンテナ ${CONTAINER_NAME} が見つかりません`); process.exit(1); }

  // --- Step 2: core-run.js でタスクをPush ---
  log('Step 2: core-run.js でテストタスクを Push');
  const taskLabel = `e2e_test_${Date.now()}`;
  try {
    run(`node ${CORE_RUN} "${taskLabel}" --ttl 60`);
    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    const pushed = state.pending_tasks.find(t => t.task === taskLabel);
    if (pushed) pass(`タスクが pending_tasks に Push されました (id: ${pushed.id})`);
    else fail('タスクが pending_tasks に見つかりません');
  } catch (e) { fail(`core-run.js 実行エラー: ${e.message}`); }

  // --- Step 3: Daemon がタスクを検知したか確認 (ログ監視) ---
  log('Step 3: Daemon ログを 10 秒間監視してタスク検知を確認');
  let detected = false;
  const start = Date.now();
  while (Date.now() - start < 10000) {
    try {
      const logs = run(`docker logs ${CONTAINER_NAME} --since 10s 2>&1`);
      if (logs.includes(taskLabel) || logs.includes('Found new task')) {
        detected = true;
        break;
      }
    } catch (e) {}
    await sleep(1000);
  }
  if (detected) pass('Daemon がタスクを検知しログに出力しました');
  else fail('10秒以内に Daemon がタスクを検知しませんでした（Daemon が起動しているか確認）');

  // --- Step 4: State を確認 ---
  log('Step 4: pending_tasks の状態確認');
  try {
    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    const remaining = (state.pending_tasks || []).filter(t => t.task === taskLabel);
    if (remaining.length === 0) {
      pass('タスクが pending_tasks から消えました（完了または in_progress移行）');
    } else if (remaining[0].status === 'in_progress') {
      pass(`タスクが in_progress に遷移しました`);
    } else {
      fail(`タスクがまだ pending です: ${JSON.stringify(remaining[0])}`);
    }
  } catch (e) { fail(`State 読み込みエラー: ${e.message}`); }

  // --- Report ---
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  結果: ${passed} passed / ${failed} failed`);
  if (failed === 0) {
    console.log('  🎉 MS 5.1.5 Gateway E2E: PASS');
    console.log('  core-run → Daemon検知 → ログ出力 の一気通貫を確認しました。');
    process.exit(0);
  } else {
    console.log('  ⚠️  一部テストが失敗しました。上記のエラーを確認してください。');
    process.exit(1);
  }
}

main();
