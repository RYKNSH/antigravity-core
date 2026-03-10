#!/usr/bin/env node
/**
 * coo-lite.js — Task 8.1.4 + 8.1.5
 * Stagnation 検知時に上位 LLM モデルで根本原因分析を行い、
 * 「Hint」を TEO に記録する COO-Lite エンジン。
 *
 * Rate Limit (8.1.5):
 *   - max_coo_calls_per_task : 3 (環境変数 COO_MAX_CALLS でオーバーライド可)
 *   - クールダウン           : 30分
 *   - stagnation 10回でSuspend + CEO通知
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ─── 定数 ───────────────────────────────────────────────────────────────────
const ANTIGRAVITY_DIR     = process.env.ANTIGRAVITY_DIR || path.join(process.env.HOME, '.antigravity');
const DECISION_USECASES   = path.join(ANTIGRAVITY_DIR, 'docs', 'DECISION_USECASES.md');
const QUALITY_DIR         = path.join(__dirname, '.quality');
const COO_STATE_FILE      = path.join(QUALITY_DIR, 'coo_lite_state.json');

const MAX_CALLS_PER_TASK  = parseInt(process.env.COO_MAX_CALLS    || '3',   10);
const COOLDOWN_MS         = parseInt(process.env.COO_COOLDOWN_MS  || String(30 * 60 * 1000), 10);
const STAGNATION_SUSPEND  = parseInt(process.env.COO_SUSPEND_AT   || '10',  10);
const COO_MODEL           = process.env.COO_MODEL || 'gemini-2.0-flash';

// ─── State 管理 ──────────────────────────────────────────────────────────────

function loadState() {
  try { return JSON.parse(fs.readFileSync(COO_STATE_FILE, 'utf8')); }
  catch (_) { return {}; }
}

function saveState(state) {
  fs.mkdirSync(QUALITY_DIR, { recursive: true });
  fs.writeFileSync(COO_STATE_FILE, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

// ─── Rate Limit チェック ─────────────────────────────────────────────────────

/**
 * checkRateLimit(taskId, stagnationCount)
 * @returns {{ allowed: boolean, reason?: string }}
 */
function checkRateLimit(taskId, stagnationCount) {
  const state    = loadState();
  const taskKey  = `task_${taskId}`;
  const taskStat = state[taskKey] || { calls: 0, lastCallAt: null };

  // ① Suspend: stagnation 10 回以上
  if (stagnationCount >= STAGNATION_SUSPEND) {
    return { allowed: false, reason: `SUSPEND: stagnation_count=${stagnationCount} >= ${STAGNATION_SUSPEND}. CEO notification required.` };
  }

  // ② max_calls_per_task 超過
  if (taskStat.calls >= MAX_CALLS_PER_TASK) {
    return { allowed: false, reason: `Rate limit: COO called ${taskStat.calls} times for task ${taskId} (max: ${MAX_CALLS_PER_TASK}).` };
  }

  // ③ cooldown
  if (taskStat.lastCallAt) {
    const elapsed = Date.now() - taskStat.lastCallAt;
    if (elapsed < COOLDOWN_MS) {
      const remaining = Math.ceil((COOLDOWN_MS - elapsed) / 60_000);
      return { allowed: false, reason: `Cooldown: ${remaining} min remaining for task ${taskId}.` };
    }
  }

  return { allowed: true };
}

function incrementCallCount(taskId) {
  const state   = loadState();
  const taskKey = `task_${taskId}`;
  if (!state[taskKey]) state[taskKey] = { calls: 0, lastCallAt: null };
  state[taskKey].calls      += 1;
  state[taskKey].lastCallAt  = Date.now();
  saveState(state);
  return state[taskKey].calls;
}

// ─── CEO サスペンド通知 ──────────────────────────────────────────────────────

function notifyCeoSuspend(taskId, stagnationCount, teoPath) {
  const alertFile = path.join(ANTIGRAVITY_DIR, 'state', 'SYSTEM_ALERTS.md');
  try {
    const msg = [
      '',
      `## COO-Lite SUSPEND — ${new Date().toISOString()}`,
      '',
      `- **task_id**: ${taskId}`,
      `- **stagnation_count**: ${stagnationCount} (threshold: ${STAGNATION_SUSPEND})`,
      `- **TEO**: ${teoPath}`,
      '- **要対応**: CEOによる根本原因の確認と次タスク指示が必要です。',
      '',
      '---',
    ].join('\n');
    fs.mkdirSync(path.dirname(alertFile), { recursive: true });
    fs.appendFileSync(alertFile, msg, 'utf8');
    console.log(`  🚨 CEO suspend notification written to ${alertFile}`);
  } catch (e) {
    console.error('  ⚠️  Failed to write SYSTEM_ALERTS.md:', e.message);
  }
}

// ─── LLM 呼び出し（Gemini API）──────────────────────────────────────────────

