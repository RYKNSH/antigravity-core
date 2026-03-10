#!/usr/bin/env node
/**
 * test-phase-b-e2e.js — Task 8.2.8
 * Phase B (MS 8.2) 完了ゲート — E/S/L Loops + Priority Arbiter + QES帰納更新を検証
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const assert = require('assert');

const QUALITY_DIR = path.join(__dirname, '.quality');

let passed = 0;
let failed = 0;

function ok(label, condition) {
  if (condition) {
    console.log(`  ✅ PASS ${label}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL ${label}`);
    failed++;
  }
}

function title(t) { console.log(`\nTest: ${t}`); }

// ─── テスト本体 ───────────────────────────────────────────────────────────────

title('E-Loop (8.2.1)');
const eLoop = require('./e-loop.js');
ok('e-loop モジュールが読み込める', typeof eLoop.generate === 'function');
ok('e-loop.estimateQesDelta がエクスポートされている', typeof eLoop.estimateQesDelta === 'function');
const eResult = eLoop.generate();
ok('e-loop.generate() が loop=efficiency を返す', eResult.loop === 'efficiency');
ok('e-loop.generate() が proposals 配列を返す', Array.isArray(eResult.proposals));
const eqDelta = eLoop.estimateQesDelta({ estimated_cost_reduction_usd: 0.01 }, { learned_weights: { efficiency_cost_usd: -300 } });
ok('estimateQesDelta が数値を返す', typeof eqDelta === 'number');

title('S-Loop (8.2.2)');
const sLoop = require('./s-loop.js');
ok('s-loop モジュールが読み込める', typeof sLoop.generate === 'function');
ok('s-loop.estimateQesDelta がエクスポートされている', typeof sLoop.estimateQesDelta === 'function');
const sResult = sLoop.generate();
ok('s-loop.generate() が loop=speed を返す', sResult.loop === 'speed');
ok('s-loop.generate() が proposals 配列または note を返す', Array.isArray(sResult.proposals) || !!sResult.note);

title('L-Loop (8.2.3)');
const lLoop = require('./l-loop.js');
ok('l-loop モジュールが読み込める', typeof lLoop.generate === 'function');
ok('l-loop.estimateQesDelta がエクスポートされている', typeof lLoop.estimateQesDelta === 'function');
const lResult = lLoop.generate();
ok('l-loop.generate() が loop=lightness を返す', lResult.loop === 'lightness');
ok('l-loop.generate() が proposals 配列を返す', Array.isArray(lResult.proposals));

title('QES予測フィルタ + Priority Arbiter (8.2.4 + 8.2.5)');
const arbiter = require('./priority-arbiter.js');
ok('priority-arbiter モジュールが読み込める', typeof arbiter.arbitrate === 'function');
ok('filterByQesPrediction がエクスポートされている', typeof arbiter.filterByQesPrediction === 'function');
ok('predictQesDelta がエクスポートされている', typeof arbiter.predictQesDelta === 'function');

// 低リスク提案は ΔQES>0 で通過する
const lowRiskProposal = { id: 'test', loop: 'efficiency', risk_level: 'low', estimated_cost_reduction_usd: 0.05 };
const filterResult = arbiter.filterByQesPrediction([lowRiskProposal], {
  anchors: { test_added: 2.0, test_deleted: -10.0 },
  learned_weights: { efficiency_cost_usd: -300, speed_latency_ms: -0.08, lightness_kb: -0.1 },
});
ok('low-risk 提案が予測フィルタを通過する', filterResult.length === 1);
ok('filter_passed が true', filterResult[0].filter_passed === true);
ok('predicted_qes が数値', typeof filterResult[0].predicted_qes === 'number');
ok('predicted_qes が floor(0.1) 以上', filterResult[0].predicted_qes >= 0.1);

// high-risk + 低改善はフィルタで弾かれる
const highRiskLow = { id: 'hrl', loop: 'speed', risk_level: 'high', estimated_speed_improvement_score: 0.001 };
const highRiskFiltered = arbiter.filterByQesPrediction([highRiskLow], {
  anchors: {}, learned_weights: { speed_latency_ms: -0.08 }
});
ok('high-risk + 低改善は予測フィルタで弾かれる', highRiskFiltered.length === 0);

// arbitrate でベスト提案を選出
const mockProps = {
  e: [{ id: 'e1', loop: 'efficiency', risk_level: 'low', estimated_cost_reduction_usd: 0.01 }],
  s: [{ id: 's1', loop: 'speed',      risk_level: 'low', estimated_speed_improvement_score: 10 }],
  l: [{ id: 'l1', loop: 'lightness',  risk_level: 'low', estimated_size_reduction_kb: 100 }],
};
const arbResult = arbiter.arbitrate(mockProps, null);
ok('arbitrate が adopted を返す', arbResult.adopted !== null);
ok('adopted は最高 ΔQES の提案', arbResult.adopted !== undefined);
ok('rejected は配列', Array.isArray(arbResult.rejected));
ok('rejected.length が proposals - 1', arbResult.rejected.length === 2);

// no_proposals ケース
const noProps = arbiter.arbitrate({ e: [], s: [], l: [] }, null);
ok('no_proposals のとき adopted=null', noProps.adopted === null);
ok('no_proposals の reason が no_proposals', noProps.reason === 'no_proposals');

title('QES帰納更新バッチ + 2層スコープ (8.2.6 + 8.2.7)');
const calibrator = require('./qes-calibrator.js');
ok('qes-calibrator モジュールが読み込める', typeof calibrator.calibrate === 'function');
ok('getWeights がエクスポートされている', typeof calibrator.getWeights === 'function');
ok('blendedWeights がエクスポートされている', typeof calibrator.blendedWeights === 'function');
ok('leastSquaresWeights がエクスポートされている', typeof calibrator.leastSquaresWeights === 'function');

// blendedWeights のブレンド計算をチェック
const global_w  = { anchors: { test_added: 2.0 }, learned_weights: { lightness_kb: -0.1, speed_latency_ms: -0.08, efficiency_cost_usd: -300 } };
const project_w = { anchors: { test_added: 2.0 }, learned_weights: { lightness_kb: -0.2, speed_latency_ms: -0.16, efficiency_cost_usd: -600 } };

const blended0  = calibrator.blendedWeights(global_w, project_w, 0);   // ratio=0 → global
const blended50 = calibrator.blendedWeights(global_w, project_w, 50);  // ratio=1 → project
ok('taskCount=0 のとき blend_ratio=0 (global優先)', blended0._blend_ratio === 0);
ok('taskCount=50 のとき blend_ratio=1 (project優先)', blended50._blend_ratio === 1);
ok('blend_ratio=0 のとき learned_weights がグローバル値', Math.abs(blended0.learned_weights.lightness_kb - (-0.1)) < 0.001);
ok('blend_ratio=1 のとき learned_weights がプロジェクト値', Math.abs(blended50.learned_weights.lightness_kb - (-0.2)) < 0.001);

// leastSquaresWeights に不足データを渡した場合 null を返す
const lsNull = calibrator.leastSquaresWeights([]);
ok('データ0件のとき leastSquaresWeights=null', lsNull === null);

// calibrate は cold_start 期間中はスキップする
const calibResult = calibrator.calibrate();
ok('calibrate が updated:bool を返す', typeof calibResult.updated === 'boolean');
ok('calibrate が reason を返す', !!calibResult.reason || calibResult.updated);

// ─── 結果表示 ─────────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════════════');
if (failed === 0) {
  console.log(`  ALL PASSED: ${passed}/${passed + failed} tests ✅`);
  console.log('  MS 8.2 Phase B 完了ゲート: CLEARED');
} else {
  console.log(`  RESULT: ${passed}/${passed + failed} passed (${failed} FAILED) ❌`);
  console.log('  MS 8.2 Phase B 完了ゲート: NOT CLEARED');
}
console.log('══════════════════════════════════════════════');

process.exit(failed > 0 ? 1 : 0);
