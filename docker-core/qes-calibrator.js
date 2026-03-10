#!/usr/bin/env node
/**
 * qes-calibrator.js — Task 8.2.6 + 8.2.7
 *
 * [8.2.6] QES重み帰納更新バッチ: 軸スコア変化の最小二乗法で learned_weights を自動校正。
 * [8.2.7] 2層QES重みスコープ: グローバル中央値 + プロジェクト固有をブレンド。
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const QUALITY_DIR         = path.join(__dirname, '.quality');
const GLOBAL_WEIGHTS_FILE = path.join(__dirname, '..', 'quality', 'qes_weights_global.json');
const PROJECT_WEIGHTS_FILE = path.join(QUALITY_DIR, 'qes_weights_project.json');

// cold_start期間: この件数未満は帰納更新しない
const COLD_START_UNTIL = 20;

// ─── ユーティリティ ──────────────────────────────────────────────────────────

function loadWeights(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (_) { return null; }
}

function saveWeights(file, weights) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(weights, null, 2) + '\n', 'utf8');
}

function loadAllTeos() {
  if (!fs.existsSync(QUALITY_DIR)) return [];
  return fs.readdirSync(QUALITY_DIR)
    .filter(f => f.startsWith('teo_') && f.endsWith('.json'))
    .sort()
    .map(f => { try { return JSON.parse(fs.readFileSync(path.join(QUALITY_DIR, f), 'utf8')); } catch { return null; } })
    .filter(Boolean);
}

// ─── 8.2.6: 最小二乗法による重み校正 ───────────────────────────────────────

/**
 * leastSquaresWeights(teos) — 軸スコア変化 → QES変化の重みを最小二乗法で推定
 *
 * モデル: qes_delta ≈ w_quality × dQuality + w_efficiency × dEfficiency
 *                    + w_speed × dSpeed + w_lightness × dLightness
 *
 * 実装: 連続するTEOペアの差分から Σ(X^T X)^-1 Σ(X^T y) を計算
 * ただし行列サイズを抑えるため 2変数ずつ独立推定する簡易版を使用。
 */
function leastSquaresWeights(teos) {
  if (teos.length < 2) return null;

  // 差分データセットを構築
  const diffs = [];
  for (let i = 1; i < teos.length; i++) {
    const prev = teos[i - 1];
    const curr = teos[i];
    if (!prev.scores || !curr.scores) continue;

    const dQuality    = (curr.scores.quality    ?? 0) - (prev.scores.quality    ?? 0);
    const dEfficiency = (curr.scores.efficiency ?? 0) - (prev.scores.efficiency ?? 0);
    const dSpeed      = (curr.scores.speed   != null && prev.scores.speed   != null) ? curr.scores.speed   - prev.scores.speed   : 0;
    const dLightness  = (curr.scores.lightness != null && prev.scores.lightness != null) ? curr.scores.lightness - prev.scores.lightness : 0;
    const qesDelta    = curr.qes_delta ?? 0;

    diffs.push({ dQuality, dEfficiency, dSpeed, dLightness, qesDelta });
  }

  if (diffs.length < 5) return null; // 最低5ペアは必要

  // 各軸独立で単回帰（y = w*x）: w = Σ(x_i * y_i) / Σ(x_i^2)
  function singleRegression(xs, ys) {
    let num = 0, den = 0;
    for (let i = 0; i < xs.length; i++) { num += xs[i] * ys[i]; den += xs[i] * xs[i]; }
    return den > 1e-10 ? num / den : null;
  }

  const qes  = diffs.map(d => d.qesDelta);
  const wQuality    = singleRegression(diffs.map(d => d.dQuality),    qes);
  const wEfficiency = singleRegression(diffs.map(d => d.dEfficiency), qes);
  const wSpeed      = singleRegression(diffs.map(d => d.dSpeed),      qes);
  const wLightness  = singleRegression(diffs.map(d => d.dLightness),  qes);

  return { wQuality, wEfficiency, wSpeed, wLightness, sample_size: diffs.length };
}

// ─── 8.2.7: 2層スコープ — グローバル × プロジェクトブレンド ────────────────

/**
 * blendedWeights(globalW, projectW, taskCount) — 2層重みをブレンド
 *
 * タスク数が少ない間はグローバルを重視、増えるとプロジェクト固有に移行。
 * blend_ratio = min(taskCount / 50, 1.0)
 */
function blendedWeights(globalW, projectW, taskCount) {
  const ratio = Math.min(taskCount / 50, 1.0);
  const lerp = (g, p) => g + (p - g) * ratio;

  const gL = globalW.learned_weights || {};
  const pL = projectW.learned_weights || {};

  return {
    ...globalW,
    learned_weights: {
      lightness_kb       : lerp(gL.lightness_kb        ?? -0.1,  pL.lightness_kb        ?? gL.lightness_kb        ?? -0.1),
      speed_latency_ms   : lerp(gL.speed_latency_ms    ?? -0.08, pL.speed_latency_ms    ?? gL.speed_latency_ms    ?? -0.08),
      efficiency_cost_usd: lerp(gL.efficiency_cost_usd ?? -300,  pL.efficiency_cost_usd ?? gL.efficiency_cost_usd ?? -300),
    },
    _blend_ratio     : ratio,
    _task_count      : taskCount,
    _blended_at      : new Date().toISOString(),
  };
}

