#!/usr/bin/env node

/**
 * session_state.js — セッション状態の永続化管理
 * 
 * 使い方:
 *   node session_state.js read                     # 現在の状態を読み込み
 *   node session_state.js write '{"key":"value"}'  # 状態を書き込み
 *   node session_state.js init                     # 新規セッション初期化
 *   node session_state.js update-field <field> '{"data":"value"}'  # フィールド更新
 *   node session_state.js add-task '<task>' <priority>  # タスク追加
 *   node session_state.js complete-task '<task>'   # タスク完了
 *   node session_state.js set-workflow '<wf>' '<phase>'  # ワークフロー設定
 *   node session_state.js snapshot                 # checkout用スナップショット
 */

const fs = require('fs');
const path = require('path');

const SSD_ROOT = '/Volumes/PortableSSD/.antigravity';
const STATE_FILE = path.join(SSD_ROOT, '.session_state.json');
const ARCHIVE_DIR = path.join(SSD_ROOT, 'brain_log', 'states');

/**
 * デフォルトスキーマ
 */
function createDefaultState() {
  const now = new Date().toISOString();
  return {
    schema_version: "1.0",
    session_id: now.slice(0, 16).replace('T', '_'),
    created_at: now,
    updated_at: now,

    // 現在のワークフロー状態
    current: {
      workflow: null,       // e.g. "/go", "/work", "/bug-fix"
      phase: null,          // e.g. "phase1_checkin", "phase2_work"
      parent_workflow: null, // ネストされたWF呼び出し時の親
      started_at: null
    },

    // 保留中のタスク
    pending_tasks: [
      // { task: "説明", priority: 1, status: "pending"|"in_progress"|"done"|"blocked", created_at: "..." }
    ],

    // セッション中の設計判断（Compaction対策）
    design_decisions: [
      // { context: "何について", decision: "何を決めた", reason: "なぜ", timestamp: "..." }
    ],

    // ワークフロー実行履歴
    history: [
      // { workflow: "/checkin", phase: "complete", result: "success", timestamp: "..." }
    ],

    // セッションメトリクス
    metrics: {
      workflows_executed: 0,
      tasks_completed: 0,
      errors_encountered: 0,
      auto_recoveries: 0
    },

    // プロアクティブトリガーの状態
    triggers: {
      active: true,
      last_fired: null,
      suppressed: []  // 一時的に無効化されたトリガー
    }
  };
}

/**
 * 状態ファイルの読み込み
 */
function readState() {
  try {
    if (!fs.existsSync(STATE_FILE)) {
      return null;
    }
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`⚠️ State file read error: ${err.message}`);
    return null;
  }
}

/**
 * 状態ファイルの書き込み
 */
function writeState(state) {
  try {
    state.updated_at = new Date().toISOString();
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
    console.log(`✅ Session state saved: ${STATE_FILE}`);
    return true;
  } catch (err) {
    console.error(`❌ State write error: ${err.message}`);
    return false;
  }
}

/**
 * 状態のアーカイブ（checkout時）
 */
function archiveState(state) {
  try {
    fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
    const timestamp = new Date().toISOString().slice(0, 16).replace(/:/g, '');
    const archivePath = path.join(ARCHIVE_DIR, `state_${timestamp}.json`);
    fs.writeFileSync(archivePath, JSON.stringify(state, null, 2), 'utf8');
    console.log(`📦 State archived: ${archivePath}`);
    
    // 古いアーカイブの削除（30個以上なら古い方を削除）
    const files = fs.readdirSync(ARCHIVE_DIR)
      .filter(f => f.startsWith('state_'))
      .sort();
    if (files.length > 30) {
      const toDelete = files.slice(0, files.length - 30);
      toDelete.forEach(f => {
        fs.unlinkSync(path.join(ARCHIVE_DIR, f));
      });
      console.log(`🗑️ Pruned ${toDelete.length} old state archives`);
    }
    return true;
  } catch (err) {
    console.error(`⚠️ Archive error: ${err.message}`);
    return false;
  }
}

// ─── CLI ───────────────────────────────────────

const [,, command, ...args] = process.argv;

