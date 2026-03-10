#!/usr/bin/env node
/**
 * test-phase-a-e2e.js — Task 8.1.8
 * Phase A (MS 8.1) の完了ゲートとなる E2Eテスト。
 * Stagnation → Environment Check → COO-Lite → hint記録 → TEO 4軸スコア確認
 * の一連のフローをモック環境で検証する。
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ─── ANSI カラー ─────────────────────────────────────────────────────────────
const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET  = '\x1b[0m';
const BOLD   = '\x1b[1m';

let passCount = 0;
let failCount = 0;

function assert(condition, label, detail = '') {
  if (condition) {
    console.log(`  ${GREEN}✅ PASS${RESET} ${label}`);
    passCount++;
  } else {
    console.log(`  ${RED}❌ FAIL${RESET} ${label}${detail ? ': ' + detail : ''}`);
    failCount++;
  }
}

// ─── テスト環境セットアップ ──────────────────────────────────────────────────

const ANTIGRAVITY_DIR = process.env.ANTIGRAVITY_DIR || path.join(process.env.HOME, '.antigravity');
const QUALITY_DIR     = path.join(ANTIGRAVITY_DIR, 'quality');

// テスト用の一時ディレクトリ
const TMP_QUALITY_DIR = path.join(__dirname, '.quality_test_e2e');
process.env._TEST_QUALITY_DIR = TMP_QUALITY_DIR;

function setup() {
  fs.mkdirSync(TMP_QUALITY_DIR, { recursive: true });
  fs.mkdirSync(QUALITY_DIR, { recursive: true });
  // COO state をリセット
  const cooState = path.join(TMP_QUALITY_DIR, 'coo_lite_state.json');
  if (fs.existsSync(cooState)) fs.unlinkSync(cooState);
}

function cleanup() {
  try { fs.rmSync(TMP_QUALITY_DIR, { recursive: true, force: true }); } catch (_) {}
}

// ─── Test 1: bootstrap-goals.js ─────────────────────────────────────────────
async function test_bootstrap_goals() {
  console.log(`\n${BOLD}Test 1: bootstrap-goals.js${RESET}`);
  const goalsFile = path.join(QUALITY_DIR, 'goals.json');

  // 既存 goals.json を退避
  const backup = goalsFile + '.bak';
  if (fs.existsSync(goalsFile)) fs.renameSync(goalsFile, backup);

  try {
    const { execSync } = require('child_process');
    execSync(`node ${path.join(ANTIGRAVITY_DIR, 'agent/scripts/bootstrap-goals.js')} --force`, {
      cwd: ANTIGRAVITY_DIR, encoding: 'utf8', timeout: 90_000,
      env: { ...process.env, ANTIGRAVITY_DIR },
    });

    assert(fs.existsSync(goalsFile), 'goals.json が生成された');

    const goals = JSON.parse(fs.readFileSync(goalsFile, 'utf8'));
    assert(typeof goals.quality_pass_rate === 'number' && goals.quality_pass_rate > 0, 'quality_pass_rate が設定された');
    assert(goals._mode === 'cold_start', '_mode = cold_start');
    assert(typeof goals._generated_at === 'string', '_generated_at が設定された');
  } catch (e) {
    assert(false, 'bootstrap-goals.js 実行', e.message);
  } finally {
    // バックアップ復元
    if (fs.existsSync(backup)) fs.renameSync(backup, goalsFile);
  }
}

// ─── Test 2: teo_schema.json の存在確認 ─────────────────────────────────────
async function test_teo_schema() {
  console.log(`\n${BOLD}Test 2: TEO スキーマ (8.1.2)${RESET}`);
  const schemaPath = path.join(__dirname, 'quality', 'teo_schema.json');

  assert(fs.existsSync(schemaPath), 'teo_schema.json が存在する');

  if (fs.existsSync(schemaPath)) {
    try {
      const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
      assert(schema.required?.includes('task_id'),         'task_id が required に含まれる');
      assert(schema.required?.includes('scores'),          'scores が required に含まれる');
      assert(schema.required?.includes('stagnation_count'),'stagnation_count が required に含まれる');
      assert(schema.required?.includes('coo_calls'),       'coo_calls が required に含まれる');
      const scoreProps = schema.properties?.scores?.properties;
      assert(scoreProps?.quality   !== undefined, 'scores.quality が定義されている');
      assert(scoreProps?.efficiency !== undefined,'scores.efficiency が定義されている');
      assert(scoreProps?.speed     !== undefined, 'scores.speed が定義されている');
      assert(scoreProps?.lightness  !== undefined,'scores.lightness が定義されている');
    } catch (e) {
      assert(false, 'teo_schema.json パース', e.message);
    }
  }
}

// ─── Test 3: qes_weights_global.json ────────────────────────────────────────
async function test_qes_weights() {
  console.log(`\n${BOLD}Test 3: QES 重みファイル (8.1.7)${RESET}`);
  const weightsFile = path.join(QUALITY_DIR, 'qes_weights_global.json');

  assert(fs.existsSync(weightsFile), 'qes_weights_global.json が存在する');

  if (fs.existsSync(weightsFile)) {
    try {
      const w = JSON.parse(fs.readFileSync(weightsFile, 'utf8'));
      assert(w.anchors?.test_added  === 2.0,  'anchors.test_added = 2.0 (公理アンカー)');
      assert(w.anchors?.test_deleted === -10.0,'anchors.test_deleted = -10.0 (公理アンカー)');
      assert(typeof w.learned_weights?.lightness_kb === 'number',    'learned_weights.lightness_kb が設定されている');
      assert(typeof w.learned_weights?.speed_latency_ms === 'number','learned_weights.speed_latency_ms が設定されている');
      assert(w._mode === 'cold_start', '_mode = cold_start');
      assert(typeof w._cold_start_until === 'number', '_cold_start_until が設定されている');
    } catch (e) {
      assert(false, 'qes_weights_global.json パース', e.message);
    }
  }
}

// ─── Test 4: environment-check.js ───────────────────────────────────────────
async function test_environment_check() {
  console.log(`\n${BOLD}Test 4: Environment Check (8.1.6)${RESET}`);
  const envCheck = require('./environment-check');

  try {
    const { passed, results } = await envCheck.run();
    assert(Array.isArray(results) && results.length === 4, '4チェックが実行された');
    const names = results.map((r) => r.name);
    assert(names.includes('volume_mount'),      'volume_mount チェックが含まれる');
    assert(names.includes('env_variables'),     'env_variables チェックが含まれる');
    assert(names.includes('file_permissions'),  'file_permissions チェックが含まれる');
    assert(names.includes('api_reachability'),  'api_reachability チェックが含まれる');
    results.forEach((r) => {
      assert(typeof r.ok === 'boolean' && typeof r.detail === 'string', `[${r.name}] ok + detail が存在する`);
    });
  } catch (e) {
    assert(false, 'environment-check.js 実行', e.message);
  }
}

// ─── Test 5: quality-scorer.js（モック実行）─────────────────────────────────
async function test_quality_scorer() {
  console.log(`\n${BOLD}Test 5: Quality Scorer (8.1.3)${RESET}`);

  // QUALITY_DIR を一時ディレクトリにリダイレクト（実際のnpm testを避ける）
  const origDir = path.join(__dirname, '.quality');
  const scorer  = require('./quality-scorer');

  // scorer.score() はタスクIDとオプションを受け取る
  try {
    const teo = await scorer.score(`test_e2e_${Date.now()}`, {
      cwd        : __dirname,
      taskCount  : 0,
      prevScores : { quality: 0.8, efficiency: 0.005, speed: null, lightness: null },
    });

    assert(teo.task_id         !== '',  'TEO に task_id が記録された');
    assert(teo.completed_at    !== '',  'TEO に completed_at が記録された');
    assert(typeof teo.scores.quality    === 'number', 'TEO scores.quality が記録された');
    assert(typeof teo.scores.efficiency === 'number', 'TEO scores.efficiency が記録された');
    assert(typeof teo.qes_delta         === 'number', 'TEO qes_delta が計算された');
    assert(teo.stagnation_count >= 0,                 'TEO stagnation_count が記録された');
    assert(teo.coo_calls >= 0,                        'TEO coo_calls が記録された');

    // TEO ファイルが .quality/ に保存されているか
    const teoFile = path.join(origDir, `teo_${teo.task_id}.json`);
    assert(fs.existsSync(teoFile), 'TEO ファイルが .quality/ に保存された');
    if (fs.existsSync(teoFile)) fs.unlinkSync(teoFile); // クリーンアップ
  } catch (e) {
    assert(false, 'quality-scorer.score() 実行', e.message);
  }
}

// ─── Test 6: COO-Lite rate limit ─────────────────────────────────────────────
async function test_coo_rate_limit() {
  console.log(`\n${BOLD}Test 6: COO-Lite Rate Limit (8.1.5)${RESET}`);
  const cooLite = require('./coo-lite');

  // ① stagnation >= STAGNATION_SUSPEND → SUSPEND
  const suspendResult = cooLite.checkRateLimit('suspend_test', 10);
  assert(suspendResult.allowed === false && suspendResult.reason.includes('SUSPEND'),
    'stagnation 10 回以上で SUSPEND される');

  // ② max_calls_per_task 超過（状態をモック）
  const stateFile = path.join(__dirname, '.quality', 'coo_lite_state.json');
  fs.mkdirSync(path.join(__dirname, '.quality'), { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify({ task_ratelimit_test: { calls: 3, lastCallAt: Date.now() - 1000 } }));
  const maxResult = cooLite.checkRateLimit('ratelimit_test', 1);
  assert(maxResult.allowed === false && maxResult.reason.includes('Rate limit'),
    '3回呼び出し後は Rate limit でブロックされる');

  // ③ stagnation < 10、calls = 0 → allowed
  const okResult = cooLite.checkRateLimit('fresh_task_' + Date.now(), 3);
  assert(okResult.allowed === true, 'stagnation < 10 かつ calls = 0 で許可される');

  // クリーンアップ
  if (fs.existsSync(stateFile)) fs.unlinkSync(stateFile);
}

// ─── テスト実行 ──────────────────────────────────────────────────────────────
async function main() {
  console.log(`${BOLD}══════════════════════════════════════════════${RESET}`);
  console.log(`${BOLD}  Phase A (MS 8.1) E2E Test — test-phase-a-e2e.js${RESET}`);
  console.log(`${BOLD}══════════════════════════════════════════════${RESET}`);
  console.log(`  Time: ${new Date().toISOString()}`);

  setup();

  await test_bootstrap_goals();
  await test_teo_schema();
  await test_qes_weights();
  await test_environment_check();
  await test_quality_scorer();
  await test_coo_rate_limit();

  cleanup();

  console.log(`\n${BOLD}══════════════════════════════════════════════${RESET}`);
  const total = passCount + failCount;
  if (failCount === 0) {
    console.log(`${GREEN}${BOLD}  ALL PASSED: ${passCount}/${total} tests passed ✅${RESET}`);
    console.log(`${GREEN}  MS 8.1 Phase A 完了ゲート: CLEARED${RESET}`);
  } else {
    console.log(`${RED}${BOLD}  FAILED: ${failCount}/${total} tests failed ❌${RESET}`);
    console.log(`${YELLOW}  MS 8.1 Phase A 完了ゲート: NOT CLEARED${RESET}`);
  }
  console.log(`${BOLD}══════════════════════════════════════════════${RESET}\n`);

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
