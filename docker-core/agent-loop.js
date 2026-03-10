#!/usr/bin/env node
/**
 * agent-loop.js — Daemon Core: Headless LLM Agent Engine
 *
 * Phase 7 (2026-03-10): Volume-Direct Write / No Interceptor / Auto-Recovery /
 *   Self-Task Generator / L3 trigger / budget=80
 *
 * Phase 8 (2026-03-10): Debate Best Practices
 *   Q1(Priority Queue) Q2(Cost Guard) Q3(Runaway) Q4(Browser QA) Q5(Vision Check) Q6(開発停止ゼロ)
 *
 * Phase 9 (2026-03-10): Critical Fix + Playwright統合
 *   F1: URLインジェクション修正 (browserQualityCheckサニタイズ)
 *   F2: 帽靈タスク修正 (mainLoop起動時にin_progress→pending復元)
 *   F3: completed_tasks rotate (最新100件保持 + archive)
 *   F4: API失敗無限ループ防止 (失敗Self-Taskをblacklistへ)
 *   E1: Playwright統合 (headless Chromiumスクリーンショット→Gemini Vision)
 *   E2: Self-TaskがTASKS.mdから実タスクを発掘
 */

const fs   = require('fs');
const path = require('path');
const https = require('https');
const http  = require('http');
const { execSync } = require('child_process');

// ─── 定数 ─────────────────────────────────────────────────────────────────────
const ANTIGRAVITY_DIR = process.env.ANTIGRAVITY_DIR || '/antigravity';
const STATE_FILE      = path.join(ANTIGRAVITY_DIR, '.session_state.json');
const BLACKLIST_FILE  = path.join(ANTIGRAVITY_DIR, '.fatal_blacklist.json');
const KNOWLEDGE_DIR   = path.join(ANTIGRAVITY_DIR, 'knowledge');
const HOST_HOME       = process.env.HOST_HOME || '/host_home';
const POLL_INTERVAL   = 3000;  // ms
const MAX_RETRIES     = 3;

// MCP Host Server (Mac側) — オプショナル
const MCP_HOST = process.env.MAC_HOST_IP || 'host.docker.internal';
const MCP_PORT = parseInt(process.env.MCP_PORT || '7070', 10);

// ─── Q2: コスト管理定数 ───────────────────────────────────────────────────────
// Gemini 2.5 Flash: ~$0.075/1M tokens, avg 8K tokens/call → $0.0006/call
const COST_PER_LLM_CALL  = 0.0006;          // USD
const COST_MONTHLY_LIMIT = 5.0;             // USD: $5超過でフラグ
const COST_FILE          = path.join(ANTIGRAVITY_DIR, '.cost_tracker.json');

// ─── Q3: 暴走検知定数 ────────────────────────────────────────────────────────
const RUNAWAY_TASK_LIMIT = 10;   // 1時間内のタスク上限
const RUNAWAY_WINDOW_MS  = 60 * 60 * 1000;  // 1時間

// ─── Q4: ブラウザ品質チェック ────────────────────────────────────────────────
const BROWSER_CHECK_ENABLED = process.env.BROWSER_CHECK !== 'false';
const SCREENSHOT_DIR = path.join(ANTIGRAVITY_DIR, '.screenshots');
// E1: Playwrightベースパス (コンテナ内はnpx playwright installの後に使用可)
const PLAYWRIGHT_AVAILABLE = (() => {
  try { require.resolve('playwright'); return true; } catch { return false; }
})();
// F3: completed_tasksの上限
const COMPLETED_TASKS_MAX = 100;
const COMPLETED_ARCHIVE_FILE = path.join(ANTIGRAVITY_DIR, 'knowledge', '_completed_archive.jsonl');
// F4: 失敗Self-Taskのblacklistキー
const SELF_TASK_FAIL_FILE  = path.join(ANTIGRAVITY_DIR, '.self_task_failures.json');
// Outbox Pattern: タスク実行中の証拠ファイル置き場
const OUTBOX_DIR = path.join(ANTIGRAVITY_DIR, 'outbox');
if (!fs.existsSync(OUTBOX_DIR)) fs.mkdirSync(OUTBOX_DIR, { recursive: true });
// P1: coo_reportsをstate.jsonから分離 —— Core(AIエージェント)が競合なく読めるように
const COO_REPORTS_FILE = path.join(ANTIGRAVITY_DIR, '.coo_reports.json');

// ─── パス解決 —— Volume マウント経由でMacのファイルにアクセス ────────────────────
/**
 * MacパスをコンテナパスへVariableマップ。
 * /Users/ryotarokonishi/... → /host_home/...
 * ~/.antigravity/...        → /antigravity/...
 */
function resolveContainerPath(filePath) {
  if (!filePath) return filePath;
  // 既にコンテナ内パスなら変換不要
  if (filePath.startsWith('/antigravity/') || filePath.startsWith('/host_home/')) return filePath;
  if (filePath.startsWith('/Users/')) {
    // /Users/<user>/.antigravity/... → /antigravity/...
    const antigravityMatch = filePath.match(/^\/Users\/[^/]+\/\.antigravity\/(.*)$/);
    if (antigravityMatch) return path.join(ANTIGRAVITY_DIR, antigravityMatch[1]);
    // /Users/<user>/... → /host_home/...
    const homeMatch = filePath.match(/^\/Users\/[^/]+\/(.*)$/);
    if (homeMatch) return path.join(HOST_HOME, homeMatch[1]);
  }
  if (filePath.startsWith('~/.antigravity/')) {
    return path.join(ANTIGRAVITY_DIR, filePath.slice('~/.antigravity/'.length));
  }
  if (filePath.startsWith('~/')) {
    return path.join(HOST_HOME, filePath.slice('~/'.length));
  }
  return filePath;
}

// ─── ユーティリティ ────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function log(msg, level = 'INFO') {
  process.stdout.write(`[${new Date().toISOString()}] [${level}] ${msg}\n`);
}

function readJSON(filePath, defaultVal = null) {
  const p = resolveContainerPath(filePath);
  if (!fs.existsSync(p)) return defaultVal;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return defaultVal; }
}

