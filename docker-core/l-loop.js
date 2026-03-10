#!/usr/bin/env node
/**
 * l-loop.js — Task 8.2.3 (Lightness Loop)
 * bundle KB を分析して軽量化提案を生成する。
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const QUALITY_DIR = path.join(__dirname, '.quality');
const QES_WEIGHTS = path.join(__dirname, '..', 'quality', 'qes_weights_global.json');

function loadWeights() {
  try { return JSON.parse(fs.readFileSync(QES_WEIGHTS, 'utf8')); }
  catch (_) { return { learned_weights: { lightness_kb: -0.1 } }; }
}

function loadRecentTeos(n = 10) {
  if (!fs.existsSync(QUALITY_DIR)) return [];
  return fs.readdirSync(QUALITY_DIR)
    .filter(f => f.startsWith('teo_') && f.endsWith('.json'))
    .sort().slice(-n)
    .map(f => { try { return JSON.parse(fs.readFileSync(path.join(QUALITY_DIR, f), 'utf8')); } catch { return null; } })
    .filter(Boolean);
}

function estimateQesDelta(proposal, weights) {
  const w = weights.learned_weights || {};
  let delta = 0;
  if (proposal.estimated_size_reduction_kb)
    delta += proposal.estimated_size_reduction_kb * Math.abs(w.lightness_kb || 0.1);
  return Math.round(delta * 100) / 100;
}

/**
 * generate(context) — L-Loop のメインエントリ
 */
function generate(context = {}) {
  const teos    = loadRecentTeos(10);
  const weights = loadWeights();

  const lightnessTeos = teos.filter(t => t.scores?.lightness != null);
  if (lightnessTeos.length === 0) return { proposals: [], loop: 'lightness', note: 'No bundle data yet' };

  const avgKb  = lightnessTeos.reduce((s, t) => s + t.scores.lightness, 0) / lightnessTeos.length;
  const lastKb = lightnessTeos[lightnessTeos.length - 1].scores.lightness;
  const proposals = [];

  // バンドルサイズ増加トレンド
  if (lightnessTeos.length >= 2 && lastKb > avgKb * 1.1) {
    proposals.push({
      id         : `l_size_growth_${Date.now()}`,
      loop       : 'lightness',
      action     : 'treeshake_unused_deps',
      description: `bundle が直近平均より10%超増加 (avg: ${avgKb.toFixed(0)}KB, last: ${lastKb}KB)。未使用 import の削除・Tree Shaking 最適化を実施してください。`,
      estimated_size_reduction_kb: lastKb - avgKb,
      risk_level : 'low',
      qes_delta  : estimateQesDelta({ estimated_size_reduction_kb: lastKb - avgKb }, weights),
    });
  }

  // 500KB 超で警告
  if (lastKb > 500) {
    proposals.push({
      id         : `l_heavy_bundle_${Date.now()}`,
      loop       : 'lightness',
      action     : 'code_splitting',
      description: `bundle ${lastKb}KB は重い。dynamic import() による code splitting や heavy ライブラリの代替を検討。`,
      estimated_size_reduction_kb: lastKb * 0.2,
      risk_level : 'medium',
      qes_delta  : estimateQesDelta({ estimated_size_reduction_kb: lastKb * 0.2 }, weights),
    });
  }

  return { proposals, loop: 'lightness', avg_kb: avgKb, last_kb: lastKb };
}

module.exports = { generate, estimateQesDelta };

if (require.main === module) {
  const result = generate();
  console.log(JSON.stringify(result, null, 2));
}
