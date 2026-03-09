#!/usr/bin/env node
/**
 * agent-loop.js — Daemon Core: Headless LLM Agent Engine
 *
 * Phase 6 実装:
 *  - 6.1.1  Gemini API クライアント (ReAct ループ)
 *  - 6.1.3  Think → Act → Observe ループ
 *  - 6.1.4  COO Smart Contract JSON 受信・遵守
 *  - 6.1.5  Stagnation Watcher: N回改善なし → Suspend + COO レポート
 *  - 6.1.6  COO-guided Iteration: Hint JSON 受け取り → 再起動
 *  - 6.1.7  Write Interceptor: 50行超 diff → ステージング → COO 承認待機
 *
 * MCP Gateway (6.1.2) は agent/scripts/mcp-host-server.js で別プロセス実装。
 * ここでは HTTP 経由で Mac 側 MCP サーバーを叩く。
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { execSync } = require('child_process');

// ─── 定数 ─────────────────────────────────────────────────────────────────────
const ANTIGRAVITY_DIR  = process.env.ANTIGRAVITY_DIR || '/antigravity';
const STATE_FILE       = path.join(ANTIGRAVITY_DIR, '.session_state.json');
const BLACKLIST_FILE   = path.join(ANTIGRAVITY_DIR, '.fatal_blacklist.json');
const KNOWLEDGE_DIR    = path.join(ANTIGRAVITY_DIR, 'knowledge');
const STAGING_DIR      = path.join(ANTIGRAVITY_DIR, '.write_staging');
const POLL_INTERVAL    = 3000;   // ms
const MAX_RETRIES      = 3;      // Gemini API コール失敗時のリトライ

// MCP Host Server (Mac 側) の URL
const MCP_HOST         = process.env.MAC_HOST_IP || 'host.docker.internal';
const MCP_PORT         = parseInt(process.env.MCP_PORT || '7070', 10);

// ─── ユーティリティ ────────────────────────────────────────────────────────────
function log(msg, level = 'INFO') {
  console.log(`[${new Date().toISOString()}] [${level}] ${msg}`);
}

function readJSON(filePath, defaultVal = null) {
  if (!fs.existsSync(filePath)) return defaultVal;
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return defaultVal; }
}

function writeJSON(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function readState() { return readJSON(STATE_FILE, {}); }
function writeState(state) { writeJSON(STATE_FILE, state); }

// ─── Gemini API ───────────────────────────────────────────────────────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL   = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

async function callGemini(prompt, systemInstruction = '') {
  if (!GEMINI_API_KEY) {
    log('GEMINI_API_KEY not set. Using mock response for testing.', 'WARN');
    return `[MOCK] Received prompt (${prompt.length} chars). Would execute task here.`;
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const body = JSON.stringify({
    system_instruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generation_config: { temperature: 0.2, max_output_tokens: 4096 },
  });

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await httpPost(endpoint, body);
      const parsed = JSON.parse(response);
      const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Empty response from Gemini API');
      return text;
    } catch (e) {
      log(`Gemini API attempt ${attempt}/${MAX_RETRIES} failed: ${e.message}`, 'WARN');
      if (attempt === MAX_RETRIES) throw e;
      await sleep(2000 * attempt);
    }
  }
}

function httpPost(url, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const lib = urlObj.protocol === 'https:' ? https : http;
    const req = lib.request({
      hostname: urlObj.hostname, path: urlObj.pathname + urlObj.search,
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─── MCP Host Server 呼び出し ─────────────────────────────────────────────────
async function mcpCall(action, payload = {}) {
  const body = JSON.stringify({ action, ...payload });
  try {
    const result = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: MCP_HOST, port: MCP_PORT, path: '/mcp', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      }, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => resolve(JSON.parse(data)));
      });
      req.on('error', reject);
      req.write(body); req.end();
    });
    return result;
  } catch (e) {
    log(`MCP call failed (${action}): ${e.message}. Falling back to direct exec.`, 'WARN');
    return { ok: false, error: e.message };
  }
}

async function readFile(filePath) {
  const res = await mcpCall('readFile', { path: filePath });
  if (res.ok) return res.content;
  // フォールバック: コンテナ内から直接読む (Volume マウント経由)
  if (fs.existsSync(filePath)) return fs.readFileSync(filePath, 'utf8');
  return null;
}

async function writeFile(filePath, content, { skipInterceptor = false } = {}) {
  // Write Interceptor (6.1.7): 50行超は COO承認を要求
  if (!skipInterceptor) {
    const lines = content.split('\n').length;
    if (lines > 50) {
      return await stageWrite(filePath, content, lines);
    }
  }
  const res = await mcpCall('writeFile', { path: filePath, content });
  if (!res.ok) {
    // フォールバック: Volume 経由で直書き (コンテナ内パスのみ許可)
    if (filePath.startsWith('/antigravity/')) {
      fs.writeFileSync(filePath, content);
      return { ok: true, method: 'direct' };
    }
    throw new Error(`writeFile failed: ${res.error}`);
  }
  return res;
}

async function runCommand(cmd) {
  const res = await mcpCall('exec', { cmd });
  if (res.ok) return { stdout: res.stdout, stderr: res.stderr, exitCode: res.exitCode };
  // フォールバック: コンテナ内で直接実行
  try {
    const stdout = execSync(cmd, { encoding: 'utf8', timeout: 30000 });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (e) {
    return { stdout: e.stdout || '', stderr: e.stderr || e.message, exitCode: e.status || 1 };
  }
}

// ─── Write Interceptor (6.1.7) ────────────────────────────────────────────────
async function stageWrite(filePath, content, lines) {
  fs.mkdirSync(STAGING_DIR, { recursive: true });
  const stageId = `stage_${Date.now()}`;
  const stagePath = path.join(STAGING_DIR, stageId + '.json');
  writeJSON(stagePath, { stageId, filePath, content, lines, staged_at: new Date().toISOString(), status: 'pending_approval' });

  // State に COO 承認要求を記録
  const state = readState();
  if (!state.coo_approvals) state.coo_approvals = [];
  state.coo_approvals.push({ stageId, filePath, lines, status: 'pending' });
  writeState(state);

  log(`[Write Interceptor] ${lines} lines → staged as ${stageId}. Waiting for COO approval.`, 'WARN');

  // COO 承認を最大5分間待つ
  for (let i = 0; i < 300; i++) {
    await sleep(1000);
    const s = readState();
    const approval = (s.coo_approvals || []).find(a => a.stageId === stageId);
    if (approval?.status === 'approved') {
      log(`[Write Interceptor] ${stageId} approved. Executing write.`, 'INFO');
      return await writeFile(filePath, content, { skipInterceptor: true });
    }
    if (approval?.status === 'rejected') {
      log(`[Write Interceptor] ${stageId} rejected by COO.`, 'WARN');
      return { ok: false, reason: 'rejected_by_coo' };
    }
  }
  log(`[Write Interceptor] ${stageId} timed out (300s). Aborting write.`, 'ERROR');
  return { ok: false, reason: 'approval_timeout' };
}

// ─── Fatal Blacklist (L1 免疫系) ─────────────────────────────────────────────
function loadBlacklist() { return readJSON(BLACKLIST_FILE, { patterns: [] }); }

function updateBlacklist(errorMsg) {
  const bl = loadBlacklist();
  const pattern = errorMsg.substring(0, 120); // 先頭120文字をパターンとして記録
  const existing = bl.patterns.find(p => p.pattern === pattern);
  if (existing) {
    existing.count = (existing.count || 1) + 1;
    existing.last_seen = new Date().toISOString();
  } else {
    bl.patterns.push({ pattern, count: 1, first_seen: new Date().toISOString(), last_seen: new Date().toISOString() });
  }
  writeJSON(BLACKLIST_FILE, bl);
  log(`[Blacklist] Updated: "${pattern.substring(0, 60)}…"`, 'INFO');
  return bl;
}

function isBlacklisted(errorMsg) {
  const { patterns } = loadBlacklist();
  return patterns.some(p => errorMsg.includes(p.pattern));
}

// ─── Quality Gate 評価 ────────────────────────────────────────────────────────
async function evaluateQualityGates(gates) {
  let score = 0;
  const results = [];
  for (const gate of gates) {
    if (gate.type === 'command') {
      // コンテナ内で直接実行（MCP を経由しない）
      let stdout = '', stderr = '', exitCode = 0;
      try {
        stdout = execSync(gate.cmd, { encoding: 'utf8', timeout: 30000 });
      } catch (e) {
        stdout = e.stdout || '';
        stderr = e.stderr || e.message || '';
        exitCode = e.status || 1;
      }
      const passed = exitCode === 0;
      results.push({ gate, passed, stdout, stderr });
      if (passed) score += 10;
      log(`  Gate [${gate.cmd}]: ${passed ? '✅' : '❌'} (exit ${exitCode})`);
    } else if (gate.type === 'lighthouse') {
      // Lighthouse はコンテナ外の MCP 経由で実行
      const res = await mcpCall('lighthouse', { url: gate.url || 'http://localhost:3000', minScore: gate.score_min });
      const passed = res.ok && res.score >= gate.score_min;
      results.push({ gate, passed, score: res.score });
      if (passed) score += 10;
      log(`  Gate [lighthouse]: ${passed ? '✅' : '❌'} (score: ${res.score || 'N/A'})`);
    }
  }
  return { score, results, allPassed: results.every(r => r.passed) };
}


// ─── Knowledge 書き込み (L2) ──────────────────────────────────────────────────
async function saveToKnowledge(task, outcome, errorHistory) {
  fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
  const today = new Date().toISOString().split('T')[0];
  const slug = task.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 40);
  const kPath = path.join(KNOWLEDGE_DIR, `${today}_${slug}.md`);
  const content = `# Knowledge: ${task}
Date: ${today}

## 結果
${outcome.allPassed ? '✅ 成功' : '❌ 失敗'}

## タスク
${task}

## エラー履歴 (${errorHistory.length}件)
${errorHistory.map((e, i) => `### ${i + 1}. ${e.type}\n\`\`\`\n${e.message}\n\`\`\``).join('\n\n')}

## 最終スコア
- Gates passed: ${outcome.results?.filter(r => r.passed).length || 0}/${outcome.results?.length || 0}
`;
  await writeFile(kPath, content, { skipInterceptor: true });
  log(`[Knowledge] Saved → ${path.basename(kPath)}`);
}

// ─── Stagnation Watcher (6.1.5) ───────────────────────────────────────────────
class StagnationWatcher {
  constructor(threshold) {
    this.threshold = threshold || 5;
    this.history = [];
  }
  record(score) {
    this.history.push({ score, ts: Date.now() });
    if (this.history.length > this.threshold + 2) this.history.shift();
  }
  isStagnant() {
    if (this.history.length < this.threshold) return false;
    const recent = this.history.slice(-this.threshold);
    const baseline = recent[0].score;
    return recent.every(h => h.score <= baseline);
  }
}

// ─── COO レポート (Suspend 用) ────────────────────────────────────────────────
function reportToCoO(taskId, reason, errorHistory, lastScore) {
  const state = readState();
  if (!state.coo_reports) state.coo_reports = [];
  const report = {
    taskId, reason, lastScore,
    suspended_at: new Date().toISOString(),
    error_summary: errorHistory.slice(-3).map(e => ({ type: e.type, message: e.message.substring(0, 200) })),
    hint: null,  // COO がここに Hint を書き込む
    status: 'awaiting_hint',
  };
  state.coo_reports.push(report);
  writeState(state);
  log(`[Suspend] Reported to COO: taskId=${taskId}, reason=${reason}, score=${lastScore}`, 'WARN');
  return report;
}

// COO から Hint が書き込まれるのを待つ
async function waitForHint(taskId, timeoutMs = 300000) {
  log(`[COO-guided] Waiting for COO hint (taskId=${taskId})...`);
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await sleep(5000);
    const state = readState();
    const report = (state.coo_reports || []).find(r => r.taskId === taskId);
    if (report?.hint) {
      log(`[COO-guided] Hint received: "${report.hint.substring(0, 100)}…"`, 'INFO');
      return report.hint;
    }
  }
  return null;
}

// ─── ReAct ループ (Think → Act → Observe) ────────────────────────────────────
async function reactLoop(task, contract) {
  const budget = contract?.budget || {};
  const gates  = contract?.quality_gates || [];
  const stagnationThreshold = budget.stagnation_threshold || 5;
  const maxCalls = budget.max_llm_calls || 30;
  const metaRules = contract?.meta_rules_summary || '';

  const watcher = new StagnationWatcher(stagnationThreshold);
  const errorHistory = [];
  let loopCount = 0;
  let llmCallCount = 0;
  let lastScore = 0;
  let hint = null; // COO-guided Iteration

  log(`[ReAct] Starting loop for task: "${task.task}"`);
  log(`[ReAct] Budget: max_llm_calls=${maxCalls}, stagnation_threshold=${stagnationThreshold}`);

  // 既存ファイルのコンテキストを読む
  const relevantFiles = contract?.context?.relevant_files || [];
  const fileContexts = await Promise.all(
    relevantFiles.map(async f => {
      const content = await readFile(f);
      return content ? `### ${f}\n\`\`\`\n${content.substring(0, 2000)}\n\`\`\`` : null;
    })
  ).then(r => r.filter(Boolean));

  const systemInstruction = `あなたは Daemon Core — 自律的に実装を完遂する AI エンジンです。
毎回のレスポンスで必ず1つのアクションJSONを出力してください。

## 行動原則（厳守）
1. **タスクに必要なファイルパスが既にわかっている場合、read_file は不要**。直接 write_file を実行せよ。
2. **同じファイルやパスの read_file を2回以上実行してはならない**。
3. **ls, pwd など探索コマンドを繰り返してはならない**。1回で十分。
4. **修正内容が明確なら最初のアクションで write_file を実行せよ**。情報収集ループは禁止。
5. write_file 後は必ずテストコマンドを run_command で実行してパスを確認せよ。
6. テストが全パスしたら {"action": "done", "summary": "完了"} を出力せよ。

## メタルール
${metaRules || '品質最優先。テストが全てパスするまでループする。'}

## ブラックリスト（過去の失敗パターン）
${loadBlacklist().patterns.slice(-10).map(p => `- ${p.pattern}`).join('\n') || 'なし'}

## 利用可能なアクション (JSON 形式で出力すること)
- {"action": "read_file", "path": "ファイルパス"}
- {"action": "write_file", "path": "ファイルパス", "content": "内容"}
- {"action": "run_command", "cmd": "コマンド"}
- {"action": "done", "summary": "完了した内容の要約"}
- {"action": "stuck", "reason": "詰まった理由"}

必ずJSON のアクションブロックを含めてください。`;

  while (llmCallCount < maxCalls) {
    loopCount++;
    log(`[ReAct] ── Loop ${loopCount} (LLM calls: ${llmCallCount}/${maxCalls}) ──`);

    // ── THINK ──
    const prompt = `## タスク
${task.task}

## 現在の状況
- ループ回数: ${loopCount}
- LLMコール数: ${llmCallCount}/${maxCalls}
- 最後のスコア: ${lastScore}
- エラー履歴 (直近3件):
${errorHistory.slice(-3).map(e => `  - [${e.type}] ${e.message.substring(0, 150)}`).join('\n') || '  なし'}

## 関連ファイルの内容
${fileContexts.slice(0, 3).join('\n\n') || 'なし'}

${hint ? `## COO からのヒント\n${hint}` : ''}

## 指示
次のアクションを1つ、JSON 形式で **必ず** 出力してください。
余計なテキストは不要。JSONブロックのみ出力すること。

**重要ルール**:
${hint ? `- COO からのヒントがある → **必ず最初に write_file を実行する**。read_file や run_command を先に実行してはいけない。` : ''}
- ファイルを読み込むのは1回だけにすること。同じパスの read_file を2回以上実行しないこと。
- ls や pwd などの探索コマンドを繰り返さないこと。
- テストを実行して品質ゲートが全てパスすれば {"action": "done", "summary": "完了"} を出力する。
- どうしても詰まった場合は {"action": "stuck", "reason": "詰まった理由"} を出力する。

**出力フォーマット例**（必ずこの形式で）:
\`\`\`json
{"action": "write_file", "path": "e2e-demo/math.js", "content": "コード"}
\`\`\``;


    let llmResponse;
    try {
      llmResponse = await callGemini(prompt, systemInstruction);
      llmCallCount++;
    } catch (e) {
      log(`[ReAct] Gemini API error: ${e.message}`, 'ERROR');
      errorHistory.push({ type: 'llm_error', message: e.message });
      await sleep(5000);
      continue;
    }

    log(`[ReAct] LLM response (${llmResponse.length} chars): ${llmResponse.substring(0, 200)}…`);

    // ── ACT ── JSON 抽出（3段階フォールバック）
    let jsonStr = null;

    // Strategy 1: ```json ... ``` コードブロックを抽出（Gemini の典型的出力）
    const codeBlockMatch = llmResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }

    // Strategy 2: 最後の完全な { ... } ブロック（ネストなし）
    if (!jsonStr) {
      const allBraces = [...llmResponse.matchAll(/\{[^{}]*\}/g)];
      if (allBraces.length > 0) {
        jsonStr = allBraces[allBraces.length - 1][0];
      }
    }

    // Strategy 3: 元の正規表現（フォールバック）
    if (!jsonStr) {
      const m = llmResponse.match(/\{[\s\S]*?"action"\s*:\s*"[^"]+/);
      if (m) jsonStr = m[0] + '"}'; // 最低限の閉じカッコ補完
    }

    if (!jsonStr) {
      log('[ReAct] No action JSON found in response. Retrying.', 'WARN');
      errorHistory.push({ type: 'no_action', message: llmResponse.substring(0, 200) });
      continue;
    }

    let action;
    try { action = JSON.parse(jsonStr); } catch (e) {
      log(`[ReAct] JSON parse error: ${e.message} | raw: ${jsonStr.substring(0, 100)}`, 'WARN');
      errorHistory.push({ type: 'parse_error', message: e.message });
      continue;
    }

    log(`[ReAct] Action: ${action.action}`);

    // ── OBSERVE ──
    let observation = '';

    if (action.action === 'done') {
      log(`[ReAct] Task complete! Summary: ${action.summary}`);
      const evaluation = await evaluateQualityGates(gates);
      if (evaluation.allPassed) {
        log('[ReAct] ✅ All quality gates PASSED.');
        await saveToKnowledge(task.task, evaluation, errorHistory);
        return { success: true, loops: loopCount, llmCalls: llmCallCount };
      } else {
        log('[ReAct] ⚠️ Quality gates not fully passed. Continuing.', 'WARN');
        observation = `Quality gates: ${evaluation.score} score. Failed: ${evaluation.results.filter(r => !r.passed).map(r => r.gate.cmd || r.gate.type).join(', ')}`;
        errorHistory.push({ type: 'quality_gate_fail', message: observation });
        lastScore = evaluation.score;
        watcher.record(lastScore);
      }
    }

    else if (action.action === 'stuck') {
      log(`[ReAct] Daemon reports stuck: ${action.reason}`, 'WARN');
      errorHistory.push({ type: 'stuck', message: action.reason });
      // Stagnation Watcher が先に検知していなければここで記録
      watcher.record(lastScore);
    }

    else if (action.action === 'read_file') {
      const content = await readFile(action.path);
      observation = content ? `File: ${action.path}\n\`\`\`\n${content.substring(0, 3000)}\n\`\`\`` : `File not found: ${action.path}`;
    }

    else if (action.action === 'write_file') {
      const writeResult = await writeFile(action.path, action.content || '');
      if (writeResult.ok === false && writeResult.reason) {
        observation = `Write intercepted/rejected: ${writeResult.reason}`;
        errorHistory.push({ type: 'write_intercepted', message: observation });
      } else {
        observation = `Written: ${action.path}`;

        // Auto Test: Quality Gate コマンドを自動実行して即時評価
        if (gates.length > 0) {
          await sleep(300); // ファイルシステムのフラッシュ待機
          log('[ReAct] Auto-running quality gate after write_file...');
          const autoEval = await evaluateQualityGates(gates);
          if (autoEval.allPassed) {
            log('[ReAct] ✅ All quality gates PASSED (auto-test after write). Task complete!');
            await saveToKnowledge(task.task, autoEval, errorHistory);
            return { success: true, loops: loopCount, llmCalls: llmCallCount };
          } else {
            const failedGates = autoEval.results.filter(r => !r.passed);
            const failInfo = failedGates.map(r => {
              const stderr = (r.stderr || '').substring(0, 300);
              const stdout = (r.stdout || '').substring(0, 200);
              return `[FAIL] ${r.gate.cmd}\nSTDOUT: ${stdout}\nSTDERR: ${stderr}`;
            }).join('\n\n');
            observation = `Written: ${action.path}\n\n[Auto Test FAILED]\n${failInfo}\n\n→ コードを修正して再度 write_file してください。`;
            lastScore = autoEval.score;
            watcher.record(lastScore);
          }
        }
      }
    }


    else if (action.action === 'run_command') {
      // Blacklist チェック
      if (isBlacklisted(action.cmd)) {
        observation = `[Blacklisted] Command prevented: ${action.cmd}`;
        log(`[Blacklist] Blocked: ${action.cmd}`, 'WARN');
      } else {
        const { stdout, stderr, exitCode } = await runCommand(action.cmd);
        observation = `Exit: ${exitCode}\nSTDOUT:\n${stdout.substring(0, 1000)}\nSTDERR:\n${stderr.substring(0, 500)}`;

        if (exitCode !== 0) {
          errorHistory.push({ type: 'command_error', message: `${action.cmd}: ${stderr.substring(0, 200)}` });
          updateBlacklist(stderr.substring(0, 120));
          watcher.record(lastScore);
        } else {
          // exit 0 = コマンド成功 → スコア加算
          const isQualityGateCmd = gates.some(g => g.type === 'command' && g.cmd === action.cmd);
          const baseScore = isQualityGateCmd ? 10 : 1;
          lastScore += baseScore;
          watcher.record(lastScore);
          log(`[ReAct] Command succeeded (exit 0). Score: ${lastScore}`);

          // Quality Gate コマンドが成功した場合 → 自動で全体評価して done 遷移
          if (isQualityGateCmd || stdout.includes('✅') || stdout.toLowerCase().includes('all tests passed')) {
            log('[ReAct] Test success detected — auto-evaluating quality gates...');
            const autoEval = await evaluateQualityGates(gates);
            if (autoEval.allPassed) {
              log('[ReAct] ✅ All quality gates PASSED (auto-detected). Task complete!');
              await saveToKnowledge(task.task, autoEval, errorHistory);
              return { success: true, loops: loopCount, llmCalls: llmCallCount };
            } else {
              observation += `\n\n[Quality Gate 部分PASS: ${autoEval.score}点] 残り: ${autoEval.results.filter(r => !r.passed).map(r => r.gate.cmd).join(', ')}`;
              lastScore = autoEval.score;
            }
          }
        }
      }
    }


    // ── Stagnation Watcher ──
    if (watcher.isStagnant()) {
      log(`[Stagnation] Score stuck at ${lastScore} for ${stagnationThreshold} attempts. Suspending.`, 'WARN');
      reportToCoO(task.id, 'stagnation', errorHistory, lastScore);

      // COO Hint を待つ (6.1.6)
      const receivedHint = await waitForHint(task.id, 300000);
      if (receivedHint) {
        hint = receivedHint;
        watcher.history = []; // ウォッチャーをリセット
        log('[COO-guided] Resuming with hint.');
        continue;
      } else {
        log('[Stagnation] No hint received in 5 min. Aborting task.', 'ERROR');
        await saveToKnowledge(task.task, { allPassed: false, results: [] }, errorHistory);
        return { success: false, reason: 'stagnation_no_hint', loops: loopCount, llmCalls: llmCallCount };
      }
    }

    if (observation) log(`[Observe] ${observation.substring(0, 200)}`);
    await sleep(500);
  }

  log(`[ReAct] Budget exhausted (${maxCalls} LLM calls). Suspending.`, 'WARN');
  reportToCoO(task.id, 'budget_exhausted', errorHistory, lastScore);
  await saveToKnowledge(task.task, { allPassed: false, results: [] }, errorHistory);
  return { success: false, reason: 'budget_exhausted', loops: loopCount, llmCalls: llmCallCount };
}

// ─── Self-Reinforcing Learning ループ トリガー (Phase 7) ──────────────────────
const LEARNING_SCRIPTS = {
  L3: path.join(ANTIGRAVITY_DIR, 'agent/scripts/skill-upgrader.js'),
  L4: path.join(ANTIGRAVITY_DIR, 'agent/scripts/coo-optimizer.js'),
  L5: path.join(ANTIGRAVITY_DIR, 'agent/scripts/knowledge-distiller.js'),
};

async function triggerLearningLoops(completedCount, hasCooReports) {
  // L3: 5タスクごとに knowledge → SKILL.md 昇格
  if (completedCount % 5 === 0 && fs.existsSync(LEARNING_SCRIPTS.L3)) {
    log('[Learning] L3: skill-upgrader 起動');
    try { execSync(`node ${LEARNING_SCRIPTS.L3}`, { timeout: 30000, stdio: 'pipe' }); }
    catch (e) { log(`[Learning] L3 failed: ${e.message}`, 'WARN'); }
  }
  // L5: 10タスクごとに knowledge → distilled/ 蒸留
  if (completedCount % 10 === 0 && fs.existsSync(LEARNING_SCRIPTS.L5)) {
    log('[Learning] L5: knowledge-distiller 起動');
    try { execSync(`node ${LEARNING_SCRIPTS.L5}`, { timeout: 60000, stdio: 'pipe' }); }
    catch (e) { log(`[Learning] L5 failed: ${e.message}`, 'WARN'); }
  }
  // L4: COOレポートがあれば COO 自己最適化
  if (hasCooReports && fs.existsSync(LEARNING_SCRIPTS.L4)) {
    log('[Learning] L4: coo-optimizer 起動');
    try { execSync(`node ${LEARNING_SCRIPTS.L4}`, { timeout: 30000, stdio: 'pipe' }); }
    catch (e) { log(`[Learning] L4 failed: ${e.message}`, 'WARN'); }
  }
}

// ─── メインポーリングループ ────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function mainLoop() {
  log('🚀 Daemon Core starting... (Phase 7: Self-Reinforcing Learning Loops ACTIVE)');
  log(`   STATE_FILE: ${STATE_FILE}`);
  log(`   MCP_HOST  : ${MCP_HOST}:${MCP_PORT}`);
  log(`   GEMINI    : ${GEMINI_API_KEY ? 'API key loaded' : 'NOT SET (mock mode)'}`);
  log('   Learning  : L1(Blacklist) L2(Knowledge) L3(Skills) L4(COO) L5(Distill) ALL ACTIVE');

  while (true) {
    try {
      const state = readState();
      if (!state) { await sleep(POLL_INTERVAL); continue; }

      // ハートビート更新
      state.last_heartbeat = new Date().toISOString();
      writeState(state);

      // pending タスクを取得
      const pending = (state.pending_tasks || []).filter(t => t.status === 'pending');
      if (pending.length === 0) { await sleep(POLL_INTERVAL); continue; }

      const task = pending[0];
      log(`[Main] Found new task: "${task.task}" (id: ${task.id})`);

      // State を in_progress に更新
      task.status = 'in_progress';
      state.current = {
        action: task.task,
        action_ttl: task.ttl || 600,
        action_updated_at: new Date().toISOString(),
        task_id: task.id,
      };
      writeState(state);

      // ReAct ループ実行
      const contract = task.contract || {};
      const result = await reactLoop(task, contract);

      // 完了後の State 更新
      const updatedState = readState();
      updatedState.pending_tasks = (updatedState.pending_tasks || []).filter(t => t.id !== task.id);
      updatedState.current = {};
      updatedState.completed_tasks = updatedState.completed_tasks || [];
      updatedState.completed_tasks.push({ ...task, status: result.success ? 'done' : 'failed', result, completed_at: new Date().toISOString() });
      writeState(updatedState);

      log(`[Main] Task ${task.id}: ${result.success ? '✅ Done' : `❌ Failed (${result.reason})`}`);

      // ─── Phase 7: Self-Reinforcing Learning ループ ─────────────────────────
      const completedCount = updatedState.completed_tasks.length;
      const hasCooReports = (updatedState.coo_reports || []).length > 0;
      await triggerLearningLoops(completedCount, hasCooReports);

    } catch (e) {
      log(`[Main] Unexpected error: ${e.message}`, 'ERROR');
      log(e.stack, 'ERROR');
    }

    await sleep(POLL_INTERVAL);
  }
}

mainLoop();