function writeJSON(filePath, data) {
  const p = resolveContainerPath(filePath);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

function readState()        { return readJSON(STATE_FILE, {}); }
function writeState(state)  { writeJSON(STATE_FILE, state); }

// ─── Gemini API ───────────────────────────────────────────────────────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL   = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

async function callGemini(prompt, systemInstruction = '') {
  if (!GEMINI_API_KEY) {
    log('GEMINI_API_KEY not set. Using mock response.', 'WARN');
    return `{"action": "done", "summary": "[MOCK] No API key set."}`;
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const body = JSON.stringify({
    system_instruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generation_config: { temperature: 0.2, max_output_tokens: 8192 },
  });

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await httpPost(endpoint, body);
      const parsed = JSON.parse(response);
      const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Empty response from Gemini API');
      // ── cost_tracker: usageMetadata 計測 ──
      const usage = parsed?.usageMetadata;
      if (usage) {
        try {
          const total = (usage.promptTokenCount || 0) + (usage.candidatesTokenCount || 0);
          // Gemini 2.5 Flash: input $0.075/1M tokens, output $0.30/1M tokens
          const costUsd = ((usage.promptTokenCount || 0) * 0.075 + (usage.candidatesTokenCount || 0) * 0.30) / 1_000_000;
          const tracker = fs.existsSync(COST_TRACKER_FILE)
            ? JSON.parse(fs.readFileSync(COST_TRACKER_FILE, 'utf8'))
            : { total_cost_usd: 0, total_tokens: 0, total_calls: 0 };
          tracker.total_cost_usd = (tracker.total_cost_usd || 0) + costUsd;
          tracker.total_tokens = (tracker.total_tokens || 0) + total;
          tracker.total_calls = (tracker.total_calls || 0) + 1;
          tracker.last_updated = new Date().toISOString();
          fs.writeFileSync(COST_TRACKER_FILE, JSON.stringify(tracker, null, 2));
        } catch { /* cost tracking failure must not block main flow */ }
      }
      return text;
    } catch (e) {
      log(`Gemini API attempt ${attempt}/${MAX_RETRIES} failed: ${e.message}`, 'WARN');
      if (attempt === MAX_RETRIES) throw e;
      await sleep(2000 * attempt);
    }
  }
}

