#!/usr/bin/env node
/**
 * e-loop.js — Task 8.2.1 (Efficiency Loop)
 * LLM コスト効率を改善する提案を生成する。
 * quality-scorer.js が記録した TEO から efficiency 軸を読み取り、
 * コスト削減策（prompt短縮・モデルダウングレード等）を提案する。
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const QUALITY_DIR   = path.join(__dirname, '.quality');
const QES_WEIGHTS   = path.join(__dirname, '..', 'quality', 'qes_weights_global.json');

function loadWeights() {
  try { return JSON.parse(fs.readFileSync(QES_WEIGHTS, 'utf8')); }
  catch (_) { return { learned_weights: { efficiency_cost_usd: -300 } }; }
}

function loadRecentTeos(n = 10) {
  if (!fs.existsSync(QUALITY_DIR)) return [];
  return fs.readdirSync(QUALITY_DIR)
    .filter(f => f.startsWith('teo_') && f.endsWith('.json'))
    .sort().slice(-n)
    .map(f => { try { return JSON.parse(fs.readFileSync(path.join(QUALITY_DIR, f), 'utf8')); } catch { return null; } })
    .filter(Boolean);
}

/**
 * RiskLevel 判定テーブル（QES予測フィルタ 8.2.4 向け）
 * WHITEPAPER 12.4 の 4ルールテーブルを実装
 */
function estimateQesDelta(proposal, weights) {
  const w = weights.learned_weights || {};
  let delta = 0;
  if (proposal.estimated_cost_reduction_usd)
    delta += proposal.estimated_cost_reduction_usd * Math.abs(w.efficiency_cost_usd || 300);
  return Math.round(delta * 100) / 100;
}

/**
 * generate(context) — E-Loop のメインエントリ
 * @returns {{ proposals: object[], loop: 'efficiency' }}
 */
function generate(context = {}) {
  const teos    = loadRecentTeos(10);
  const weights = loadWeights();

  if (teos.length === 0) return { proposals: [], loop: 'efficiency' };

  const avgCost = teos.reduce((s, t) => s + (t.scores?.efficiency || 0), 0) / teos.length;
  const lastCost = teos[teos.length - 1]?.scores?.efficiency || 0;
  const proposals = [];

  // コスト上昇トレンドを検知
  if (lastCost > avgCost * 1.2) {
    proposals.push({
      id         : `e_cost_spike_${Date.now()}`,
      loop       : 'efficiency',
      action     : 'reduce_llm_calls',
      description: 'コストが直近平均より20%超上昇。プロンプトを短縮するか、軽量モデルへダウングレードを検討。',
      estimated_cost_reduction_usd: lastCost * 0.15,
      risk_level : 'low',
      qes_delta  : estimateQesDelta({ estimated_cost_reduction_usd: lastCost * 0.15 }, weights),
    });
  }

  // LLMコール数が多い場合はバッチ化を提案
  const avgCalls = teos.reduce((s, t) => s + (t.worker_measurements?.llm_calls || 0), 0) / teos.length;
  if (avgCalls > 20) {
    proposals.push({
      id         : `e_batch_${Date.now()}`,
      loop       : 'efficiency',
      action     : 'batch_llm_calls',
      description: `平均LLMコール数 ${avgCalls.toFixed(0)} 回/タスク。関連する複数アクションを1コールにバッチ化で削減可能。`,
      estimated_cost_reduction_usd: avgCost * 0.2,
      risk_level : 'low',
      qes_delta  : estimateQesDelta({ estimated_cost_reduction_usd: avgCost * 0.2 }, weights),
    });
  }

  return { proposals, loop: 'efficiency', analyzed_teos: teos.length, avg_cost_usd: avgCost };
}

module.exports = { generate, estimateQesDelta };

if (require.main === module) {
  const result = generate();
  console.log(JSON.stringify(result, null, 2));
}
