#!/usr/bin/env node
/**
 * quality-guardian.js — Task 8.3.2 + 8.3.3
 *
 * [8.3.2] Quality Guardian: QES回帰・テスト削除・budget超過を検知して自動ブロック
 * [8.3.3] SYSTEM_ALERTS 発報ルール（段階アラート）
 *
 * agent-loop.js の mainLoop から各タスク評価後に呼ばれる。
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const ANTIGRAVITY_DIR = process.env.ANTIGRAVITY_DIR || path.join(process.env.HOME || '/root', '.antigravity');
const QUALITY_DIR     = path.join(__dirname, '.quality');
const ALERTS_FILE     = path.join(ANTIGRAVITY_DIR, '.system_alerts.json');
const QES_WEIGHTS     = path.join(__dirname, '..', 'quality', 'qes_weights_global.json');

// ─── 段階アラートレベル定義 ───────────────────────────────────────────────────
const ALERT_LEVELS = {
  INFO    : { emoji: 'ℹ️',  notify_ceo: false, block_task: false },
  WARN    : { emoji: '⚠️',  notify_ceo: false, block_task: false },
  CRITICAL: { emoji: '🚨',  notify_ceo: true,  block_task: true  },
  FATAL   : { emoji: '💀',  notify_ceo: true,  block_task: true  }, // 即時停止
};

// ─── ユーティリティ ──────────────────────────────────────────────────────────

function readJSON(p, def = null) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (_) { return def; }
}

function loadRecentTeos(n = 5) {
  if (!fs.existsSync(QUALITY_DIR)) return [];
  return fs.readdirSync(QUALITY_DIR)
    .filter(f => f.startsWith('teo_') && f.endsWith('.json'))
    .sort().slice(-n)
    .map(f => { try { return readJSON(path.join(QUALITY_DIR, f)); } catch { return null; } })
    .filter(Boolean);
}

// ─── SYSTEM_ALERTS 発報 ──────────────────────────────────────────────────────

/**
 * emitAlert(level, reason, meta) — アラートを .system_alerts.json に追記
 */
function emitAlert(level, reason, meta = {}) {
  const def = ALERT_LEVELS[level] || ALERT_LEVELS.WARN;
  const alert = {
    level,
    reason,
    ...meta,
    emitted_at : new Date().toISOString(),
    notify_ceo : def.notify_ceo,
    block_task : def.block_task,
  };

  let alerts = readJSON(ALERTS_FILE, []);
  if (!Array.isArray(alerts)) alerts = [];
  alerts.push(alert);
  // 最新200件のみ保持
  if (alerts.length > 200) alerts = alerts.slice(-200);

  fs.mkdirSync(path.dirname(ALERTS_FILE), { recursive: true });
  fs.writeFileSync(ALERTS_FILE, JSON.stringify(alerts, null, 2) + '\n', 'utf8');

  console.log(`${def.emoji} [SystemAlert/${level}] ${reason}`);
  return { ...alert, blocked: def.block_task };
}

// ─── 8.3.2: Quality Guardian チェック群 ──────────────────────────────────────

/**
 * checkQesRegression(teos) — QES デルタが連続3回マイナスならWARN
 */
function checkQesRegression(teos) {
  if (teos.length < 3) return null;
  const recent3 = teos.slice(-3).map(t => t.qes_delta ?? 0);
  if (recent3.every(d => d < 0)) {
    return emitAlert('WARN', 'qes_regression_streak', {
      recent_deltas: recent3,
      suggestion   : 'QES が3タスク連続マイナス。E-Loop の提案を優先適用してください。',
    });
  }
  return null;
}

/**
 * checkTestDeletion(teo) — tests_deleted > 0 なら CRITICAL（公理アンカー）
 */
function checkTestDeletion(teo) {
  if (!teo) return null;
  const deleted = teo.worker_measurements?.tests_deleted ?? 0;
  if (deleted > 0) {
    return emitAlert('CRITICAL', 'test_deletion_detected', {
      task_id : teo.task_id,
      deleted,
      message : `テストが ${deleted} 件削除されました。QES公理アンカー(test_deleted=-10/件)に抵触。タスクをブロックします。`,
    });
  }
  return null;
}

/**
 * checkBudgetExhaustion(teo) — LLMコール数が 70 超で WARN、90 超で CRITICAL
 */
function checkBudgetExhaustion(teo) {
  if (!teo) return null;
  const calls = teo.worker_measurements?.llm_calls ?? 0;
  if (calls > 90)  return emitAlert('CRITICAL', 'budget_near_exhaustion', { task_id: teo.task_id, llm_calls: calls });
  if (calls > 70)  return emitAlert('WARN',     'budget_high_usage',     { task_id: teo.task_id, llm_calls: calls });
  return null;
}

/**
 * checkStagnation(teo) — stagnation_count >= 10 で CRITICAL (COO-Lite Suspend 相当)
 */
function checkStagnation(teo) {
  if (!teo) return null;
  const sc = teo.stagnation_count ?? 0;
  if (sc >= 10) return emitAlert('CRITICAL', 'stagnation_threshold_reached', { task_id: teo.task_id, stagnation_count: sc });
  if (sc >= 5)  return emitAlert('WARN',     'stagnation_growing',          { task_id: teo.task_id, stagnation_count: sc });
  return null;
}

/**
 * checkCooCallsOveruse(teo) — COO-Lite が3コール上限に達したら WARN
 */
function checkCooCallsOveruse(teo) {
  if (!teo) return null;
  const calls = teo.coo_calls ?? 0;
  if (calls >= 3) return emitAlert('WARN', 'coo_call_limit_reached', { task_id: teo.task_id, coo_calls: calls });
  return null;
}

/**
 * guard(teo) — 全チェックを実行して結果を返す。block=true の場合はタスクを停止する。
 *
 * @param {object} teo — 直近の TEO
 * @returns {{ blocked: boolean, alerts: object[] }}
 */
function guard(teo) {
  const teos      = loadRecentTeos(5);
  const results   = [
    checkQesRegression(teos),
    checkTestDeletion(teo),
    checkBudgetExhaustion(teo),
    checkStagnation(teo),
    checkCooCallsOveruse(teo),
  ].filter(Boolean);

  const blocked = results.some(r => r.block_task);
  return { blocked, alerts: results };
}

/**
 * getRecentAlerts(n) — 直近 n 件のアラートを返す
 */
function getRecentAlerts(n = 10) {
  const alerts = readJSON(ALERTS_FILE, []);
  return Array.isArray(alerts) ? alerts.slice(-n) : [];
}

module.exports = { guard, emitAlert, getRecentAlerts, checkQesRegression, checkTestDeletion };

if (require.main === module) {
  console.log('═══ Quality Guardian ═══');
  const mockTeo = {
    task_id         : 'test_guardian',
    qes_delta       : -0.5,
    stagnation_count: 3,
    coo_calls       : 2,
    worker_measurements: { tests_deleted: 0, llm_calls: 45 },
  };
  const result = guard(mockTeo);
  console.log(JSON.stringify(result, null, 2));
}
