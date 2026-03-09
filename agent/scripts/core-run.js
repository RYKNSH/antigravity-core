#!/usr/bin/env node
/**
 * /core-run — Asynchronous Gateway CLI
 * 
 * Usage:
 *   node core-run.js "タスク説明" [--contract path/to/contract.json] [--ttl 600]
 *   # or via shebang: core-run "タスク説明"
 *
 * Pushes a task to pending_tasks in .session_state.json.
 * Daemon Core will pick it up on the next poll cycle.
 *
 * MS 5.1.4 — Asynchronous Gateway 実装
 */

const fs = require('fs');
const path = require('path');

const ANTIGRAVITY_DIR = process.env.ANTIGRAVITY_DIR || path.join(process.env.HOME, '.antigravity');
const STATE_FILE = path.join(ANTIGRAVITY_DIR, '.session_state.json');

// --- Parse args ---
const args = process.argv.slice(2);
if (args.length === 0 || args[0] === '--help') {
  console.log(`
Usage: core-run <task> [options]

Options:
  --contract <path>   Path to Smart Contract JSON (quality_gates, budget, etc.)
  --ttl <seconds>     Task TTL in seconds before Stagnation Watcher fires (default: 600)
  --workflow <name>   Workflow to use (default: /go)

Example:
  core-run "LP作成。Lighthouse 95点以上" --ttl 3600
  core-run "バグ修正: auth.ts" --contract ./contracts/fix-auth.json
`);
  process.exit(0);
}

// --- Parse named flags ---
let taskArg = null;
let contractPath = null;
let ttl = 600;
let workflow = '/go';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--contract') { contractPath = args[++i]; }
  else if (args[i] === '--ttl') { ttl = parseInt(args[++i], 10); }
  else if (args[i] === '--workflow') { workflow = args[++i]; }
  else if (!taskArg) { taskArg = args[i]; }
}

if (!taskArg) {
  console.error('[core-run] Error: タスク説明を指定してください。');
  process.exit(1);
}

// --- Load contract if specified ---
let contract = null;
if (contractPath) {
  const absPath = path.resolve(contractPath);
  if (!fs.existsSync(absPath)) {
    console.error(`[core-run] Contract file not found: ${absPath}`);
    process.exit(1);
  }
  try {
    contract = JSON.parse(fs.readFileSync(absPath, 'utf8'));
    console.log(`[core-run] Contract loaded: ${absPath}`);
  } catch (e) {
    console.error(`[core-run] Invalid JSON in contract: ${e.message}`);
    process.exit(1);
  }
}

// --- Build task object ---
const taskEntry = {
  id: `task_${Date.now()}`,
  task: taskArg,
  workflow,
  ttl,
  contract: contract || null,
  status: 'pending',
  pushed_at: new Date().toISOString(),
  pushed_by: 'COO',
};

// --- Read or initialize state ---
let state = {};
if (fs.existsSync(STATE_FILE)) {
  try {
    state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch (e) {
    console.warn('[core-run] State file parse error, initializing fresh state.');
    state = {};
  }
}
if (!state.pending_tasks) state.pending_tasks = [];
if (!state.current) state.current = {};

// --- Push task ---
state.pending_tasks.push(taskEntry);
fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

console.log(`✅ [core-run] Task pushed to Daemon Core queue`);
console.log(`   ID       : ${taskEntry.id}`);
console.log(`   Task     : ${taskEntry.task}`);
console.log(`   Workflow : ${taskEntry.workflow}`);
console.log(`   TTL      : ${taskEntry.ttl}s`);
console.log(`   Contract : ${contract ? 'attached' : 'none'}`);
console.log(`   Queue    : ${state.pending_tasks.length} task(s) pending`);
