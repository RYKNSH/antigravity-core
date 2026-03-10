#!/usr/bin/env node
/**
 * s-loop.js — Task 8.2.2 (Speed Loop)
 * Lighthouse スコアを分析して速度改善提案を生成する。
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const QUALITY_DIR = path.join(__dirname, '.quality');
const QES_WEIGHTS = path.join(__dirname, '..', 'quality', 'qes_weights_global.json');

function loadWeights() {
  try { return JSON.parse(fs.readFileSync(QES_WEIGHTS, 'utf8')); }
  catch (_) { return { learned_weights: { speed_latency_ms: -0.08 } }; }
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
  if (proposal.estimated_speed_improvement_score) {
    // Lighthouse 1ポイント ≈ 10ms改善と仮計算
    delta += proposal.estimated_speed_improvement_score * 10 * Math.abs(w.speed_latency_ms || 0.08);
  }
  return Math.round(delta * 100) / 100;
}

/**
 * generate(context) — S-Loop のメインエントリ
 */
function generate(context = {}) {
  const teos    = loadRecentTeos(10);
  const weights = loadWeights();

  // speed スコアが存在するTEOのみ抽出（10タスクごと計測）
  const speedTeos = teos.filter(t => t.scores?.speed != null);
  if (speedTeos.length === 0) return { proposals: [], loop: 'speed', note: 'No Lighthouse data yet (measured every 10 tasks)' };

  const avgSpeed  = speedTeos.reduce((s, t) => s + t.scores.speed, 0) / speedTeos.length;
  const lastSpeed = speedTeos[speedTeos.length - 1].scores.speed;
  const proposals = [];

  // Lighthouse スコア低下トレンド
  if (speedTeos.length >= 2 && lastSpeed < avgSpeed * 0.95) {
    proposals.push({
      id         : `s_perf_drop_${Date.now()}`,
      loop       : 'speed',
      action     : 'investigate_perf_regression',
      description: `Lighthouse スコアが直近平均から5%低下 (avg: ${avgSpeed.toFixed(0)}, last: ${lastSpeed})。バンドルサイズや重いAPIを確認してください。`,
      estimated_speed_improvement_score: avgSpeed - lastSpeed,
      risk_level : 'medium',
      qes_delta  : estimateQesDelta({ estimated_speed_improvement_score: avgSpeed - lastSpeed }, weights),
    });
  }

  // 低スコア（60未満）での積極改善提案
  if (lastSpeed < 60) {
    proposals.push({
      id         : `s_low_score_${Date.now()}`,
      loop       : 'speed',
      action     : 'critical_perf_fix',
      description: `Lighthouse ${lastSpeed}点は重大な性能問題。画像最適化・JS遅延読み込み・SSR導入を優先検討。`,
      estimated_speed_improvement_score: 15,
      risk_level : 'high',
      qes_delta  : estimateQesDelta({ estimated_speed_improvement_score: 15 }, weights),
    });
  }

  return { proposals, loop: 'speed', avg_lighthouse: avgSpeed, last_lighthouse: lastSpeed };
}

module.exports = { generate, estimateQesDelta };

if (require.main === module) {
  const result = generate();
  console.log(JSON.stringify(result, null, 2));
}
