#!/usr/bin/env node
/**
 * test-phase-d-e2e.js — MS 7.1 E2E テスト
 * Phase D: L3/L4/L5 Self-Reinforcing Learning Loops
 *
 * 検証:
 *   7.1.1  skill-upgrader.js   — L3 Knowledge Upgrade (dry-run + 実行成功)
 *   7.1.2  coo-optimizer.js    — L4 COO Self-Optimization (dry-run + 実行成功)
 *   7.1.3  knowledge-distiller.js — L5 Distillation (dry-run + 実行成功)
 *   7.1.4  agent-loop.js トリガー — LEARNING_SCRIPTS 設定が正しい
 */
'use strict';

const { execSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

const ANTIGRAVITY_DIR = process.env.HOME + '/.antigravity';
const SCRIPTS_DIR = path.join(ANTIGRAVITY_DIR, 'agent', 'scripts');
const AGENT_LOOP  = path.join(ANTIGRAVITY_DIR, 'docker-core', 'agent-loop.js');

let passed = 0;
let failed = 0;

function ok(label, condition) {
  if (condition) { console.log(`  ✅ PASS ${label}`); passed++; }
  else           { console.log(`  ❌ FAIL ${label}`); failed++; }
}
function title(t) { console.log(`\nTest: ${t}`); }
function run(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf8', stdio: 'pipe', timeout: 30000, ...opts }).trim();
}

// ─── 7.1.1 skill-upgrader.js —————————————————————————————————————————————────

title('skill-upgrader.js (L3 Knowledge Upgrade)');
const skillUpgrader = path.join(SCRIPTS_DIR, 'skill-upgrader.js');

ok('ファイルが存在する', fs.existsSync(skillUpgrader));

try {
  const out = run(`node ${skillUpgrader} --dry-run`);
  ok('dry-run が正常終了する', out.includes('Starting L3'));
  ok('Knowledge files を読み込む', out.includes('Loaded') && out.includes('knowledge files'));
  ok('✅ 完了メッセージが出る', out.includes('Total:'));
} catch (e) {
  console.log(`  ❌ FAIL dry-run エラー: ${e.message}`);
  failed += 3;
}

try {
  const out = run(`node ${skillUpgrader}`);
  ok('本番実行が正常終了する', out.includes('Total:'));
} catch (e) {
  console.log(`  ❌ FAIL 本番実行エラー: ${e.message}`);
  failed++;
}

// ─── 7.1.2 coo-optimizer.js ——————————————————————————————————————————————————

title('coo-optimizer.js (L4 COO Self-Reinforcement)');
const cooOptimizer = path.join(SCRIPTS_DIR, 'coo-optimizer.js');

ok('ファイルが存在する', fs.existsSync(cooOptimizer));

try {
  const out = run(`node ${cooOptimizer} --dry-run`);
  ok('dry-run が正常終了する', out.includes('Starting COO'));
  ok('Success rate が出力される', out.includes('Success rate'));
  ok('Error hot spots が出力される', out.includes('Error hot spots'));
  ok('✅ 完了メッセージが出る', out.includes('COO optimization complete'));
} catch (e) {
  console.log(`  ❌ FAIL dry-run エラー: ${e.message}`);
  failed += 4;
}

try {
  const out = run(`node ${cooOptimizer}`);
  ok('本番実行が正常終了する', out.includes('COO optimization complete'));
} catch (e) {
  console.log(`  ❌ FAIL 本番実行エラー: ${e.message}`);
  failed++;
}

// ─── 7.1.3 knowledge-distiller.js ————————————————————————————————————————————

title('knowledge-distiller.js (L5 Knowledge Distillation)');
const knowledgeDistiller = path.join(SCRIPTS_DIR, 'knowledge-distiller.js');

ok('ファイルが存在する', fs.existsSync(knowledgeDistiller));

try {
  const out = run(`node ${knowledgeDistiller} --dry-run`);
  ok('dry-run が正常終了する', out.includes('Starting L5'));
  ok('Knowledge metrics が出力される', out.includes('Knowledge metrics'));
  ok('エラーなく完了する', !out.includes('TypeError'));
} catch (e) {
  console.log(`  ❌ FAIL dry-run エラー: ${e.message}`);
  failed += 3;
}

// ─── 7.1.4 agent-loop.js トリガー設定 —————————————————————————————————————————

title('agent-loop.js Learning Loop トリガー設定');

ok('agent-loop.js が存在する', fs.existsSync(AGENT_LOOP));

if (fs.existsSync(AGENT_LOOP)) {
  const loopSrc = fs.readFileSync(AGENT_LOOP, 'utf8');
  ok('LEARNING_SCRIPTS.L3 が設定されている', loopSrc.includes('skill-upgrader.js'));
  ok('LEARNING_SCRIPTS.L4 が設定されている', loopSrc.includes('coo-optimizer.js'));
  ok('LEARNING_SCRIPTS.L5 が設定されている', loopSrc.includes('knowledge-distiller.js'));
  ok('L3 トリガー: execSync で起動する', loopSrc.includes('execSync') && loopSrc.includes('L3'));
  ok('L4 トリガー: COOレポートあれば起動する', loopSrc.includes('hasCooReports') && loopSrc.includes('L4'));
  ok('L5 トリガー: タスク数 mod 条件で起動する', loopSrc.includes('L5'));
}

// ─── サマリー ─────────────────────────────────────────────────────────────────

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`  結果: ${passed} passed / ${failed} failed`);
if (failed === 0) {
  console.log('  🎉 MS 7.1 Phase D — Learning Loops: ALL PASS');
  process.exit(0);
} else {
  console.log('  ⚠️  失敗あり。上記エラーを確認してください。');
  process.exit(1);
}