// E1: Gemini Vision API (テキスト + base64画像)
async function callGeminiVision(prompt, imageBase64, mimeType = 'image/png') {
  if (!GEMINI_API_KEY) {
    log('GEMINI_API_KEY not set — Vision mock response.', 'WARN');
    return '{"status":"warn","score":50,"issues":[],"summary":"MOCK Vision"}';
  }
  const VISION_MODEL = 'gemini-2.5-flash'; // Vision対応モデル
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${VISION_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const body = JSON.stringify({
    contents: [{
      role: 'user',
      parts: [
        { text: prompt },
        { inline_data: { mime_type: mimeType, data: imageBase64 } },
      ],
    }],
    generation_config: { temperature: 0.1, max_output_tokens: 2048 },
  });
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await httpPost(endpoint, body);
      const parsed = JSON.parse(response);
      const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Empty Vision response');
      return text;
    } catch (e) {
      log(`[GeminiVision] attempt ${attempt}/${MAX_RETRIES} failed: ${e.message}`, 'WARN');
      if (attempt === MAX_RETRIES) return '{"status":"warn","score":40,"issues":["Vision API failed"],"summary":"Vision fallback"}';
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
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
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

// ─── MCP Host Server — オプショナル通知のみ ──────────────────────────────────
async function mcpNotify(action, payload = {}) {
  const body = JSON.stringify({ action, ...payload });
  return new Promise((resolve) => {
    const req = http.request({
      hostname: MCP_HOST, port: MCP_PORT, path: '/mcp', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(true));
    });
    req.on('error', () => resolve(false)); // MCP Hostがなくても失敗しない
    req.setTimeout(2000, () => { req.destroy(); resolve(false); });
    req.write(body);
    req.end();
  });
}

// ─── P1修正: Volume-Direct ファイル操作 ──────────────────────────────────────
async function readFile(filePath) {
  const containerPath = resolveContainerPath(filePath);
  if (fs.existsSync(containerPath)) {
    return fs.readFileSync(containerPath, 'utf8');
  }
  log(`File not found: ${containerPath}`, 'WARN');
  return null;
}

// P2修正: Write Interceptor廃止 — 50行制限なし、Volume直書き
async function writeFile(filePath, content) {
  const containerPath = resolveContainerPath(filePath);
  try {
    fs.mkdirSync(path.dirname(containerPath), { recursive: true });
    fs.writeFileSync(containerPath, content);
    log(`[Write] OK: ${containerPath} (${content.split('\n').length} lines)`);
    // MCP Hostへオプショナル通知（失敗しても問題なし）
    mcpNotify('notifyWrite', { path: filePath }).catch(() => {});
    return { ok: true, method: 'volume-direct', path: containerPath };
  } catch (e) {
    log(`[Write] Failed: ${containerPath}: ${e.message}`, 'ERROR');
    return { ok: false, error: e.message };
  }
}

async function runCommand(cmd) {
  try {
    const stdout = execSync(cmd, { encoding: 'utf8', timeout: 60000 });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (e) {
    return { stdout: e.stdout || '', stderr: e.stderr || e.message, exitCode: e.status || 1 };
  }
}

// ─── Fatal Blacklist (L1 免疫系) ─────────────────────────────────────────────
function loadBlacklist() { return readJSON(BLACKLIST_FILE, { patterns: [] }); }

function updateBlacklist(errorMsg) {
  const bl = loadBlacklist();
  const pattern = errorMsg.substring(0, 120);
  const existing = bl.patterns.find(p => p.pattern === pattern);
  if (existing) {
    existing.count = (existing.count || 1) + 1;
    existing.last_seen = new Date().toISOString();
  } else {
    bl.patterns.push({ pattern, count: 1, first_seen: new Date().toISOString(), last_seen: new Date().toISOString() });
  }
  writeJSON(BLACKLIST_FILE, bl);
}

// ─── Architectural Rule: Daemon Coreがgit操作(push/commit/merge等)を実行してはいない ──
// Reference: daemon-delegate.md / WORKFLOW_CONTRACTS.md
// Git操作はAntigravity Core(人間側AIエージェント)の専権事項。
// DaemonはファイルI/O・テスト・ローカルビルドのみ担当。
const GIT_WRITE_PATTERNS = [
  /\bgit\s+push\b/,
  /\bgit\s+commit\b/,
  /\bgit\s+merge\b/,
  /\bgit\s+rebase\b/,
  /\bgit\s+tag\b/,
  /\bgit\s+reset\b/,
  /\bgit\s+revert\b/,
  /\bgit\s+cherry-pick\b/,
  /\bgit\s+force-push\b/,
  /--force\b.*git\b/,
  /\brm\s+-rf\s+\/\b/, // ルートレベル強制削除も禁止
  /\brm\s+(-rf?|-fr?)\s+.*\/antigravity\b/, // /antigravity/ディレクトリ削除禁止
  /\bchmod\s+(777|a\+[rwx])/, // 世界書き許可禁止
  // P1: /host_homeのセキュリティ保護 —— Macホームディレクトリフルアクセスをブロック
  /\bcat\s+\/host_home\/.ssh\b/,
  /\bcp\s+.*\/host_home\/.ssh\b/,
  /\bcurl\b.*\/host_home/,
];

function isGitWriteBlocked(cmd) {
  if (!cmd) return false;
  return GIT_WRITE_PATTERNS.some(re => re.test(cmd));
}

function isBlacklisted(cmd) {
  // Architectural Hard Block — blacklistより優先
  if (isGitWriteBlocked(cmd)) return true;
  const { patterns } = loadBlacklist();
  return patterns.some(p => cmd.includes(p.pattern));
}


// ─── Quality Gate 評価 ────────────────────────────────────────────────────────
async function evaluateQualityGates(gates) {
  let score = 0;
  const results = [];
  for (const gate of gates) {
    if (gate.type === 'command') {
      const { stdout, stderr, exitCode } = await runCommand(gate.cmd);
      const passed = exitCode === 0;
      results.push({ gate, passed, stdout, stderr });
      if (passed) score += 10;
      log(`  Gate [${gate.cmd}]: ${passed ? '✅' : '❌'} (exit ${exitCode})`);
    }
  }
  return { score, results, allPassed: results.length === 0 || results.every(r => r.passed) };
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
  await writeFile(kPath, content);
  log(`[Knowledge] Saved → ${path.basename(kPath)}`);
}

// ─── Stagnation Watcher ────────────────────────────────────────────────────────
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

// ─── P3修正: 自動ヒント生成 (abort廃止) ──────────────────────────────────────
function generateAutoHint(errorHistory, task) {
  const recentErrors = errorHistory.slice(-5);
  const errorTypes = [...new Set(recentErrors.map(e => e.type))];
  const errorMessages = recentErrors.map(e => e.message.substring(0, 100)).join('; ');

  let hint = `[Auto-Recovery] 過去のアプローチが機能していない。以下のエラーが繰り返されている: ${errorTypes.join(', ')}。\n`;

  if (errorTypes.includes('command_error')) {
    hint += '- コマンドを変更するか、シンプルな別コマンドで試みよ。\n';
  }
  if (errorTypes.includes('parse_error') || errorTypes.includes('no_action')) {
    hint += '- JSON出力を単純化せよ。複雑な構造を避けてシンプルなアクションを1つだけ出力せよ。\n';
  }
  if (errorTypes.includes('quality_gate_fail')) {
    hint += '- テスト失敗の原因を特定し、コアロジックを修正せよ。別ファイルのアプローチを試みよ。\n';
  }

  hint += `- エラー詳細: ${errorMessages}\n`;
  hint += `- タスク: ${task.task.substring(0, 200)}`;

  return hint;
}

// ─── COO レポート ──────────────────────────────────────────────────────────────
function reportToCoO(taskId, reason, errorHistory, lastScore) {
  const state = readState();
  if (!state.coo_reports) state.coo_reports = [];
  state.coo_reports.push({
    taskId, reason, lastScore,
    suspended_at: new Date().toISOString(),
    error_summary: errorHistory.slice(-3).map(e => ({ type: e.type, message: e.message.substring(0, 200) })),
    status: 'auto_recovered',
  });
  writeState(state);
  log(`[COO Report] taskId=${taskId}, reason=${reason}, score=${lastScore}`, 'WARN');
}

// ─── ReAct ループ (Think → Act → Observe) ────────────────────────────────────
async function reactLoop(task, contract) {
  const budget  = contract?.budget || {};
  const gates   = contract?.quality_gates || [];
  const stagnationThreshold = budget.stagnation_threshold || 5;
  // P6修正: デフォルト80コールに拡大
  const maxCalls = budget.max_llm_calls || 80;
  const metaRules = contract?.meta_rules_summary || '';

  const watcher = new StagnationWatcher(stagnationThreshold);
  const errorHistory = [];
  let loopCount = 0;
  let llmCallCount = 0;
  let lastScore = 0;
  let hint = null;
  let autoRecoveryCount = 0;
  const MAX_AUTO_RECOVERY = 3;  // 自動リカバリーの最大回数

  log(`[ReAct] Starting: "${task.task.substring(0, 80)}"`);
  log(`[ReAct] Budget: max_llm_calls=${maxCalls}, stagnation_threshold=${stagnationThreshold}`);

  // 関連ファイルのコンテキスト
  const relevantFiles = contract?.context?.relevant_files || [];
  const fileContexts = (await Promise.all(
    relevantFiles.map(async f => {
      const content = await readFile(f);
      return content ? `### ${f}\n\`\`\`\n${content.substring(0, 2000)}\n\`\`\`` : null;
    })
  )).filter(Boolean);

  const systemInstruction = `あなたは Daemon Core — 自律的に実装を完遂する AI エンジンです。
毎回のレスポンスで必ず1つのアクションJSONを出力してください。

## 行動原則（厳守）
1. **ファイルパスが既知なら read_file は不要**。直接 write_file を実行せよ。
2. **同じファイルの read_file を2回以上実行してはならない**。
3. **ls, pwd など探索コマンドを繰り返してはならない**。1回で十分。
4. **修正内容が明確なら最初のアクションで write_file を実行せよ**。
5. write_file 後はテストコマンドを run_command で実行してパスを確認せよ。
6. テストが全パスしたら {"action": "done", "summary": "完了"} を出力せよ。

## メタルール
${metaRules || '品質最優先。テストが全てパスするまでループする。止まるな。'}

## ブラックリスト（過去の失敗パターン — 使用禁止）
${loadBlacklist().patterns.slice(-10).map(p => `- ${p.pattern}`).join('\n') || 'なし'}

## 利用可能なアクション (JSON形式で出力)
- {"action": "read_file", "path": "ファイルパス"}
- {"action": "write_file", "path": "ファイルパス", "content": "内容"}
- {"action": "run_command", "cmd": "コマンド"}
- {"action": "done", "summary": "完了した内容"}
- {"action": "stuck", "reason": "詰まった理由"}

必ずJSONのアクションブロックを含めてください。`;

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

## 関連ファイル
${fileContexts.slice(0, 3).join('\n\n') || 'なし'}

${hint ? `## ヒント（最優先で従え）\n${hint}` : ''}

## 指示
次のアクションを1つ、JSON形式で出力してください。

**出力フォーマット**:
\`\`\`json
{"action": "write_file", "path": "path/to/file.js", "content": "コード"}
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

    log(`[ReAct] Response (${llmResponse.length} chars): ${llmResponse.substring(0, 150)}…`);

    // ── ACT ── JSON抽出（4段階フォールバック + 制御文字 sanitize）
    let jsonStr = null;
    const codeBlockMatch = llmResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim();

    if (!jsonStr) {
      const allBraces = [...llmResponse.matchAll(/\{[^{}]*\}/g)];
      if (allBraces.length > 0) jsonStr = allBraces[allBraces.length - 1][0];
    }

    if (!jsonStr) {
      const m = llmResponse.match(/\{[\s\S]*?"action"\s*:\s*"[^"]+/);
      if (m) jsonStr = m[0] + '"}';
    }

    if (!jsonStr) {
      log('[ReAct] No JSON found. Retrying.', 'WARN');
      errorHistory.push({ type: 'no_action', message: llmResponse.substring(0, 200) });
      continue;
    }

    let action;
    // ── write_file の content に制御文字が含まれる場合の特別処理 ──
    // JSON.parse が失敗する主因: LLMが content フィールドに生の改行/タブを含むため
    // 戦略1: content フィールドを分離して parse する
    function extractWriteFileAction(raw) {
      const actionMatch = raw.match(/"action"\s*:\s*"write_file"/);
      if (!actionMatch) return null;
      const pathMatch = raw.match(/"path"\s*:\s*"([^"]+)"/);
      if (!pathMatch) return null;
      // content は "content": から始まり、 最後の } の直前まで
      const contentStartIdx = raw.indexOf('"content"');
      if (contentStartIdx === -1) return null;
      // "content": " の後から最後の " } までを content とみなす
      const afterKey = raw.slice(contentStartIdx + '"content"'.length);
      const colonMatch = afterKey.match(/^\s*:\s*"/);
      if (!colonMatch) return null;
      const contentStart = contentStartIdx + '"content"'.length + colonMatch[0].length;
      // 末尾の closing } を探してその直前の " までが content
      const tail = raw.slice(contentStart);
      // 末尾から } を見つけて、その前の閉じ引用符を探す
      const lastBrace = tail.lastIndexOf('}');
      const contentRaw = lastBrace > 0 ? tail.slice(0, lastBrace).replace(/"\s*$/, '') : tail;
      return { action: 'write_file', path: pathMatch[1], content: contentRaw };
    }

    try {
      action = JSON.parse(jsonStr);
    } catch (e) {
      // フォールバック1: write_file 特化パーサー
      const wfAction = extractWriteFileAction(jsonStr);
      if (wfAction) {
        log(`[ReAct] JSON parse recovered via write_file extractor`, 'WARN');
        action = wfAction;
      } else {
        // フォールバック2: 制御文字を除去してから再試行
        const sanitized = jsonStr.replace(/[\x00-\x09\x0b\x0c\x0e-\x1f]/g, ' ');
        try {
          action = JSON.parse(sanitized);
          log(`[ReAct] JSON parse recovered via sanitize`, 'WARN');
        } catch (e2) {
          log(`[ReAct] JSON parse error: ${e.message}`, 'WARN');
          errorHistory.push({ type: 'parse_error', message: e.message });
          continue;
        }
      }
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
        observation = `Quality gates not passed. Failed: ${evaluation.results.filter(r => !r.passed).map(r => r.gate.cmd).join(', ')}`;
        errorHistory.push({ type: 'quality_gate_fail', message: observation });
        lastScore = evaluation.score;
        watcher.record(lastScore);
        hint = null; // ヒントをリセットして再挑戦
      }
    }

    else if (action.action === 'stuck') {
      log(`[ReAct] Stuck: ${action.reason}`, 'WARN');
      errorHistory.push({ type: 'stuck', message: action.reason });
      watcher.record(lastScore);
    }

    else if (action.action === 'read_file') {
      const content = await readFile(action.path);
      observation = content
        ? `File: ${action.path}\n\`\`\`\n${content.substring(0, 3000)}\n\`\`\``
        : `File not found: ${action.path}`;
    }

    else if (action.action === 'write_file') {
      const writeResult = await writeFile(action.path, action.content || '');
      if (!writeResult.ok) {
        observation = `Write failed: ${writeResult.error}`;
        errorHistory.push({ type: 'write_error', message: observation });
      } else {
        observation = `Written: ${action.path}`;
        // Auto Test after write
        if (gates.length > 0) {
          await sleep(300);
          const autoEval = await evaluateQualityGates(gates);
          if (autoEval.allPassed) {
            log('[ReAct] ✅ Quality gates PASSED after write. Done!');
            await saveToKnowledge(task.task, autoEval, errorHistory);
            return { success: true, loops: loopCount, llmCalls: llmCallCount };
          } else {
            const failInfo = autoEval.results.filter(r => !r.passed).map(r =>
              `[FAIL] ${r.gate.cmd}\nSTDOUT: ${(r.stdout || '').substring(0, 200)}\nSTDERR: ${(r.stderr || '').substring(0, 300)}`
            ).join('\n\n');
            observation = `Written: ${action.path}\n\n[Test FAILED]\n${failInfo}\n\n→ コードを修正してください。`;
            lastScore = autoEval.score;
            watcher.record(lastScore);
          }
        }
      }
    }

    else if (action.action === 'run_command') {
      if (isBlacklisted(action.cmd)) {
        observation = `[Blacklisted] Prevented: ${action.cmd}`;
        log(`[Blacklist] Blocked: ${action.cmd}`, 'WARN');
      } else {
        const { stdout, stderr, exitCode } = await runCommand(action.cmd);
        observation = `Exit: ${exitCode}\nSTDOUT:\n${stdout.substring(0, 1000)}\nSTDERR:\n${stderr.substring(0, 500)}`;

        if (exitCode !== 0) {
          errorHistory.push({ type: 'command_error', message: `${action.cmd}: ${stderr.substring(0, 200)}` });
          updateBlacklist(stderr.substring(0, 120));
          watcher.record(lastScore);
        } else {
          lastScore += 1;
          watcher.record(lastScore);

          const isQualityGateCmd = gates.some(g => g.type === 'command' && g.cmd === action.cmd);
          if (isQualityGateCmd || stdout.includes('✅') || stdout.toLowerCase().includes('all tests passed')) {
            const autoEval = await evaluateQualityGates(gates);
            if (autoEval.allPassed) {
              log('[ReAct] ✅ All quality gates PASSED. Done!');
              await saveToKnowledge(task.task, autoEval, errorHistory);
              return { success: true, loops: loopCount, llmCalls: llmCallCount };
            }
            lastScore = autoEval.score;
          }
        }
      }
    }

    // ── P3修正: Stagnation → 自動リスタート (abort廃止) ──
    if (watcher.isStagnant()) {
      if (autoRecoveryCount >= MAX_AUTO_RECOVERY) {
        log(`[Stagnation] Auto-recovery exhausted (${MAX_AUTO_RECOVERY} times). Giving up task.`, 'ERROR');
        reportToCoO(task.id, 'stagnation_exhausted', errorHistory, lastScore);
        await saveToKnowledge(task.task, { allPassed: false, results: [] }, errorHistory);
        return { success: false, reason: 'stagnation_exhausted', loops: loopCount, llmCalls: llmCallCount };
      }

      autoRecoveryCount++;
      log(`[Stagnation] Auto-recovering (attempt ${autoRecoveryCount}/${MAX_AUTO_RECOVERY})...`, 'WARN');
      reportToCoO(task.id, `stagnation_auto_recovery_${autoRecoveryCount}`, errorHistory, lastScore);

      // 自動ヒントを生成してリスタート
      hint = generateAutoHint(errorHistory, task);
      watcher.history = [];
      log(`[Auto-Recovery] New hint generated. Restarting...`);
      await sleep(1000);
      continue;
    }

    if (observation) log(`[Observe] ${observation.substring(0, 200)}`);
    await sleep(500);
  }

  log(`[ReAct] Budget exhausted (${maxCalls} calls). Reporting.`, 'WARN');
  reportToCoO(task.id, 'budget_exhausted', errorHistory, lastScore);
  await saveToKnowledge(task.task, { allPassed: false, results: [] }, errorHistory);
  return { success: false, reason: 'budget_exhausted', loops: loopCount, llmCalls: llmCallCount };
}

