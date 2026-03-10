#!/usr/bin/env node
/**
 * trinity-quality-controller.js — Task 8.3.1
 *
 * Trinity Model（CEO・COO・Daemon）の品質情報を統合管理するコントローラー。
 * - CEO: 週次 KPI レポートを読み取り、目標値と比較してアラートを出す。
 * - COO-Lite: environment-check → coo-lite.js のオーケストレーション
 * - Daemon: agent-loop.js(ReAct) の品質スコアを追跡し、QES帰納更新をトリガー
 *
 * WHITEPAPER Section 12.5 "Trinity Model" 準拠
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const ANTIGRAVITY_DIR = process.env.ANTIGRAVITY_DIR || path.join(process.env.HOME || '/root', '.antigravity');
const QUALITY_DIR     = path.join(__dirname, '.quality');
const GOALS_FILE      = path.join(ANTIGRAVITY_DIR, 'quality', 'goals.json');
const STATE_FILE      = path.join(ANTIGRAVITY_DIR, '.session_state.json');

function readJSON(p, def = null) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (_) { return def; }
}

// ─── 役割 1: CEO — 目標値 vs 実績の差分を算出 ─────────────────────────────

/**
 * ceoReport() — goals.json と直近TEOを比較してギャップを返す
 */
function ceoReport() {
  const goals = readJSON(GOALS_FILE, {});
  if (!fs.existsSync(QUALITY_DIR)) return { gaps: [], note: 'no_quality_dir' };

  const teos = fs.readdirSync(QUALITY_DIR)
    .filter(f => f.startsWith('teo_') && f.endsWith('.json'))
    .sort().slice(-5)
    .map(f => { try { return readJSON(path.join(QUALITY_DIR, f)); } catch { return null; } })
    .filter(Boolean);

  if (teos.length === 0) return { gaps: [], note: 'no_teo_yet' };

  const latest = teos[teos.length - 1];
  const gaps   = [];

  // test coverage
  const actualCov  = latest.scores?.quality ?? 0;
  const targetCov  = goals.quality_pass_rate ?? 80;
  if (actualCov < targetCov * 0.9)
    gaps.push({ axis: 'quality', actual: actualCov, target: targetCov, severity: 'warn' });

  // efficiency trend
  const avgEff    = teos.reduce((s, t) => s + (t.scores?.efficiency ?? 0), 0) / teos.length;
  const targetEff = goals.efficiency_score ?? 70;
  if (avgEff < targetEff * 0.85)
    gaps.push({ axis: 'efficiency', actual: Math.round(avgEff), target: targetEff, severity: 'critical' });

  return { gaps, latest_task: latest.task_id, teo_count: teos.length };
}

// ─── 役割 2: COO — environment-check → COO-Lite 呼び出し ─────────────────

/**
 * cooOrchestrate(taskId, stagnationCount) — 環境チェック後 COO-Lite を起動
 * @returns {{ invoked: boolean, result?: object }}
 */
async function cooOrchestrate(taskId, stagnationCount) {
  const { check: envCheck } = require('./environment-check.js');
  const envResult = envCheck();

  if (!envResult.overall_ok) {
    return { invoked: false, reason: 'env_check_failed', checks: envResult.checks };
  }

  const { call: cooCall } = require('./coo-lite.js');
  const state = readJSON(STATE_FILE, {});
  const errors = state.error_history ? state.error_history.slice(-5) : [];

  const result = await cooCall({
    task_id        : taskId,
    stagnation_count: stagnationCount,
    error_history  : errors,
    meta_rules     : '',   // 空でも COO-Lite が DECISION_USECASES から読む
  });

  return { invoked: true, result };
}

// ─── 役割 3: Daemon — QES帰納更新トリガー ───────────────────────────────────

/**
 * daemonCalibrate() — TEO が閾値を超えたら QES 帰納更新バッチを実行
 * Daemon の mainLoop から周期的に呼ぶ想定（10タスクごと）
 */
function daemonCalibrate() {
  const { calibrate } = require('./qes-calibrator.js');
  const result = calibrate();
  return result;
}

// ─── Trinity 統合ヘルスチェック ──────────────────────────────────────────────

/**
 * trinityHealth() — CEO / COO 環境 / Daemon QES の 3視点を即時評価
 */
function trinityHealth() {
  // CEO
  const ceo = ceoReport();

  // COO 環境チェックのみ（LLM 呼び出しなし）
  let cooEnv;
  try {
    const { check } = require('./environment-check.js');
    cooEnv = check();
  } catch (_) {
    cooEnv = { overall_ok: false, checks: [], error: 'environment-check.js not found' };
  }

  // Daemon: 直近 QES デルタ平均
  let daemonQes = { avg_delta: null, teo_count: 0 };
  if (fs.existsSync(QUALITY_DIR)) {
    const teos = fs.readdirSync(QUALITY_DIR)
      .filter(f => f.endsWith('.json'))
      .slice(-10)
      .map(f => { try { return readJSON(path.join(QUALITY_DIR, f)); } catch { return null; } })
      .filter(Boolean);
    if (teos.length > 0) {
      const avg = teos.reduce((s, t) => s + (t.qes_delta ?? 0), 0) / teos.length;
      daemonQes = { avg_delta: Math.round(avg * 100) / 100, teo_count: teos.length };
    }
  }

  const healthy = ceo.gaps.filter(g => g.severity === 'critical').length === 0
               && cooEnv.overall_ok !== false
               && (daemonQes.avg_delta === null || daemonQes.avg_delta >= 0);

  return {
    healthy,
    timestamp : new Date().toISOString(),
    ceo       : { gaps: ceo.gaps.length, critical: ceo.gaps.filter(g => g.severity === 'critical').length },
    coo       : { env_ok: cooEnv.overall_ok },
    daemon    : daemonQes,
  };
}

module.exports = { ceoReport, cooOrchestrate, daemonCalibrate, trinityHealth };

if (require.main === module) {
  console.log('═══ Trinity Quality Controller ═══');
  const health = trinityHealth();
  console.log(JSON.stringify(health, null, 2));
}