// ─── メイン: 帰納更新バッチ ──────────────────────────────────────────────────

/**
 * calibrate() — 全 TEO を読み込み、learned_weights を最小二乗法で更新する
 */
function calibrate() {
  const teos         = loadAllTeos();
  const globalWeights = loadWeights(GLOBAL_WEIGHTS_FILE);

  if (!globalWeights) {
    console.log('  ⚠️  qes_weights_global.json が見つかりません。スキップ。');
    return { updated: false, reason: 'no_weights_file' };
  }

  // cold_start期間チェック
  const calibCount = globalWeights._calibration_count || 0;
  const coldUntil  = globalWeights._cold_start_until  || COLD_START_UNTIL;

  if (teos.length < coldUntil) {
    console.log(`  ⏳ Cold start: ${teos.length}/${coldUntil} TEOs (calibration skipped)`);
    return { updated: false, reason: 'cold_start', teo_count: teos.length };
  }

  // 最小二乗法で重みを推定
  const regression = leastSquaresWeights(teos);
  if (!regression) {
    console.log('  ⚠️  データ不足。帰納更新スキップ。');
    return { updated: false, reason: 'insufficient_data' };
  }

  // アンカーは更新しない（公理固定）
  // learned_weights のみ更新（nullの場合は既存値を維持）
  const lw = { ...globalWeights.learned_weights };
  if (regression.wEfficiency !== null) lw.efficiency_cost_usd = Math.round(regression.wEfficiency * 100) / 100;
  if (regression.wSpeed      !== null) lw.speed_latency_ms    = Math.round(regression.wSpeed * 10000) / 10000;
  if (regression.wLightness  !== null) lw.lightness_kb        = Math.round(regression.wLightness * 10000) / 10000;

  const updatedGlobal = {
    ...globalWeights,
    learned_weights      : lw,
    _mode                : 'calibrated',
    _last_calibrated     : new Date().toISOString(),
    _calibration_count   : calibCount + 1,
    _last_sample_size    : regression.sample_size,
  };

  saveWeights(GLOBAL_WEIGHTS_FILE, updatedGlobal);
  console.log(`  ✅ Global weights updated (calibration #${calibCount + 1}, sample=${regression.sample_size})`);
  console.log(`     efficiency_cost_usd: ${lw.efficiency_cost_usd}`);
  console.log(`     speed_latency_ms:    ${lw.speed_latency_ms}`);
  console.log(`     lightness_kb:        ${lw.lightness_kb}`);

  // プロジェクト固有重みを読み込み（存在しない場合はグローバルをコピー）
  let projectWeights = loadWeights(PROJECT_WEIGHTS_FILE);
  if (!projectWeights) {
    projectWeights = { ...updatedGlobal, _scope: 'project', learned_weights: { ...lw } };
  }

  // プロジェクト専用の最小二乗法（直近50件のみ）
  const recentTeos     = teos.slice(-50);
  const projectRegress = leastSquaresWeights(recentTeos);
  if (projectRegress) {
    const pLw = { ...projectWeights.learned_weights };
    if (projectRegress.wEfficiency !== null) pLw.efficiency_cost_usd = Math.round(projectRegress.wEfficiency * 100) / 100;
    if (projectRegress.wSpeed      !== null) pLw.speed_latency_ms    = Math.round(projectRegress.wSpeed * 10000) / 10000;
    if (projectRegress.wLightness  !== null) pLw.lightness_kb        = Math.round(projectRegress.wLightness * 10000) / 10000;
    projectWeights = { ...projectWeights, learned_weights: pLw, _last_calibrated: new Date().toISOString() };
  }
  saveWeights(PROJECT_WEIGHTS_FILE, projectWeights);

  // ブレンド重みを計算して返す（Daemon Coreが使用）
  const blended = blendedWeights(updatedGlobal, projectWeights, teos.length);

  return {
    updated       : true,
    calibration   : calibCount + 1,
    sample_size   : regression.sample_size,
    blended_weights: blended,
  };
}

/**
 * getWeights(taskCount) — Daemon Coreが使う実際の重みを返す（2層ブレンド済み）
 */
function getWeights(taskCount = 0) {
  const global  = loadWeights(GLOBAL_WEIGHTS_FILE);
  const project = loadWeights(PROJECT_WEIGHTS_FILE);
  if (!global) return null;
  if (!project) return global;
  return blendedWeights(global, project, taskCount);
}

module.exports = { calibrate, getWeights, blendedWeights, leastSquaresWeights };

if (require.main === module) {
  console.log('🔧 QES Calibrator — 重み帰納更新バッチ');
  const result = calibrate();
  console.log('\nResult:', JSON.stringify(result, null, 2));
}
