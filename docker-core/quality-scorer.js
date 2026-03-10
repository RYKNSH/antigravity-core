#!/usr/bin/env node
/**
 * quality-scorer.js — Task 8.1.3
 * Daemon Core が各タスク完了後に呼び出す4軸スコア計測エンジン。
 * 重い計測（Lighthouse/bundle）は worker_threads で非同期実行し、
 * 結果を TEO ファイル（.quality/teo_{task_id}.json）に書き込む。
 */

'use strict';

const { execSync, spawn }     = require('child_process');
const { Worker, isMainThread,
        parentPort, workerData } = require('worker_threads');
const fs   = require('fs');
const path = require('path');

// ─── 定数 ───────────────────────────────────────────────────────────────────
const ANTIGRAVITY_DIR = process.env.ANTIGRAVITY_DIR || path.join(process.env.HOME, '.antigravity');
const QUALITY_DIR     = path.join(__dirname, '.quality');
const QES_WEIGHTS     = path.join(ANTIGRAVITY_DIR, 'quality', 'qes_weights_global.json');

/** 重い計測（Lighthouse/bundle）は N タスクごとに1回だけ実行 */
const HEAVY_INTERVAL  = 10;

// ─── Worker スレッド処理（Lighthouse & bundle 計測）─────────────────────────
if (!isMainThread) {
  const { type, cwd } = workerData;
  try {
    if (type === 'lighthouse') {
      const hasLh = tryExecSync('which lighthouse 2>/dev/null', cwd, 3_000);
      if (!hasLh) { parentPort.postMessage({ ok: false, reason: 'lighthouse not installed' }); return; }

      const out = tryExecSync(
        'lighthouse --output=json --quiet --chrome-flags="--headless --no-sandbox" http://localhost:3000 2>/dev/null',
        cwd, 90_000
      );
      if (!out) { parentPort.postMessage({ ok: false, reason: 'lighthouse failed' }); return; }
      const data  = JSON.parse(out);
      const score = Math.round(data.categories.performance.score * 100);
      parentPort.postMessage({ ok: true, score });
    } else if (type === 'bundle') {
      let totalKb = 0;
      for (const dir of ['dist', 'build', '.next', 'out']) {
        const target = path.join(cwd, dir);
        if (!fs.existsSync(target)) continue;
        const du = tryExecSync(`du -sk "${target}"`, cwd, 10_000);
        if (du) {
          const kb = parseInt(du.trim().split(/\s+/)[0], 10);
          if (!isNaN(kb)) { totalKb = kb; break; }
        }
      }
      parentPort.postMessage(totalKb > 0 ? { ok: true, kb: totalKb } : { ok: false, reason: 'no bundle dir' });
    }
  } catch (e) {
    parentPort.postMessage({ ok: false, reason: e.message });
  }
  return;
}

// ─── ユーティリティ ──────────────────────────────────────────────────────────
function tryExecSync(cmd, cwd, timeout = 30_000) {
  try {
    return execSync(cmd, { cwd, timeout, encoding: 'utf8', stdio: ['pipe','pipe','pipe'] });
  } catch (_) { return null; }
}

function nowISO() { return new Date().toISOString(); }

function runWorker(type, cwd) {
  return new Promise((resolve) => {
    const w = new Worker(__filename, { workerData: { type, cwd } });
    const timer = setTimeout(() => { w.terminate(); resolve({ ok: false, reason: 'timeout' }); }, 120_000);
    w.on('message', (msg) => { clearTimeout(timer); resolve(msg); w.terminate(); });
    w.on('error',   (e)   => { clearTimeout(timer); resolve({ ok: false, reason: e.message }); });
  });
}

function loadQesWeights() {
  try { return JSON.parse(fs.readFileSync(QES_WEIGHTS, 'utf8')); }
  catch (_) { return { anchors: { test_added: 2.0, test_deleted: -10.0 }, learned_weights: { lightness_kb: -0.1, speed_latency_ms: -0.08, efficiency_cost_usd: -300 }, _mode: 'cold_start' }; }
}

// ─── 計測関数（quality / efficiency）───────────────────────────────────────

/** npm test pass 率 */
function measureQuality(cwd) {
  const out = tryExecSync('npm test -- --no-coverage 2>&1 | tail -20', cwd, 60_000);
  if (!out) return { score: 0.8, source: 'default' };

  const jm = out.match(/Tests?:\s+(?:(\d+)\s+failed,\s*)?(\d+)\s+passed,\s*(\d+)\s+total/i);
  if (jm) {
    const passed = parseInt(jm[2], 10), total = parseInt(jm[3], 10);
    return { score: total > 0 ? passed / total : 0.8, source: 'jest' };
  }
  const pm = out.match(/(\d+)\s+passing/i), fm = out.match(/(\d+)\s+failing/i);
  if (pm) {
    const pass = parseInt(pm[1], 10), fail = fm ? parseInt(fm[1], 10) : 0;
    return { score: (pass + fail) > 0 ? pass / (pass + fail) : 0.8, source: 'mocha' };
  }
  return { score: 0.8, source: 'default' };
}

