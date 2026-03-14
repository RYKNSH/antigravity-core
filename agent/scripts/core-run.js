#!/usr/bin/env node
/**
 * core-run.js — Daemon Core CLI Gateway
 *
 * Usage:
 *   node core-run.js "タスク内容" [--priority high|normal|self_improvement] [--ttl 300]
 *   node core-run.js --status
 *   node core-run.js --list
 *   node core-run.js --clear-completed
 *
 * Description:
 *   .session_state.json の pending_tasks にタスクをPushする。
 *   Daemon CoreがPollして自律実行する。
 */

const fs   = require('fs');
const path = require('path');

const ANTIGRAVITY_DIR = process.env.ANTIGRAVITY_DIR || path.join(process.env.HOME, '.antigravity');
const STATE_FILE      = path.join(ANTIGRAVITY_DIR, '.session_state.json');

function readState() {
  if (!fs.existsSync(STATE_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return {}; }
}

function writeState(state) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function generateId() {
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── CLI引数解析 ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);

if (args.includes('--status')) {
  // Daemonの現在状態を表示
  const state = readState();
  const pending   = (state.pending_tasks || []).length;
  const completed = (state.completed_tasks || []).length;
  const current   = state.current;
  const cost      = state.cost_alert;

  console.log('\n🔵 Daemon Core Status');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Pending Tasks  : ${pending}`);
  console.log(`  Completed Tasks: ${completed}`);
  if (current) {
    console.log(`\n  Current Task (${current.status || 'unknown'}):`);
    console.log(`  ${String(current.task || '').substring(0, 100)}`);
    if (current.action_updated_at) {
      const ageMs = Date.now() - new Date(current.action_updated_at).getTime();
      console.log(`  Last Update: ${Math.round(ageMs / 1000)}s ago`);
    }
  }
  if (cost) {
    console.log(`\n  ⚠️  Cost Alert: $${cost.usd?.toFixed(3)} (${cost.month})`);
  }
  const cooReports = state.coo_reports || [];
  if (cooReports.length > 0) {
    console.log(`\n  COO Reports: ${cooReports.length} (latest: ${cooReports[cooReports.length-1]?.reason})`);
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  process.exit(0);
}

if (args.includes('--list')) {
  const state = readState();
  const pending = state.pending_tasks || [];
  console.log(`\n📋 Pending Tasks (${pending.length}):`);
  if (pending.length === 0) {
    console.log('  (なし)');
  } else {
    pending.forEach((t, i) => {
      const priority = t.priority ? `[${t.priority}]` : '[normal]';
      console.log(`  ${i + 1}. ${priority} ${String(t.task || t.id).substring(0, 80)}`);
    });
  }
  const completed = (state.completed_tasks || []).slice(-5);
  console.log(`\n✅ Recent Completed (last 5):`);
  if (completed.length === 0) {
    console.log('  (なし)');
  } else {
    completed.forEach(t => {
      const status = t.status === 'done' ? '✅' : '❌';
      console.log(`  ${status} ${String(t.task || t.id).substring(0, 70)}`);
    });
  }
  console.log('');
  process.exit(0);
}

if (args.includes('--clear-completed')) {
  const state = readState();
  const before = (state.completed_tasks || []).length;
  state.completed_tasks = [];
  writeState(state);
  console.log(`✅ Cleared ${before} completed tasks from state.`);
  process.exit(0);
}

// ─── タスクPush ───────────────────────────────────────────────────────────────
const taskText = args.find(a => !a.startsWith('--'));
if (!taskText) {
  console.error('Usage: node core-run.js "タスク内容" [--priority high] [--ttl 300]');
  console.error('       node core-run.js --status');
  console.error('       node core-run.js --list');
  process.exit(1);
}

// オプション解析
const priorityIdx = args.indexOf('--priority');
const priority = priorityIdx >= 0 ? args[priorityIdx + 1] : 'normal';

const ttlIdx = args.indexOf('--ttl');
const ttl = ttlIdx >= 0 ? parseInt(args[ttlIdx + 1]) : 300;

const contractIdx = args.indexOf('--contract');
let contract = null;
if (contractIdx >= 0) {
  try { contract = JSON.parse(args[contractIdx + 1]); } catch (e) {
    console.error('⚠️  --contract のJSON解析に失敗:', e.message);
  }
}

// デフォルトの品質ゲートなし（タスクに応じてcontractで指定）
const newTask = {
  id:       generateId(),
  task:     taskText,
  status:   'pending',
  priority: priority,
  ttl:      ttl,
  cwd:      process.cwd(),
  created_at: new Date().toISOString(),
  contract:   contract || {
    budget: { max_llm_calls: 30, stagnation_threshold: 5 },
    quality_gates: [],
  },
};


const state = readState();
if (!state.pending_tasks) state.pending_tasks = [];

// 優先度に応じて挿入位置を決定
if (priority === 'high') {
  // high は先頭に挿入（self_improvementより前）
  const firstNormal = state.pending_tasks.findIndex(t => t.priority !== 'high');
  if (firstNormal >= 0) {
    state.pending_tasks.splice(firstNormal, 0, newTask);
  } else {
    state.pending_tasks.unshift(newTask);
  }
} else {
  state.pending_tasks.push(newTask);
}

writeState(state);

console.log('\n✅ Task pushed to Daemon Core:');
console.log(`  ID      : ${newTask.id}`);
console.log(`  Priority: ${newTask.priority}`);
console.log(`  Task    : ${String(newTask.task).substring(0, 100)}`);
console.log(`  TTL     : ${newTask.ttl}s`);
console.log(`\n  Pending queue: ${state.pending_tasks.length} tasks`);
console.log('  Daemon will pick it up in the next poll cycle (~3s)\n');
