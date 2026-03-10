#!/usr/bin/env node
/**
 * priority-arbiter.js — Task 8.2.4 + 8.2.5
 *
 * [8.2.4] QES予測フィルタ: 各Loop提案をルールベースでestimateQES。
 *         risk_level 4ルールテーブルでフィルタリング。
 *
 * [8.2.5] Priority Arbiter: E/S/L Loopの競合提案をQES換算スコアで調停。
 *         採択: ΔQES > 0 のみ。採択結果を TEO に記録。
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const QUALITY_DIR = path.join(__dirname, '.quality');
const QES_WEIGHTS = path.join(__dirname, '..', 'quality', 'qes_weights_global.json');

function loadWeights() {
  try { return JSON.parse(fs.readFileSync(QES_WEIGHTS, 'utf8')); }
  catch (_) { return { anchors: { test_added: 2.0, test_deleted: -10.0 }, learned_weights: { lightness_kb: -0.1, speed_latency_ms: -0.08, efficiency_cost_usd: -300 } }; }
}

// ─── 8.2.4: QES予測フィルタ（4ルールテーブル）────────────────────────────────

/** risk_level → 最低 QES 閾値 */
const RISK_QES_FLOOR = {
  low    : 0.1,   // 低リスク: わずかな改善でも採択
  medium : 1.0,   // 中リスク: 1ポイント以上の改善が必要
  high   : 5.0,   // 高リスク: 5ポイント以上の明確な改善が必要
  critical: 20.0, // 最高リスク: 大幅改善のみ採択
};

/**
 * predictQesDelta(proposal, weights) — ルールベースのQES予測
 * LLM呼び出しなし。O(1)計算。
 */
function predictQesDelta(proposal, weights) {
  // 提案がすでに qes_delta を持っていればそのまま使用
  if (typeof proposal.qes_delta === 'number') return proposal.qes_delta;

  const w = weights.learned_weights || {};
  let delta = 0;

  if (proposal.estimated_cost_reduction_usd)
    delta += proposal.estimated_cost_reduction_usd * Math.abs(w.efficiency_cost_usd || 300);
  if (proposal.estimated_speed_improvement_score)
    delta += proposal.estimated_speed_improvement_score * 10 * Math.abs(w.speed_latency_ms || 0.08);
  if (proposal.estimated_size_reduction_kb)
    delta += proposal.estimated_size_reduction_kb * Math.abs(w.lightness_kb || 0.1);
  if (proposal.tests_added)
    delta += proposal.tests_added * (weights.anchors?.test_added || 2.0);
  if (proposal.tests_deleted)
    delta += proposal.tests_deleted * (weights.anchors?.test_deleted || -10.0);

  return Math.round(delta * 100) / 100;
}

/**
 * filterByQesPrediction(proposals) — QES予測フィルタを通過した提案のみ返す
 */
function filterByQesPrediction(proposals, weights) {
  return proposals.map(p => {
    const predictedQes = predictQesDelta(p, weights);
    const floor        = RISK_QES_FLOOR[p.risk_level] ?? RISK_QES_FLOOR.medium;
    const passes       = predictedQes >= floor;
    return { ...p, predicted_qes: predictedQes, filter_passed: passes, filter_floor: floor };
  }).filter(p => p.filter_passed);
}

// ─── 8.2.5: Priority Arbiter ─────────────────────────────────────────────────

/**
 * arbitrate(allProposals, taskId) — 全Loopの提案を受け取り、最高QES提案を採択
 *
 * @param {{ e: object[], s: object[], l: object[] }} allProposals
 * @param {string} taskId
 * @returns {{ adopted: object|null, rejected: object[], reason: string }}
 */
function arbitrate(allProposals, taskId) {
  const weights = loadWeights();

  // 全提案をフラットに結合
  const all = [
    ...(allProposals.e || []),
    ...(allProposals.s || []),
    ...(allProposals.l || []),
  ];

  if (all.length === 0) {
    return { adopted: null, rejected: [], reason: 'no_proposals' };
  }

  // QES予測フィルタを通過したもののみ残す
  const filtered = filterByQesPrediction(all, weights);

  if (filtered.length === 0) {
    return { adopted: null, rejected: all, reason: 'all_below_qes_floor' };
  }

  // ΔQESが最大の提案を採択（採択: ΣΔQES > 0）
  const sorted  = filtered.sort((a, b) => b.predicted_qes - a.predicted_qes);
  const best    = sorted[0];
  const rejected = sorted.slice(1);

  if (best.predicted_qes <= 0) {
    return { adopted: null, rejected: all, reason: 'net_qes_negative' };
  }

  // 採択結果を TEO に追記
  appendArbiterResult(taskId, best, rejected);

  return {
    adopted : best,
    rejected,
    reason  : `adopted_by_qes (${best.predicted_qes} > ${best.filter_floor})`,
  };
}

/**
 * 採択結果を TEO ファイルに追記する
 */
function appendArbiterResult(taskId, adopted, rejected) {
  if (!taskId) return;
  const teoPattern = path.join(QUALITY_DIR, `teo_${taskId}.json`);
  // glob は使わず前方一致で近似
  const dir = fs.existsSync(QUALITY_DIR) ? fs.readdirSync(QUALITY_DIR) : [];
  const teoFile = dir.find(f => f.includes(taskId));
  if (!teoFile) return;

  const teoPath = path.join(QUALITY_DIR, teoFile);
  try {
    const teo = JSON.parse(fs.readFileSync(teoPath, 'utf8'));
    teo.arbiter_result = {
      adopted_at  : new Date().toISOString(),
      adopted_id  : adopted.id,
      adopted_qes : adopted.predicted_qes,
      rejected_count: rejected.length,
    };
    fs.writeFileSync(teoPath, JSON.stringify(teo, null, 2) + '\n', 'utf8');
  } catch (_) { /* TEO がなければスキップ */ }
}

module.exports = { arbitrate, filterByQesPrediction, predictQesDelta };

// ─── CLI 実行（デバッグ用）────────────────────────────────────────────────────
if (require.main === module) {
  // モックデータでテスト
  const mockProposals = {
    e: [{ id: 'e1', loop: 'efficiency', action: 'reduce_llm_calls', estimated_cost_reduction_usd: 0.01, risk_level: 'low' }],
    s: [{ id: 's1', loop: 'speed', action: 'perf_fix', estimated_speed_improvement_score: 5, risk_level: 'medium' }],
    l: [{ id: 'l1', loop: 'lightness', action: 'treeshake', estimated_size_reduction_kb: 50, risk_level: 'low' }],
  };
  const result = arbitrate(mockProposals, 'test_task');
  console.log('Arbiter result:', JSON.stringify(result, null, 2));
}