/** LLM コール数からコストを推算（deaemon-loop のログを参照）*/
function measureEfficiency(taskId) {
  const logPath = path.join(QUALITY_DIR, `daemon_calls_${taskId}.json`);
  if (!fs.existsSync(logPath)) return { cost_usd: 0, calls: 0 };
  try {
    const data = JSON.parse(fs.readFileSync(logPath, 'utf8'));
    const calls = data.llm_calls || 0;
    // Gemini 2.0 Flash 概算: input ~$0.075/1M, 平均 2000 tokens/call
    const cost  = calls * 2000 * (0.075 / 1_000_000);
    return { cost_usd: Math.round(cost * 1e6) / 1e6, calls };
  } catch (_) { return { cost_usd: 0, calls: 0 }; }
}

// ─── QES 計算 ────────────────────────────────────────────────────────────────
function calcQesDelta(prevScores, newScores, weights) {
  let delta = 0;
  const w = weights.learned_weights;

  // quality: pass率改善
  const qualityDelta = (newScores.quality - (prevScores.quality || 0)) * 100;
  delta += qualityDelta * 1.0; // 1%改善 = +1 QES（仮）

  // lightness: bundle KB 削減
  if (newScores.lightness != null && prevScores.lightness != null) {
    delta += (prevScores.lightness - newScores.lightness) * Math.abs(w.lightness_kb || 0.1);
  }

  // speed: Lighthouse 改善
  if (newScores.speed != null && prevScores.speed != null) {
    const speedMs = (newScores.speed - prevScores.speed) * 10; // スコア1点 ≈ 10ms相当（仮算）
    delta += speedMs * Math.abs(w.speed_latency_ms || 0.08);
  }

  // efficiency: コスト削減（値は負方向が良い）
  if (newScores.efficiency != null && prevScores.efficiency != null) {
    const costReduction = prevScores.efficiency - newScores.efficiency;
    delta += costReduction * Math.abs(w.efficiency_cost_usd || 300);
  }

  return Math.round(delta * 100) / 100;
}

// ─── メイン API ──────────────────────────────────────────────────────────────

/**
 * score(taskId, options) — 外部からの呼び出しエントリポイント
 * @param {string} taskId
 * @param {object} options - { cwd, taskCount, stagnationCount, cooCalls }
 * @returns {Promise<object>} TEO オブジェクト
 */
async function score(taskId, options = {}) {
  const {
    cwd           = process.cwd(),
    taskCount     = 0,
    stagnationCount = 0,
    cooCalls      = 0,
    prevScores    = {},
    llmCallsLog   = null,
  } = options;

  fs.mkdirSync(QUALITY_DIR, { recursive: true });

  const weights = loadQesWeights();
  const isHeavyRun = taskCount % HEAVY_INTERVAL === 0;

  // ─── 毎タスク計測 ─────────────────────────────────────────────────
  console.log(`  📊 quality-scorer: task=${taskId} (heavy=${isHeavyRun})`);

  const { score: qualityScore } = measureQuality(cwd);
  const { cost_usd, calls }     = measureEfficiency(taskId);

  // ─── 重い計測（非同期 worker_threads）────────────────────────────
  let lighthouseScore = prevScores.speed   || null;
  let bundleKb        = prevScores.lightness || null;

  if (isHeavyRun) {
    const [lhResult, bundleResult] = await Promise.all([
      runWorker('lighthouse', cwd),
      runWorker('bundle',     cwd),
    ]);
    if (lhResult.ok)     lighthouseScore = lhResult.score;
    if (bundleResult.ok) bundleKb        = bundleResult.kb;
    console.log(`    🚀 lighthouse: ${lighthouseScore ?? 'skip'} | 📦 bundle: ${bundleKb ?? 'skip'} KB`);
  }

  const scores = {
    quality    : qualityScore,
    efficiency : cost_usd,
    speed      : lighthouseScore,
    lightness  : bundleKb,
  };

  const qesDelta = calcQesDelta(prevScores, scores, weights);

  // ─── TEO 生成 ─────────────────────────────────────────────────────
  const teo = {
    task_id          : taskId,
    completed_at     : nowISO(),
    scores,
    qes_delta        : qesDelta,
    stagnation_count : stagnationCount,
    coo_calls        : cooCalls,
    worker_measurements: {
      lighthouse_ran : isHeavyRun,
      bundle_scan_ran: isHeavyRun,
      llm_calls      : calls,
    },
    error: null,
  };

  // ─── TEO 保存 ─────────────────────────────────────────────────────
  const teoPath = path.join(QUALITY_DIR, `teo_${taskId}.json`);
  fs.writeFileSync(teoPath, JSON.stringify(teo, null, 2) + '\n', 'utf8');
  console.log(`  ✅ TEO saved: ${teoPath} (QES Δ${qesDelta >= 0 ? '+' : ''}${qesDelta})`);

  return teo;
}

module.exports = { score };

// ─── CLI 直接実行（デバッグ用）─────────────────────────────────────────────
if (require.main === module) {
  const taskId = process.argv[2] || `task_${Date.now()}`;
  score(taskId, { cwd: process.cwd(), taskCount: 0 })
    .then((teo) => { console.log('\nTEO:'); console.log(JSON.stringify(teo, null, 2)); })
    .catch(console.error);
}