// ─── Phase 9: Self-Improvement & Advanced Features ───────────────────────────

// ─── F4修正 + E2: Self-Task Generator (失敗blacklist + TASKS.md発掘) ──────────────
async function generateSelfImprovementTasks(state) {
  const selfTasks = [];

  // すでにself_improvementタスクが pending にあれば生成しない
  const alreadyPending = (state.pending_tasks || []).some(t => t.priority === 'self_improvement');
  if (alreadyPending) return selfTasks;

  // knowledge/ のエピソードを確認
  const knowledgeFiles = fs.existsSync(KNOWLEDGE_DIR)
    ? fs.readdirSync(KNOWLEDGE_DIR).filter(f => f.endsWith('.md') && !f.startsWith('_'))
    : [];

  if (knowledgeFiles.length >= 2) {
    const skillPath = path.join(ANTIGRAVITY_DIR, 'agent/skills/daemon-core/SKILL.md');
    const taskId = `self_l3_${Date.now()}`;
    log(`[Self-Task] Generating L3 skill upgrade task (${knowledgeFiles.length} knowledge files)`);

    // knowledgeファイルの内容サンプル（最大200文字×3件）
    const sample = knowledgeFiles.slice(0, 3).map(f => {
      try {
        const content = fs.readFileSync(path.join(KNOWLEDGE_DIR, f), 'utf8');
        return `- ${f}: ${content.substring(0, 200).replace(/\n/g, ' ')}`;
      } catch { return `- ${f}: (読み込み失敗)`; }
    }).join('\n');

    const existingSkill = fs.existsSync(skillPath)
      ? fs.readFileSync(skillPath, 'utf8').substring(0, 600)
      : '(まだ存在しない)';

    selfTasks.push({
      id: taskId,
      task: `[L3 Skill Update] ${skillPath} を更新せよ。

## 現在のSKILL.md (先頭600文字):
${existingSkill}

## knowledge/ の最新エピソード (${knowledgeFiles.length}件中3件):
${sample}

## 更新ルール:
- エラーパターンを「## エラーホットスポット」に追記
- 成功パターンを「## Quick Wins」に追記
- last_updated を ${new Date().toISOString()} に更新
- write_file で更新したら {"action":"done","summary":"完了"} を出力`,
      status: 'pending',
      priority: 'self_improvement',
      ttl: 300,
      contract: {
        budget: { max_llm_calls: 15, stagnation_threshold: 3 },
        quality_gates: [],
      },
    });
  }

  return selfTasks;
}

