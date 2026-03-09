#!/usr/bin/env node
/**
 * mcp-host-server.js — Mac 側 MCP Host Server
 *
 * Daemon Core (Docker コンテナ) からの HTTP リクエストを受け付け、
 * Mac 本体でのファイル操作・コマンド実行を代理する。
 *
 * Phase 6.1.2 実装
 *
 * Usage:
 *   node mcp-host-server.js [--port 7070]
 *   # または /daemon-dev セッション開始時に自動起動される
 *
 * エンドポイント: POST /mcp
 * Actions:
 *   - readFile: { action: 'readFile', path }
 *   - writeFile: { action: 'writeFile', path, content }
 *   - exec: { action: 'exec', cmd }
 *   - lighthouse: { action: 'lighthouse', url, minScore }
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync, exec } = require('child_process');
const os = require('os');

// 設定
const PORT = parseInt(process.argv.find(a => a.startsWith('--port='))?.split('=')[1] || process.env.MCP_PORT || '7070', 10);
const ALLOWED_DIRS = [
  os.homedir(),
  '/tmp',
];
const FORBIDDEN_CMDS = [
  /rm\s+-rf\s+\/(?!tmp)/,  // rm -rf / 系
  /mkfs/,
  /dd\s+if=/,
  /shutdown/,
  /reboot/,
];

function log(msg, level = 'INFO') {
  console.log(`[${new Date().toISOString()}] [MCP-HOST] [${level}] ${msg}`);
}

// セキュリティ: パスが許可された範囲内かチェック
function isPathAllowed(p) {
  const abs = path.resolve(p);
  return ALLOWED_DIRS.some(d => abs.startsWith(d));
}

// セキュリティ: 危険なコマンドでないかチェック
function isCmdSafe(cmd) {
  return !FORBIDDEN_CMDS.some(re => re.test(cmd));
}

// アクション: ファイル読み込み
function actionReadFile(payload) {
  const { path: filePath } = payload;
  if (!filePath) return { ok: false, error: 'path required' };
  if (!isPathAllowed(filePath)) return { ok: false, error: `Path not allowed: ${filePath}` };
  if (!fs.existsSync(filePath)) return { ok: false, error: `Not found: ${filePath}` };
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return { ok: true, content };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// アクション: ファイル書き込み
function actionWriteFile(payload) {
  const { path: filePath, content } = payload;
  if (!filePath) return { ok: false, error: 'path required' };
  if (!isPathAllowed(filePath)) return { ok: false, error: `Path not allowed: ${filePath}` };
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content || '');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// アクション: コマンド実行
function actionExec(payload) {
  const { cmd } = payload;
  if (!cmd) return { ok: false, error: 'cmd required' };
  if (!isCmdSafe(cmd)) return { ok: false, error: `Forbidden command: ${cmd}` };
  log(`EXEC: ${cmd}`);
  try {
    const stdout = execSync(cmd, { encoding: 'utf8', timeout: 60000, cwd: os.homedir() });
    return { ok: true, stdout, stderr: '', exitCode: 0 };
  } catch (e) {
    return { ok: true, stdout: e.stdout || '', stderr: e.stderr || e.message, exitCode: e.status || 1 };
  }
}

// アクション: Lighthouse 実行 (npx lighthouse)
async function actionLighthouse(payload) {
  const { url = 'http://localhost:3000', minScore = 90 } = payload;
  log(`LIGHTHOUSE: ${url} (min: ${minScore})`);
  try {
    const out = execSync(
      `npx lighthouse ${url} --output=json --output-path=stdout --quiet --chrome-flags="--headless --no-sandbox" 2>/dev/null`,
      { encoding: 'utf8', timeout: 120000 }
    );
    const report = JSON.parse(out);
    const score = Math.round(report.categories?.performance?.score * 100 || 0);
    return { ok: true, score, passed: score >= minScore };
  } catch (e) {
    return { ok: false, error: e.message, score: 0 };
  }
}

// HTTP サーバー
const server = http.createServer(async (req, res) => {
  if (req.method !== 'POST' || req.url !== '/mcp') {
    res.writeHead(404); res.end('Not Found'); return;
  }

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    let payload;
    try { payload = JSON.parse(body); } catch {
      res.writeHead(400); res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' })); return;
    }

    const { action } = payload;
    log(`Action: ${action}`);

    let result;
    try {
      if      (action === 'readFile')   result = actionReadFile(payload);
      else if (action === 'writeFile')  result = actionWriteFile(payload);
      else if (action === 'exec')       result = actionExec(payload);
      else if (action === 'lighthouse') result = await actionLighthouse(payload);
      else result = { ok: false, error: `Unknown action: ${action}` };
    } catch (e) {
      result = { ok: false, error: e.message };
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  });
});

server.listen(PORT, '0.0.0.0', () => {
  log(`MCP Host Server listening on port ${PORT}`);
  log(`Allowed directories: ${ALLOWED_DIRS.join(', ')}`);
  log('Ready to serve Daemon Core requests.');
});

process.on('SIGTERM', () => { log('SIGTERM received. Shutting down.'); server.close(); process.exit(0); });
process.on('SIGINT',  () => { log('SIGINT received. Shutting down.');  server.close(); process.exit(0); });