switch (command) {
  case 'read': {
    const state = readState();
    if (state) {
      console.log(JSON.stringify(state, null, 2));
    } else {
      console.log('null');
      console.error('ℹ️ No active session state. Run "init" to create one.');
    }
    break;
  }

  case 'init': {
    const existing = readState();
    if (existing) {
      console.log('⚠️ Active session state exists. Archiving before re-init...');
      archiveState(existing);
    }
    const newState = createDefaultState();
    newState.current.workflow = '/go';
    newState.current.phase = 'phase1_checkin';
    newState.current.started_at = newState.created_at;
    writeState(newState);
    console.log(`🆕 New session initialized: ${newState.session_id}`);
    break;
  }

  case 'write': {
    try {
      const data = JSON.parse(args[0]);
      writeState(data);
    } catch (err) {
      console.error(`❌ Invalid JSON: ${err.message}`);
      process.exit(1);
    }
    break;
  }

  case 'update-field': {
    const field = args[0];
    const value = JSON.parse(args[1]);
    const state = readState();
    if (!state) {
      console.error('❌ No active session state');
      process.exit(1);
    }
    // ドット記法対応 e.g. "current.workflow"
    const keys = field.split('.');
    let obj = state;
    for (let i = 0; i < keys.length - 1; i++) {
      obj = obj[keys[i]];
    }
    obj[keys[keys.length - 1]] = value;
    writeState(state);
    break;
  }

  case 'set-workflow': {
    const wf = args[0];
    const phase = args[1] || null;
    const state = readState();
    if (!state) {
      console.error('❌ No active session state');
      process.exit(1);
    }
    // 前のWFを履歴に追加
    if (state.current.workflow) {
      state.history.push({
        workflow: state.current.workflow,
        phase: state.current.phase,
        result: 'transition',
        timestamp: new Date().toISOString()
      });
    }
    state.current.workflow = wf;
    state.current.phase = phase;
    state.current.started_at = new Date().toISOString();
    state.metrics.workflows_executed++;
    writeState(state);
    console.log(`🔄 Workflow: ${wf} [${phase || 'start'}]`);
    break;
  }

  case 'add-task': {
    const task = args[0];
    const priority = parseInt(args[1] || '5', 10);
    const state = readState();
    if (!state) {
      console.error('❌ No active session state');
      process.exit(1);
    }
    state.pending_tasks.push({
      task,
      priority,
      status: 'pending',
      created_at: new Date().toISOString()
    });
    // 優先度順にソート
    state.pending_tasks.sort((a, b) => a.priority - b.priority);
    writeState(state);
    console.log(`➕ Task added: "${task}" (priority: ${priority})`);
    break;
  }

  case 'complete-task': {
    const taskName = args[0];
    const state = readState();
    if (!state) {
      console.error('❌ No active session state');
      process.exit(1);
    }
    const task = state.pending_tasks.find(t => t.task === taskName && t.status !== 'done');
    if (task) {
      task.status = 'done';
      state.metrics.tasks_completed++;
      writeState(state);
      console.log(`✅ Task completed: "${taskName}"`);
    } else {
      console.error(`⚠️ Task not found: "${taskName}"`);
    }
    break;
  }

  case 'add-decision': {
    const context = args[0];
    const decision = args[1];
    const reason = args[2] || '';
    const state = readState();
    if (!state) {
      console.error('❌ No active session state');
      process.exit(1);
    }
    state.design_decisions.push({
      context,
      decision,
      reason,
      timestamp: new Date().toISOString()
    });
    writeState(state);
    console.log(`📝 Decision recorded: "${context}" → "${decision}"`);
    break;
  }

  case 'snapshot': {
    // checkout用: 状態をアーカイブし、ファイルを削除
    const state = readState();
    if (!state) {
      console.log('ℹ️ No active session state to snapshot.');
      break;
    }
    // 完了マーク
    state.current.workflow = null;
    state.current.phase = 'session_complete';
    state.history.push({
      workflow: '/checkout',
      phase: 'complete',
      result: 'success',
      timestamp: new Date().toISOString()
    });
    archiveState(state);
    // stateファイルを削除（次回 init で再作成）
    try {
      fs.unlinkSync(STATE_FILE);
      console.log('🗑️ Active state file removed (archived).');
    } catch (e) { /* ignore */ }
    break;
  }

  case 'summary': {
    // 人間可読なサマリーを出力
    const state = readState();
    if (!state) {
      console.log('ℹ️ No active session.');
      break;
    }
    console.log(`\n📊 Session Summary`);
    console.log(`   ID: ${state.session_id}`);
    console.log(`   Current WF: ${state.current.workflow || 'none'} [${state.current.phase || '-'}]`);
    console.log(`   WFs executed: ${state.metrics.workflows_executed}`);
    console.log(`   Tasks: ${state.metrics.tasks_completed} completed / ${state.pending_tasks.filter(t => t.status !== 'done').length} pending`);
    console.log(`   Decisions: ${state.design_decisions.length}`);
    if (state.pending_tasks.filter(t => t.status !== 'done').length > 0) {
      console.log(`\n   📋 Pending Tasks:`);
      state.pending_tasks
        .filter(t => t.status !== 'done')
        .forEach(t => console.log(`      [P${t.priority}] ${t.task} (${t.status})`));
    }
    break;
  }

  default:
    console.log(`Usage: node session_state.js <command> [args]`);
    console.log(`Commands: read | init | write | update-field | set-workflow | add-task | complete-task | add-decision | snapshot | summary`);
    break;
}