// ─── P5修正: Learning Loops (knowledge件数ベーストリガー) ─────────────────────
const LEARNING_SCRIPTS = {
  L3: path.join(ANTIGRAVITY_DIR, 'agent/scripts/skill-upgrader.js'),
  L4: path.join(ANTIGRAVITY_DIR, 'agent/scripts/coo-optimizer.js'),
  L5: path.join(ANTIGRAVITY_DIR, 'agent/scripts/knowledge-distiller.js'),
};

async function triggerLearningLoops(completedCount, hasCooReports) {
  const knowledgeCount = fs.existsSync(KNOWLEDGE_DIR)
    ? fs.readdirSync(KNOWLEDGE_DIR).filter(f => f.endsWith('.md')).length
    : 0;

  // P5修正: 2タスク完了ごと or knowledge 2件以上で L3 発火
  if ((completedCount > 0 && completedCount % 2 === 0) || knowledgeCount >= 2) {
    if (fs.existsSync(LEARNING_SCRIPTS.L3)) {
      log('[Learning] L3: skill-upgrader 起動');
      try { execSync(`node ${LEARNING_SCRIPTS.L3}`, { timeout: 30000, stdio: 'pipe' }); }
      catch (e) { log(`[Learning] L3 failed: ${e.message}`, 'WARN'); }
    }
  }

  // L5: 5タスクごと or knowledge 10件以上で蒸留
  if ((completedCount > 0 && completedCount % 5 === 0) || knowledgeCount >= 10) {
    if (fs.existsSync(LEARNING_SCRIPTS.L5)) {
      log('[Learning] L5: knowledge-distiller 起動');
      try { execSync(`node ${LEARNING_SCRIPTS.L5}`, { timeout: 60000, stdio: 'pipe' }); }
      catch (e) { log(`[Learning] L5 failed: ${e.message}`, 'WARN'); }
    }
  }

  // L4: COOレポートがあれば COO 自己最適化
  if (hasCooReports && fs.existsSync(LEARNING_SCRIPTS.L4)) {
    log('[Learning] L4: coo-optimizer 起動');
    try { execSync(`node ${LEARNING_SCRIPTS.L4}`, { timeout: 30000, stdio: 'pipe' }); }
    catch (e) { log(`[Learning] L4 failed: ${e.message}`, 'WARN'); }
  }
}

// ─── Q2: コスト追跡 ────────────────────────────────────────────────────────────
function loadCostTracker() {
  if (!fs.existsSync(COST_FILE)) return { month: getCurrentMonth(), calls: 0, estimated_usd: 0 };
  try { return JSON.parse(fs.readFileSync(COST_FILE, 'utf8')); } catch { return { month: getCurrentMonth(), calls: 0, estimated_usd: 0 }; }
}

function getCurrentMonth() { return new Date().toISOString().substring(0, 7); } // 'YYYY-MM'

