#!/usr/bin/env node
/**
 * test-phase-9-e2e.js — Phase 9 E2E テスト
 * Trinity 完全自律運転の全コンポーネント検証
 *
 * 検証:
 *   9.1.1  trinity-quality-controller.js — trinityHealth() 統合ヘルスチェック
 *   9.1.2  e-loop.js                     — Efficiency Loop (generate関数)
 *   9.1.3  s-loop.js                     — Speed Loop (generate関数)
 *   9.1.4  l-loop.js                     — Lightness Loop (generate関数)
 *   9.1.5  priority-arbiter.js           — 優先度調停ロジック
 *   9.1.6  qes-calibrator.js             — QES帰納更新
 *   9.1.7  agent-loop.js Integration     — COST追跡・Blacklist・Outbox定数確認
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const DOCKER_CORE = __dirname;
const ANTIGRAVITY_DIR = process.env.HOME + '/.antigravity';

let passed = 0;
let failed = 0;

function ok(label, condition) {
  if (condition) { console.log(`  ✅ PASS ${label}`); passed++; }
  else           { console.log(`  ❌ FAIL ${label}`); failed++; }
}
function title(t) { console.log(`\n📋 Test: ${t}`); }

// ─── 9.1.1: trinity-quality-controller.js ────────────────────────────────────

title('trinity-quality-controller.js (Trinity統合ヘルスチェック)');

const tqcPath = path.join(DOCKER_CORE, 'trinity-quality-controller.js');
ok('ファイルが存在する', fs.existsSync(tqcPath));

let tqc;
try {
  tqc = require(tqcPath);
  ok('モジュール読み込み成功', typeof tqc === 'object');
  ok('ceoReport 関数が存在する', typeof tqc.ceoReport === 'function');
  ok('cooOrchestrate 関数が存在する', typeof tqc.cooOrchestrate === 'function');
  ok('daemonCalibrate 関数が存在する', typeof tqc.daemonCalibrate === 'function');
  ok('trinityHealth 関数が存在する', typeof tqc.trinityHealth === 'function');

  // trinityHealth() を実行して構造を確認
  const health = tqc.trinityHealth();
  ok('trinityHealth()がオブジェクトを返す', typeof health === 'object' && health !== null);
  ok('healthy フィールドが boolean', typeof health.healthy === 'boolean');
  ok('timestamp フィールドが存在する', typeof health.timestamp === 'string');
  ok('ceo フィールドが存在する', typeof health.ceo === 'object');
  ok('coo フィールドが存在する', typeof health.coo === 'object');
  ok('daemon フィールドが存在する', typeof health.daemon === 'object');
  console.log(`    → healthy=${health.healthy}, ceo.gaps=${health.ceo.gaps}, coo.env_ok=${health.coo.env_ok}`);

  // ceoReport() の構造確認
  const ceoResult = tqc.ceoReport();
  ok('ceoReport()がオブジェクトを返す', typeof ceoResult === 'object');
  ok('ceoReport()に gaps 配列がある', Array.isArray(ceoResult.gaps));

} catch (e) {
  console.log(`  ❌ FAIL trinity-quality-controller.js 読み込み/実行エラー: ${e.message}`);
  failed += 10;
}

// ─── 9.1.2: e-loop.js (Efficiency Loop) ─────────────────────────────────────

title('e-loop.js (Efficiency Loop)');

const eLoopPath = path.join(DOCKER_CORE, 'e-loop.js');
ok('ファイルが存在する', fs.existsSync(eLoopPath));

try {
  const eLoop = require(eLoopPath);
  ok('generate 関数が存在する', typeof eLoop.generate === 'function');
  ok('estimateQesDelta 関数が存在する', typeof eLoop.estimateQesDelta === 'function');

  const result = eLoop.generate({});
  ok('generate() がオブジェクトを返す', typeof result === 'object');
  ok('proposals 配列が存在する', Array.isArray(result.proposals));
  ok('loop フィールドが "efficiency"', result.loop === 'efficiency');

  // estimateQesDelta のロジック
  const delta = eLoop.estimateQesDelta({ estimated_cost_reduction_usd: 0.01 }, { learned_weights: { efficiency_cost_usd: -300 } });
  ok('estimateQesDelta が数値を返す', typeof delta === 'number');

} catch (e) {
  console.log(`  ❌ FAIL e-loop.js エラー: ${e.message}`);
  failed += 5;
}

// ─── 9.1.3: s-loop.js (Speed Loop) ───────────────────────────────────────────

title('s-loop.js (Speed Loop)');

const sLoopPath = path.join(DOCKER_CORE, 's-loop.js');
ok('ファイルが存在する', fs.existsSync(sLoopPath));

try {
  const sLoop = require(sLoopPath);
  ok('generate 関数が存在する', typeof sLoop.generate === 'function');
  ok('estimateQesDelta 関数が存在する', typeof sLoop.estimateQesDelta === 'function');

  const result = sLoop.generate({});
  ok('generate() がオブジェクトを返す', typeof result === 'object');
  ok('proposals 配列が存在する', Array.isArray(result.proposals));
  ok('loop フィールドが "speed"', result.loop === 'speed');

} catch (e) {
  console.log(`  ❌ FAIL s-loop.js エラー: ${e.message}`);
  failed += 4;
}

// ─── 9.1.4: l-loop.js (Lightness Loop) ───────────────────────────────────────

title('l-loop.js (Lightness Loop)');

const lLoopPath = path.join(DOCKER_CORE, 'l-loop.js');
ok('ファイルが存在する', fs.existsSync(lLoopPath));

try {
  const lLoop = require(lLoopPath);
  ok('generate 関数が存在する', typeof lLoop.generate === 'function');
  ok('estimateQesDelta 関数が存在する', typeof lLoop.estimateQesDelta === 'function');

  const result = lLoop.generate({});
  ok('generate() がオブジェクトを返す', typeof result === 'object');
  ok('proposals 配列が存在する', Array.isArray(result.proposals));
  ok('loop フィールドが "lightness"', result.loop === 'lightness');

} catch (e) {
  console.log(`  ❌ FAIL l-loop.js エラー: ${e.message}`);
  failed += 4;
}

// ─── 9.1.5: priority-arbiter.js ──────────────────────────────────────────────

title('priority-arbiter.js (優先度調停)');

const arbiterPath = path.join(DOCKER_CORE, 'priority-arbiter.js');
ok('ファイルが存在する', fs.existsSync(arbiterPath));

try {
  const arbiter = require(arbiterPath);
  ok('モジュール読み込み成功', typeof arbiter === 'object');

  // arbitrate または decide 関数が存在するか確認
  const hasFn = typeof arbiter.arbitrate === 'function' ||
                typeof arbiter.decide === 'function' ||
                typeof arbiter.selectTask === 'function' ||
                typeof arbiter.run === 'function';
  ok('主要関数が存在する (arbitrate/decide/selectTask/run のいずれか)', hasFn);

} catch (e) {
  console.log(`  ❌ FAIL priority-arbiter.js エラー: ${e.message}`);
  failed += 2;
}

// ─── 9.1.6: qes-calibrator.js ────────────────────────────────────────────────

title('qes-calibrator.js (QES帰納更新)');

const calibratorPath = path.join(DOCKER_CORE, 'qes-calibrator.js');
ok('ファイルが存在する', fs.existsSync(calibratorPath));

try {
  const calibrator = require(calibratorPath);
  ok('calibrate 関数が存在する', typeof calibrator.calibrate === 'function');

  const result = calibrator.calibrate();
  ok('calibrate() がオブジェクトを返す', typeof result === 'object');
  ok('calibrate() に status フィールドがある',
     result.status !== undefined || result.skipped !== undefined || result.updated !== undefined);

} catch (e) {
  console.log(`  ❌ FAIL qes-calibrator.js エラー: ${e.message}`);
  failed += 3;
}

// ─── 9.1.7: agent-loop.js 統合チェック ───────────────────────────────────────

title('agent-loop.js 統合チェック (Trinity連携定数)');

const agentLoopPath = path.join(DOCKER_CORE, 'agent-loop.js');
ok('agent-loop.js が存在する', fs.existsSync(agentLoopPath));

if (fs.existsSync(agentLoopPath)) {
  const src = fs.readFileSync(agentLoopPath, 'utf8');

  // Trinity コンポーネント連携
  ok('trinity-quality-controller.js への参照がある',
     src.includes('trinity-quality-controller') || src.includes('trinityHealth') || src.includes('daemonCalibrate'));
  ok('Outbox Pattern が実装されている', src.includes('OUTBOX_DIR') || src.includes('outbox'));
  ok('Cost Tracker が実装されている', src.includes('COST_FILE') || src.includes('trackLLMCost'));
  ok('Blacklist が実装されている', src.includes('BLACKLIST_FILE') || src.includes('isBlacklisted'));
  ok('F3 completed_tasks rotate が実装されている', src.includes('COMPLETED_TASKS_MAX') || src.includes('completed_archive'));
  ok('Q3 Runaway 検知が実装されている', src.includes('RUNAWAY_TASK_LIMIT') || src.includes('checkRunaway'));
  ok('Q1 Priority Queue が実装されている', src.includes('getNextTask') || src.includes('PRIORITY_ORDER'));
  ok('gitコマンド禁止ブロックがある', src.includes('GIT_WRITE_PATTERNS') || src.includes('git push'));
  ok('Phase 9 または Phase 10 コメントが存在する', src.includes('Phase 9') || src.includes('Phase 10'));
}

// ─── 9.1.8: quality-guardian.js 統合確認 ─────────────────────────────────────

title('quality-guardian.js (品質ガーディアン統合)');

const guardianPath = path.join(DOCKER_CORE, 'quality-guardian.js');
ok('ファイルが存在する', fs.existsSync(guardianPath));

try {
  const guardian = require(guardianPath);
  ok('guard 関数が存在する', typeof guardian.guard === 'function');
  ok('emitAlert 関数が存在する', typeof guardian.emitAlert === 'function');
  ok('getRecentAlerts 関数が存在する', typeof guardian.getRecentAlerts === 'function');

  // モックTEOでguard()を実行
  const mockTeo = {
    task_id: 'test_phase9',
    qes_delta: 0.5,
    stagnation_count: 2,
    coo_calls: 1,
    worker_measurements: { tests_deleted: 0, llm_calls: 30 },
  };
  const guardResult = guardian.guard(mockTeo);
  ok('guard() がオブジェクトを返す', typeof guardResult === 'object');
  ok('guard() に blocked フィールドがある', typeof guardResult.blocked === 'boolean');
  ok('guard() に alerts 配列がある', Array.isArray(guardResult.alerts));
  ok('モックTEOでblockされない (正常値)', !guardResult.blocked);

} catch (e) {
  console.log(`  ❌ FAIL quality-guardian.js エラー: ${e.message}`);
  failed += 5;
}

// ─── サマリー ─────────────────────────────────────────────────────────────────

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`  結果: ${passed} passed / ${failed} failed`);
if (failed === 0) {
  console.log('  🎉 Phase 9 — Trinity完全自律運転: ALL PASS');
  process.exit(0);
} else {
  console.log('  ⚠️  失敗あり。上記エラーを確認してください。');
  process.exit(1);
}
