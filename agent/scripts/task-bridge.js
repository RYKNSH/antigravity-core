#!/usr/bin/env node
/**
 * task-bridge.js — Task Bridge
 *
 * TASKS.md を解析して Daemon Core の pending_tasks へ自動投入する。
 * /gen-dev ワークフロー完了後および /checkout 時に自動実行される。
 *
 * 使い方:
 *   node task-bridge.js [tasks_md_path]
 * デフォルト: ~/.antigravity/docs/TASKS.md
 */

const fs   = require('fs');
const path = require('path');

const ANTIGRAVITY_DIR = process.env.ANTIGRAVITY_DIR || (process.env.HOME + '/.antigravity');
const STATE_FILE      = path.join(ANTIGRAVITY_DIR, '.session_state.json');
const TASKS_MD        = process.argv[2] || path.join(ANTIGRAVITY_DIR, 'docs/TASKS.md');
const PROJECT_TASKS   = process.argv[3] || null; // プロジェクト固有のTASKS.md

function readJSON(file, def = null) {
  if (!fs.existsSync(file)) return def;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return def; }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function parseTasks(mdPath) {
  if (!fs.existsSync(mdPath)) return [];
  const content = fs.readFileSync(mdPath, 'utf8');
  const tasks = [];

  // [ ] 未完了タスクのみパース（[x]完了済み・[/]進行中は除外）
  const lines = content.split('\n');
  for (const line of lines) {
    const match = line.match(/^[-*]\s+\[\s\]\s+(.+)$/);
    if (!match) continue;
    const taskText = match[1].trim();
    if (!taskText) continue;

    // 優先度の自動判定
    let priority = 'coo_assigned';
    if (/\[P0\]|urgent|緊急/i.test(taskText)) priority = 'high';
    if (/self.improv|L3|SKILL/i.test(taskText)) priority = 'self_improvement';

    tasks.push({
      id: `bridge_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      task: taskText,
      status: 'pending',
      priority,
      source: path.basename(mdPath),
      ttl: 600,
      contract: {
        budget: { max_llm_calls: 80, stagnation_threshold: 5 },
        quality_gates: ['test', 'lint'],
      },
      created_at: new Date().toISOString(),
    });
  }
  return tasks;
}

function main() {
  const state = readJSON(STATE_FILE, {});
  state.pending_tasks = state.pending_tasks || [];
  state.completed_tasks = state.completed_tasks || [];

  const existingIds = new Set([
    ...state.pending_tasks.map(t => t.task),
    ...state.completed_tasks.map(t => t.task),
  ]);

  let addedCount = 0;
  const sources = [TASKS_MD];
  if (PROJECT_TASKS) sources.push(PROJECT_TASKS);

  for (const mdPath of sources) {
    const tasks = parseTasks(mdPath);
    for (const task of tasks) {
      // 重複チェック（タスク本文でdedup）
      if (existingIds.has(task.task)) {
        process.stdout.write(`[TaskBridge] SKIP (already exists): ${task.task.substring(0, 60)}\n`);
        continue;
      }
      state.pending_tasks.push(task);
      existingIds.add(task.task);
      addedCount++;
      process.stdout.write(`[TaskBridge] ADD [${task.priority}]: ${task.task.substring(0, 80)}\n`);
    }
  }

  if (addedCount > 0) {
    writeJSON(STATE_FILE, state);
    process.stdout.write(`[TaskBridge] ✅ ${addedCount}件のタスクを Daemon Core に投入しました。\n`);
  } else {
    process.stdout.write(`[TaskBridge] ℹ️ 新規タスクなし (既存: ${state.pending_tasks.filter(t=>t.status==='pending').length}件 pending)\n`);
  }
}

main();