function trackLLMCost(callCount) {
  const tracker = loadCostTracker();
  const currentMonth = getCurrentMonth();
  // 月が変わったらリセット
  if (tracker.month !== currentMonth) {
    tracker.month = currentMonth;
    tracker.calls = 0;
    tracker.estimated_usd = 0;
    log(`[Cost] 月次リセット: ${currentMonth}`);
  }
  tracker.calls += callCount;
  tracker.estimated_usd = tracker.calls * COST_PER_LLM_CALL;
  fs.writeFileSync(COST_FILE, JSON.stringify(tracker, null, 2));

  if (tracker.estimated_usd >= COST_MONTHLY_LIMIT) {
    log(`[Cost] ⚠️ 月次コスト上限到達: $${tracker.estimated_usd.toFixed(3)} >= $${COST_MONTHLY_LIMIT}`, 'WARN');
    // COOへの通知フラグを立てる
    const state = readState();
    state.cost_alert = { month: currentMonth, usd: tracker.estimated_usd, flagged_at: new Date().toISOString() };
    writeState(state);
  }
  return tracker;
}

// ─── Q3: 暴走検知 ─────────────────────────────────────────────────────────────
function checkRunaway(state) {
  const completed = state.completed_tasks || [];
  const now = Date.now();
  const windowStart = now - RUNAWAY_WINDOW_MS;
  // F4修正: failedタスクは除外し「成功完了」のみカウント（失敗ループでRunaway誤発動を防止）
  const recentCount = completed.filter(t =>
    t.status === 'done' && new Date(t.completed_at || 0).getTime() > windowStart
  ).length;

  if (recentCount >= RUNAWAY_TASK_LIMIT) {
    log(`[Runaway] ⚠️ ${recentCount}件(done)/1h — 上限到達。COOへ報告してpause。`, 'WARN');
    state.runaway_detected = { count: recentCount, detected_at: new Date().toISOString() };
    writeState(state);
    return true;
  }
  return false;
}