async function callLlm(prompt, systemInstruction) {
  // @google/generative-ai が利用可能であれば SDK を使用、なければ fetch fallback
  let GoogleGenerativeAI;
  try { ({ GoogleGenerativeAI } = require('@google/generative-ai')); }
  catch (_) { GoogleGenerativeAI = null; }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set.');

  if (GoogleGenerativeAI) {
    const genai  = new GoogleGenerativeAI(apiKey);
    const model  = genai.getGenerativeModel({
      model: COO_MODEL,
      systemInstruction,
    });
    const result = await model.generateContent(prompt);
    return result.response.text();
  }

  // Fetch フォールバック（SDK なし環境でも動作）
  const url  = `https://generativelanguage.googleapis.com/v1beta/models/${COO_MODEL}:generateContent?key=${apiKey}`;
  const body = JSON.stringify({
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  });
  const { default: fetch } = await import('node-fetch').catch(() => ({ default: globalThis.fetch }));
  const res  = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    signal: AbortSignal.timeout ? AbortSignal.timeout(30_000) : undefined,
  });
  if (!res.ok) throw new Error(`Gemini API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '(empty response)';
}

// ─── コンテキスト構築 ────────────────────────────────────────────────────────

function buildSystemInstruction() {
  try {
    const mr = fs.readFileSync(DECISION_USECASES, 'utf8');
    return [
      'You are COO-Lite, a quality governance AI assisting the Daemon Core agent.',
      'Your role is to analyze stagnation causes and provide actionable hints to break through the blockage.',
      'Respond in Japanese. Be concise and actionable (max 200 chars).',
      '',
      '# Meta Rules (Active)',
      mr,
    ].join('\n');
  } catch (_) {
    return 'You are COO-Lite, a quality governance AI. Analyze stagnation and provide a short actionable hint in Japanese.';
  }
}

function buildPrompt(taskId, stagnationCount, errorHistory, prevHints) {
  return [
    `## Stagnation Report`,
    `- task_id: ${taskId}`,
    `- stagnation_count: ${stagnationCount}`,
    `- recent_errors (last 5):`,
    ...(errorHistory || []).slice(-5).map((e) => `  - ${e}`),
    '',
    prevHints && prevHints.length > 0
      ? `## Previous COO Hints (already tried):\n${prevHints.map((h) => `  - ${h}`).join('\n')}`
      : '',
    '',
    '## Task',
    'Analyze the root cause of the stagnation and provide ONE actionable hint to break through. Keep it under 200 characters.',
  ].filter(Boolean).join('\n');
}

// ─── メイン API ──────────────────────────────────────────────────────────────

/**
 * invoke(taskId, context) — COO-Lite の呼び出しエントリポイント
 * @param {string} taskId
 * @param {object} context - { stagnationCount, errorHistory, prevHints, teoPath }
 * @returns {Promise<{invoked: boolean, hint?: string, reason?: string}>}
 */
async function invoke(taskId, context = {}) {
  const {
    stagnationCount = 0,
    errorHistory    = [],
    prevHints       = [],
    teoPath         = null,
  } = context;

  console.log(`  🤖 COO-Lite: checking rate limit for task=${taskId} (stagnation=${stagnationCount})`);

  // ① Rate limit チェック
  const { allowed, reason } = checkRateLimit(taskId, stagnationCount);
  if (!allowed) {
    console.log(`  ⚠️  COO-Lite blocked: ${reason}`);

    // SUSPEND 通知（stagnation >= 閾値の場合）
    if (stagnationCount >= STAGNATION_SUSPEND) {
      notifyCeoSuspend(taskId, stagnationCount, teoPath);
    }
    return { invoked: false, reason };
  }

  // ② Environment Check（import）
  const envCheck = require('./environment-check');
  const { passed, results } = await envCheck.run();
  if (!passed) {
    const failedChecks = results.filter((r) => !r.ok).map((r) => r.name).join(', ');
    const errMsg = `Environment check failed: [${failedChecks}]. COO-Lite not invoked.`;
    console.log(`  ❌ ${errMsg}`);
    results.filter((r) => !r.ok).forEach((r) => console.log(`     ${r.name}: ${r.detail}`));
    return { invoked: false, reason: errMsg };
  }

  // ③ LLM 呼び出し
  console.log(`  🟡 Invoking COO-Lite (model: ${COO_MODEL})...`);
  const callCount = incrementCallCount(taskId);

  try {
    const systemInstruction = buildSystemInstruction();
    const prompt            = buildPrompt(taskId, stagnationCount, errorHistory, prevHints);
    const hint              = await callLlm(prompt, systemInstruction);

    console.log(`  ✅ COO-Lite hint (call ${callCount}/${MAX_CALLS_PER_TASK}): ${hint.slice(0, 120)}...`);
    return { invoked: true, hint: hint.trim(), callCount, model: COO_MODEL };
  } catch (e) {
    const errMsg = `COO-Lite LLM error: ${e.message}`;
    console.error(`  ❌ ${errMsg}`);
    return { invoked: false, reason: errMsg };
  }
}

module.exports = { invoke, checkRateLimit, notifyCeoSuspend };

// ─── CLI 直接実行（デバッグ用）─────────────────────────────────────────────
if (require.main === module) {
  const taskId = process.argv[2] || 'test_task_001';
  const stagnationCount = parseInt(process.argv[3] || '5', 10);
  invoke(taskId, { stagnationCount, errorHistory: ['TypeError: cannot read property'], prevHints: [] })
    .then((result) => { console.log('\nCOO-Lite Result:', JSON.stringify(result, null, 2)); })
    .catch(console.error);
}
