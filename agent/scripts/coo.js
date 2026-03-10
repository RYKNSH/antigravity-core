#!/usr/bin/env node
/**
 * coo — Antigravity Daemon Core CLI
 *
 * Usage:
 *   coo push "タスク説明" [--priority=coo_assigned|high|medium|low]
 *   coo status          — 現在の実行状態
 *   coo pending         — pending_tasks 一覧
 *   coo log [N=10]      — 完了タスク直近N件
 *   coo clear-runaway   — runaway_detected フラグをリセット
 *   coo daemon          — Daemon Coreのコンテナ状態確認
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ANTIGRAVITY_DIR = process.env.ANTIGRAVITY_DIR || path.join(process.env.HOME, '.antigravity');
const STATE_FILE = path.join(ANTIGRAVITY_DIR, '.session_state.json');

// ─── ANSI カラー ───────────────────────────────────────────
const c = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  cyan:   '\x1b[36m',
  blue:   '\x1b[34m',
  magenta:'\x1b[35m',
  gray:   '\x1b[90m',
};
const bold    = s => `${c.bold}${s}${c.reset}`;
const green   = s => `${c.green}${s}${c.reset}`;
const yellow  = s => `${c.yellow}${s}${c.reset}`;
const red     = s => `${c.red}${s}${c.reset}`;
const cyan    = s => `${c.cyan}${s}${c.reset}`;
const gray    = s => `${c.gray}${s}${c.reset}`;
const magenta = s => `${c.magenta}${s}${c.reset}`;

// ─── State I/O ─────────────────────────────────────────────
function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch (e) {
    return { pending_tasks: [], completed_tasks: [], current: {}, coo_reports: [] };
  }
}

function atomicWrite(data) {
  const tmp = STATE_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, STATE_FILE);
}

// ─── サブコマンド ────────────────────────────────────────────

function cmdPush(args) {
  const taskText = args.find(a => !a.startsWith('--'));
  if (!taskText) {
    console.error(red('❌ Usage: coo push "タスク説明" [--priority=high]'));
    process.exit(1);
  }

  const priorityArg = args.find(a => a.startsWith('--priority='));
  const priority = priorityArg ? priorityArg.split('=')[1] : 'coo_assigned';

  const VALID_PRIORITIES = ['coo_assigned', 'high', 'medium', 'low', 'self_improvement'];
  if (!VALID_PRIORITIES.includes(priority)) {
    console.error(red(`❌ Invalid priority: ${priority}. Valid: ${VALID_PRIORITIES.join(', ')}`));
    process.exit(1);
  }

  const state = readState();
  state.pending_tasks = state.pending_tasks || [];

  const task = {
    id: `coo_cli_${Date.now()}`,
    task: taskText,
    priority,
    status: 'pending',
    source: 'coo-cli',
    created_at: new Date().toISOString(),
  };

  state.pending_tasks.unshift(task); // 先頭に追加（優先）
  atomicWrite(state);

  console.log(green('✅ タスク投入完了'));
  console.log(`   ${bold('ID')}:       ${gray(task.id)}`);
  console.log(`   ${bold('Priority')}: ${magenta(priority)}`);
  console.log(`   ${bold('Task')}:     ${taskText}`);
  console.log(`   ${bold('Queue')}:    ${state.pending_tasks.length}件 pending`);
}

function cmdStatus() {
  const state = readState();
  const cur = state.current || {};

  console.log(bold(cyan('\n🤖 Daemon Core Status')));
  console.log('─'.repeat(50));

  // コンテナ状態
  try {
    const ps = execSync('docker ps --filter "name=daemon_core" --format "{{.Status}}" 2>/dev/null', { timeout: 3000 }).toString().trim();
    const status = ps || 'NOT RUNNING';
    const icon = ps ? (ps.includes('healthy') ? green('●') : ps.includes('unhealthy') ? red('●') : yellow('●')) : red('○');
    console.log(`${icon} Container: ${ps ? green(ps) : red('NOT RUNNING')}`);
  } catch {
    console.log(`${red('○')} Container: ${red('Docker unavailable')}`);
  }

  // Runaway検知
  if (state.runaway_detected) {
    const when = new Date(state.runaway_detected.detected_at).toLocaleTimeString('ja-JP');
    console.log(red(`⚠️  Runaway detected at ${when} (${state.runaway_detected.count}件)`));
    console.log(gray('   → `coo clear-runaway` でリセット'));
  }

  // 現在実行中タスク
  if (cur.task) {
    const elapsed = cur.action_updated_at
      ? Math.round((Date.now() - new Date(cur.action_updated_at)) / 1000)
      : null;
    console.log(`\n${bold('実行中')}:`);
    console.log(`  ${cyan(cur.task.substring(0, 80))}...`);
    if (elapsed !== null) console.log(`  ${gray(`${elapsed}秒経過 (TTL: ${cur.action_ttl || '?'}s)`)}`);
  } else {
    console.log(`\n${bold('実行中')}: ${gray('(待機中)')}`);
  }

  // キュー概要
  const pending = (state.pending_tasks || []).filter(t => t.status === 'pending');
  const inprogress = (state.pending_tasks || []).filter(t => t.status === 'in_progress');
  const doneCount = (state.completed_tasks || []).length;
  const failCount = (state.completed_tasks || []).filter(t => t.status === 'failed').length;

  console.log(`\n${bold('Queue')}: ${yellow(pending.length + '件 pending')} | ${cyan(inprogress.length + '件 in_progress')} | ${green(doneCount + '件 done')} | ${red(failCount + '件 failed')}`);

  // CoO reports (.coo_reports.json 優先 / state.coo_reports フォールバック)
  let reports = [];
  try {
    const cooFile = path.join(ANTIGRAVITY_DIR, '.coo_reports.json');
    if (fs.existsSync(cooFile)) {
      reports = JSON.parse(fs.readFileSync(cooFile, 'utf8'));
    } else {
      reports = state.coo_reports || [];
    }
  } catch { reports = state.coo_reports || []; }
  if (reports.length > 0) {
    console.log(`\n${bold(red('CoO Reports'))} (${reports.length}件):`);
    reports.slice(-3).forEach(r => {
      const ts = r.suspended_at || r.at || r.timestamp;
      const timeStr = ts ? new Date(ts).toLocaleTimeString('ja-JP') : '?';
      console.log(`  ${red('!')} [${timeStr}] ${r.reason || r.type}: ${gray((r.taskId || '').substring(0, 30))}`);
    });
  }

  console.log('─'.repeat(50));
}

function cmdPending() {
  const state = readState();
  const pending = (state.pending_tasks || []).filter(t => t.status !== 'done');

  if (pending.length === 0) {
    console.log(green('✅ キューは空です'));
    return;
  }

  console.log(bold(`\n📋 Pending Tasks (${pending.length}件)\n`));
  pending.forEach((t, i) => {
    const priorityColor = t.priority === 'coo_assigned' ? magenta : t.priority === 'high' ? red : yellow;
    const status = t.status === 'in_progress' ? cyan('▶') : gray('○');
    console.log(`${status} [${i + 1}] ${priorityColor('[' + t.priority + ']')} ${t.task.substring(0, 70)}${t.task.length > 70 ? '...' : ''}`);
    console.log(`       ${gray(t.id)} ${gray(new Date(t.created_at).toLocaleString('ja-JP'))}`);
  });
}

function cmdLog(args) {
  const n = parseInt(args[0]) || 10;
  const state = readState();
  const completed = (state.completed_tasks || []).slice(-n).reverse();

  if (completed.length === 0) {
    console.log(gray('完了タスクはありません'));
    return;
  }

  console.log(bold(`\n📜 Recent Completed Tasks (${completed.length}/${n}件)\n`));
  completed.forEach(t => {
    const icon = t.status === 'done' ? green('✅') : red('❌');
    const at = t.completed_at ? new Date(t.completed_at).toLocaleString('ja-JP') : '?';
    console.log(`${icon} ${t.task.substring(0, 70)}${t.task.length > 70 ? '...' : ''}`);
    console.log(`   ${gray(at)} ${gray(t.id || '')}`);
  });
}

function cmdClearRunaway() {
  const state = readState();
  if (!state.runaway_detected) {
    console.log(green('✅ runaway_detected は設定されていません'));
    return;
  }
  delete state.runaway_detected;
  atomicWrite(state);
  console.log(green('✅ runaway_detected をリセットしました'));
}

function cmdDaemon() {
  try {
    const ps = execSync('docker ps -a --filter "name=daemon_core" --format "table {{.ID}}\t{{.Status}}\t{{.CreatedAt}}" 2>/dev/null').toString().trim();
    console.log(ps || red('daemon_core コンテナが見つかりません'));
    console.log('');
    const logs = execSync('docker logs daemon_core --tail=8 2>&1').toString();
    console.log(bold('Recent Logs:'));
    console.log(gray(logs));
  } catch (e) {
    console.error(red('Docker unavailable: ' + e.message));
  }
}

function showHelp() {
  console.log(`
${bold(cyan('coo'))} — Antigravity Daemon Core CLI

${bold('Commands:')}
  ${cyan('coo push')} ${yellow('"タスク"')} ${gray('[--priority=coo_assigned|high|medium|low]')}
      Daemon Coreのキューにタスクを追加

  ${cyan('coo status')}
      Daemon Coreの現在の状態を表示

  ${cyan('coo pending')}
      実行待ちタスクの一覧

  ${cyan('coo log')} ${gray('[N=10]')}
      完了タスクの直近N件を表示

  ${cyan('coo clear-runaway')}
      Runaway Detectionのフラグをリセット

  ${cyan('coo daemon')}
      Dockerコンテナの状態とログを確認

${bold('Examples:')}
  ${gray('coo push "session_state.jsのstate.historyバグを修正せよ"')}
  ${gray('coo push "verify_core.shを30秒以内に最適化" --priority=high')}
  ${gray('coo status')}
  ${gray('coo log 5')}
`);
}


// ─── Main ──────────────────────────────────────────────────
const [, , cmd, ...rest] = process.argv;

switch (cmd) {
  case 'push':          cmdPush(rest); break;
  case 'status':        cmdStatus(); break;
  case 'pending':       cmdPending(); break;
  case 'log':           cmdLog(rest); break;
  case 'clear-runaway': cmdClearRunaway(); break;
  case 'daemon':        cmdDaemon(); break;
  case '--help':
  case '-h':
  case undefined:       showHelp(); break;
  default:
    console.error(red(`❌ Unknown command: ${cmd}`));
    showHelp();
    process.exit(1);
}