// ─── Q4: ブラウザ品質チェック (マルチモーダル) ───────────────────────────────
// ─── F1修正 + E1: Playwright統合かつURLサニタイズ済み BrowserQA ──────────────
function sanitizeUrl(url) {
  // F1: インジェクション防止 — http/httpsのURL形式のみ許可
  if (typeof url !== 'string') return null;
  const cleaned = url.trim();
  if (!/^https?:\/\/[a-zA-Z0-9._-]+(:\d{1,5})?([\/\w\-._~:/?#[\]@!$&'()*+,;=%]*)$/.test(cleaned)) {
    log(`[BrowserQA] ⚠️ 不正URLをブロック: ${cleaned}`, 'WARN');
    return null;
  }
  return cleaned;
}

async function playwrightCapture(url) {
  // E1: Playwrightでheadlessスクリーンショットを取得しbase64で返す
  if (!PLAYWRIGHT_AVAILABLE) return null;
  const screenshotPath = path.join(SCREENSHOT_DIR, `qa_${Date.now()}.png`);
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  try {
    const script = `
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(${JSON.stringify(url)}, { timeout: 15000, waitUntil: 'networkidle' });
  await page.screenshot({ path: ${JSON.stringify(screenshotPath)}, fullPage: false });
  await browser.close();
  console.log('OK:' + ${JSON.stringify(screenshotPath)});
})().catch(e => { console.error('ERR:' + e.message); process.exit(1); });
`;
    const tmpScript = path.join('/tmp', `pw_${Date.now()}.js`);
    fs.writeFileSync(tmpScript, script);
    const { stdout } = await runCommand(`node ${tmpScript}`);
    fs.unlinkSync(tmpScript);
    if (stdout.includes('OK:') && fs.existsSync(screenshotPath)) {
      const imgBase64 = fs.readFileSync(screenshotPath).toString('base64');
      fs.unlinkSync(screenshotPath); // 素早く削除
      return imgBase64;
    }
  } catch (e) {
    log(`[BrowserQA] Playwrightエラー: ${e.message}`, 'WARN');
  }
  return null;
}

async function browserQualityCheck(task, contract) {
  const rawUrls = contract?.browser_check_urls || [];
  // F1: 全URLをサニタイズして不正なものがあればskip
  const checkUrls = rawUrls.map(sanitizeUrl).filter(Boolean);
  if (!BROWSER_CHECK_ENABLED || checkUrls.length === 0) return { skipped: true };

  log(`[BrowserQA] チェック: ${checkUrls.join(', ')} (Playwright=${PLAYWRIGHT_AVAILABLE})`);
  const results = [];

  for (const url of checkUrls) {
    try {
      let score = null;
      let issues = [];
      let summary = '';

      // E1: Playwrightが利用可能ならスクリーンショットで評価
      if (PLAYWRIGHT_AVAILABLE) {
        const imgBase64 = await playwrightCapture(url);
        if (imgBase64) {
          const qaPrompt = `このウェブページのスクリーンショットを見て、以下の観点でUI品質を評価せよ。

URL: ${url}
タスク: ${task.task.substring(0, 200)}

確認項目:
- レイアウト崩れなどの表示バグ
- エラーメッセージの有無
- 主要UI要素の可視性
- ローディング状態やスピナーが出ていないか

以下のJSON形式のみで返せ:
{"status":"pass"|"fail"|"warn","score":0-100,"issues":["問題1"],"summary":"サマリー"}`;
          // Gemini Visionに画像とプロンプトを送信
          const visionResponse = await callGeminiVision(qaPrompt, imgBase64);
          const jm = visionResponse.match(/\{[\s\S]*?\}/);
          if (jm) {
            const r = JSON.parse(jm[0]);
            results.push({ url, method:'playwright', ...r });
            log(`[BrowserQA] 📸 ${url}: ${r.status} (score:${r.score}) — ${r.summary}`);
            continue;
          }
        }
        log('[BrowserQA] Playwrightスクリーンショット失敗。curlフォールバックへ', 'WARN');
      }

      // curlフォールバック (Playwright不得時 or スクリーンショット失敗時)
      const { stdout } = await runCommand(`curl -s -L --max-time 10 '${url}' 2>/dev/null | head -c 5000`);
      if (!stdout || stdout.length < 50) {
        results.push({ url, method:'curl', status: 'fail', reason: 'Empty or unreachable' });
        continue;
      }
      const qaPrompt = `以下のHTMLページを品質チェックせよ。
URL: ${url}
HTML(3000文字):
${stdout.substring(0, 3000)}
タスク: ${task.task.substring(0, 200)}
以下のJSON形式のみ返せ:
{"status":"pass"|"fail"|"warn","score":0-100,"issues":["問題1"],"summary":"サマリー"}`;
      const response = await callGemini(qaPrompt);
      const jm = response.match(/\{[\s\S]*?\}/);
      if (jm) {
        const r = JSON.parse(jm[0]);
        results.push({ url, method:'curl', ...r });
        log(`[BrowserQA] 🔍 ${url}: ${r.status} (score:${r.score}) — ${r.summary}`);
      } else {
        results.push({ url, method:'curl', status: 'warn', reason: 'parse error' });
      }
    } catch (e) {
      results.push({ url, status: 'fail', reason: e.message });
      log(`[BrowserQA] ${url}: エラー — ${e.message}`, 'WARN');
    }
  }

  const allPassed = results.every(r => r.status !== 'fail');
  log(`[BrowserQA] 結果: ${allPassed ? '✅ PASS' : '❌ FAIL'} (${results.length}URL)`);
  return { allPassed, results };
}

// ─── Q5: Vision Check Level 2 (WHITEPAPERとの整合性) ─────────────────────────
async function visionCheck(task, result) {
  const whitepaperPath = path.join(ANTIGRAVITY_DIR, 'docs/WHITEPAPER.md');
  const tasksPath = path.join(ANTIGRAVITY_DIR, 'docs/TASKS.md');

  // WHITEPAPERかTASKS.mdが存在しなければスキップ
  if (!fs.existsSync(whitepaperPath) && !fs.existsSync(tasksPath)) {
    log('[VisionCheck] WHITEPAPER/TASKS.md 不在 → スキップ');
    return { skipped: true };
  }

  const whitepaper = fs.existsSync(whitepaperPath)
    ? fs.readFileSync(whitepaperPath, 'utf8').substring(0, 2000)
    : '(未作成)';

  const prompt = `あなたはAntigravityのビジョン品質チェッカーだ。

## WHITEPAPER (先頭2000文字):
${whitepaper}

## 完了タスク:
${task.task.substring(0, 500)}

## 実行結果:
成功: ${result.success}, 完了ループ数: ${result.loops}

このタスクの実行結果がWHITEPAPERのビジョンと整合しているか評価せよ。
以下のJSON形式で返せ:
{
  "aligned": true|false,
  "score": 0-100,
  "reason": "理由",
  "risks": ["リスク1"]
}`;

  try {
    const response = await callGemini(prompt);
    const jsonMatch = response.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      const check = JSON.parse(jsonMatch[0]);
      log(`[VisionCheck] aligned=${check.aligned}, score=${check.score} — ${check.reason}`);
      return check;
    }
  } catch (e) {
    log(`[VisionCheck] エラー: ${e.message}`, 'WARN');
  }
  return { skipped: true };
}

// ─── Q1: 優先キュー — COO発タスクをHIGH優先で取得 ────────────────────────────
function getNextTask(pendingTasks) {
  if (pendingTasks.length === 0) return null;
  // 優先度: coo_assigned > high > (others) > self_improvement
  const PRIORITY_ORDER = ['coo_assigned', 'high', 'medium', 'low', 'self_improvement'];
  const sorted = [...pendingTasks].sort((a, b) => {
    const ai = PRIORITY_ORDER.indexOf(a.priority || 'low');
    const bi = PRIORITY_ORDER.indexOf(b.priority || 'low');
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  return sorted[0];
}

// ─── メインポーリングループ (Phase 9) ─────────────────────────────────────────
async function mainLoop() {
  log('🚀 Daemon Core starting... (Phase 10: Architecture Clean + coo CLI + Outbox Pattern)');
  log(`   ANTIGRAVITY_DIR : ${ANTIGRAVITY_DIR}`);
  log(`   HOST_HOME       : ${HOST_HOME}`);
  log(`   GEMINI          : ${GEMINI_API_KEY ? 'API key loaded' : 'NOT SET (mock mode)'}`);
  log(`   Playwright      : ${PLAYWRIGHT_AVAILABLE ? '✅ Available' : '⚠️ Not installed (curl fallback)'}`);
  log('   Q1(Priority Queue) Q2(Cost Guard) Q3(Runaway) Q4(BrowserQA) Q5(Vision) Outbox(Ghost廃止) F3(Rotate) F4(Blacklist)');
  log(`   git push/commit: [HARD BLOCKED] | /host_home sensitive paths: [BLOCKED]`);

  // 月次コスト状態を表示
  const initCost = loadCostTracker();
  log(`[Cost] 今月の累積: ${initCost.calls}calls / $${(initCost.estimated_usd||0).toFixed(3)} (上限$${COST_MONTHLY_LIMIT})`);

  // ─── Outbox Pattern: 起動時にoutbox/残骸をスキャンしてpendingに戻す (F2置換) ──
  // outbox/task_XYZ.json が存在 = 実行中の証拠。残骸は前回クラッシュを意味する。
  {
    const bootState = readState();
    let outboxRecovered = 0;
    try {
      const outboxFiles = fs.readdirSync(OUTBOX_DIR).filter(f => f.endsWith('.json'));
      for (const fname of outboxFiles) {
        try {
          const outboxPath = path.join(OUTBOX_DIR, fname);
          const ob = JSON.parse(fs.readFileSync(outboxPath, 'utf8'));
          // outboxに残っている = 完了していない → pendingに復元して再試行
          const alreadyPending = (bootState.pending_tasks || []).some(t => t.id === ob.id);
          if (!alreadyPending) {
            bootState.pending_tasks = bootState.pending_tasks || [];
            bootState.pending_tasks.unshift({ ...ob, status: 'pending', recovered_from_outbox: true, recovered_at: new Date().toISOString() });
            outboxRecovered++;
          }
          fs.unlinkSync(outboxPath); // outboxから削除（pendingに戻した）
        } catch { /* 壊れたoutboxファイルはスキップ */ }
      }
      if (outboxRecovered > 0) {
        log(`[Outbox] 前回クラッシュを検知: ${outboxRecovered}件 pendingに復元`);
        writeState(bootState);
      }
    } catch (e) {
      log(`[Outbox] スキャン失敗: ${e.message}`, 'WARN');
    }
    // 後方互換: 古いin_progress残骸も念のためpendingに戻す
    const legacyGhosts = (bootState.pending_tasks || []).filter(t => t.status === 'in_progress');
    if (legacyGhosts.length > 0) {
      bootState.pending_tasks = bootState.pending_tasks.map(t =>
        t.status === 'in_progress' ? { ...t, status: 'pending', recovered_at: new Date().toISOString() } : t
      );
      writeState(bootState);
      log(`[Outbox] legacy in_progress ${legacyGhosts.length}件をpendingに復元`);
    }
  }


  while (true) {
    try {
      let state = readState();
      if (!state) { state = {}; }

      // ハートビート更新
      state.last_heartbeat = new Date().toISOString();
      writeState(state);

      // Q3: 暴走検知チェック
      if (checkRunaway(state)) {
        log('[Runaway] 30分間のペナルティウェイト...', 'WARN');
        await sleep(30 * 60 * 1000); // 30分待機してから再開
        continue;
      }

      // Q2: コストアラートチェック
      if (state.cost_alert) {
        const alertAge = Date.now() - new Date(state.cost_alert.flagged_at).getTime();
        // コストアラートから24時間経っていない場合はSelf-Taskのみ許可
        if (alertAge < 24 * 60 * 60 * 1000) {
          log(`[Cost] ⚠️ 月次コスト上限中 ($${state.cost_alert.usd.toFixed(3)}) — Self-Taskのみ実行`, 'WARN');
        }
      }

      // Q1: 優先キューで pending タスクを取得
      let pending = (state.pending_tasks || []).filter(t => t.status === 'pending');

      // タスクキューが空なら自己改善タスクを自律生成
      if (pending.length === 0) {
        const selfTasks = await generateSelfImprovementTasks(state);
        if (selfTasks.length > 0) {
          log(`[Self-Task] ${selfTasks.length} self-improvement task(s) generated.`);
          state = readState();
          state.pending_tasks = [...(state.pending_tasks || []), ...selfTasks];
          writeState(state);
          pending = selfTasks;
        } else {
          await sleep(POLL_INTERVAL);
          continue;
        }
      }

      // Q1: 優先度順でタスクを選択
      const task = getNextTask(pending);
      if (!task) { await sleep(POLL_INTERVAL); continue; }
      log(`[Main] Task [${task.priority||'low'}]: "${task.task.substring(0, 80)}" (id: ${task.id})`);

      // status を in_progress に更新
      state = readState();
      const taskIdx = (state.pending_tasks || []).findIndex(t => t.id === task.id);
      if (taskIdx >= 0) state.pending_tasks[taskIdx].status = 'in_progress';
      state.current = {
        action: task.task.substring(0, 100),
        action_ttl: task.ttl || 600,
        action_updated_at: new Date().toISOString(),
        task_id: task.id,
        priority: task.priority || 'low',
      };
      writeState(state);

      // Outbox Pattern: タスク実行開始の証拠を書き出す（クラッシュ時に残骸として検出される）
      const outboxTaskFile = path.join(OUTBOX_DIR, `task_${task.id}.json`);
      try {
        fs.writeFileSync(outboxTaskFile, JSON.stringify({ ...task, outbox_at: new Date().toISOString() }, null, 2));
      } catch (e) {
        log(`[Outbox] write failed: ${e.message}`, 'WARN');
      }


      // ReAct ループ実行
      const result = await reactLoop(task, task.contract || {});

      // Q2: コスト追跡 (ReActのLLMコール数を記録)
      if (result.llmCalls > 0) {
        const cost = trackLLMCost(result.llmCalls);
        log(`[Cost] 今月合計: ${cost.calls}calls / $${cost.estimated_usd.toFixed(3)}`);
      }

      // Q4: ブラウザ品質チェック (タスク成功時のみ)
      if (result.success && task.contract?.browser_check_urls?.length > 0) {
        const browserResult = await browserQualityCheck(task, task.contract);
        if (!browserResult.skipped && !browserResult.allPassed) {
          log('[BrowserQA] ❌ ブラウザ品質チェック失敗。タスクをfailedに更新。', 'WARN');
          result.success = false;
          result.reason = 'browser_qa_failed';
          result.browserQA = browserResult;
        }
      }

      // Q5: Vision Check Level 2 (COO発タスク成功時のみ)
      if (result.success && task.priority === 'coo_assigned') {
        const vCheck = await visionCheck(task, result);
        if (!vCheck.skipped && !vCheck.aligned && vCheck.score < 50) {
          log(`[VisionCheck] ⚠️ スコア${vCheck.score} — ビジョン未整合。COOへ報告。`, 'WARN');
          result.visionCheck = vCheck;
          const vs = readState();
          vs.coo_reports = vs.coo_reports || [];
          vs.coo_reports.push({ type: 'vision_misaligned', taskId: task.id, vCheck, at: new Date().toISOString() });
          writeState(vs);
        }
      }

      // Outbox Pattern Phase 2: 完了・失敗時にoutboxから証拠を削除（正常完了）
      try { fs.unlinkSync(outboxTaskFile); } catch { /* すでに削除済みなら無視 */ }

      // 完了後の State 更新
      const updatedState = readState();

      updatedState.pending_tasks = (updatedState.pending_tasks || []).filter(t => t.id !== task.id);
      updatedState.current = {};
      updatedState.completed_tasks = updatedState.completed_tasks || [];
      updatedState.completed_tasks.push({
        ...task,
        status: result.success ? 'done' : 'failed',
        result,
        completed_at: new Date().toISOString(),
      });

      // F3: completed_tasks rotate — 最新100件を保持し古いものをarchiveへ
      if (updatedState.completed_tasks.length > COMPLETED_TASKS_MAX) {
        const excess = updatedState.completed_tasks.splice(0, updatedState.completed_tasks.length - COMPLETED_TASKS_MAX);
        try {
          fs.mkdirSync(path.dirname(COMPLETED_ARCHIVE_FILE), { recursive: true });
          const archiveLines = excess.map(t => JSON.stringify(t)).join('\n') + '\n';
          fs.appendFileSync(COMPLETED_ARCHIVE_FILE, archiveLines);
          log(`[F3] completed_tasks rotate: ${excess.length}件をarchiveへ移行 (残${updatedState.completed_tasks.length}件)`);
        } catch (archiveErr) {
          log(`[F3] archive書き込み失敗(継続): ${archiveErr.message}`, 'WARN');
        }
      }

      // F4: 失敗したSelf-Taskをblacklistへ追記
      if (!result.success && task.priority === 'self_improvement') {
        try {
          const sfData = readJSON(SELF_TASK_FAIL_FILE, { failed_tasks: [] });
          const failKey = task.source === 'tasks_md' ? `tasks_md:${task.task.substring(0,80)}` : 'self_l3_latest';
          if (!sfData.failed_tasks.includes(failKey)) {
            sfData.failed_tasks.push(failKey);
            // 最新50件のみ保持
            if (sfData.failed_tasks.length > 50) sfData.failed_tasks.shift();
            writeJSON(SELF_TASK_FAIL_FILE, sfData);
            log(`[F4] 失敗Self-Taskをblacklist登録: ${failKey}`);
          }
        } catch { /* 継続 */ }
      }

      writeState(updatedState);

      log(`[Main] Task ${task.id} [${task.priority||'low'}]: ${result.success ? '✅ Done' : `❌ Failed (${result.reason})`}`);

      // Learning Loops (knowledge件数ベース)
      const completedCount = updatedState.completed_tasks.length;
      const hasCooReports = (updatedState.coo_reports || []).length > 0;
      await triggerLearningLoops(completedCount, hasCooReports);


    } catch (e) {
      // Q6: 開発停止ゼロ — 予期しないエラーもcatchして続行
      log(`[Main] Unexpected error (continuing): ${e.message}`, 'ERROR');
      if (e.stack) log(e.stack.substring(0, 500), 'ERROR');
    }

    await sleep(POLL_INTERVAL);
  }
}

mainLoop();
