#!/usr/bin/env node
/**
 * coo-optimizer.js — L4/L2 COO 自己強化学習ループ
 *
 * Daemon Core の Suspend/完了レポート（coo_reports/completed_tasks）を解析し、
 * COO が次のセッションに渡す「初期状態」を自動最適化する。
 *
 * 具体的には:
 *  - 頻出エラー → コアワークフローに注意書きを追記
 *  - 高成功率タスク → SKILL.md の "Quick Wins" セクションを更新
 *  - TTL 超過パターン → 推奨 TTL テーブルを更新
 *
 * Phase 7 - Task 7-2 (COO 自己強化学習閉ループ)
 *
 * Usage:
 *   node coo-optimizer.js [--dry-run] [--report-only]
 */

const fs = require('fs');
const path = require('path');

const ANTIGRAVITY_DIR  = process.env.ANTIGRAVITY_DIR || path.join(process.env.HOME, '.antigravity');
const STATE_FILE       = path.join(ANTIGRAVITY_DIR, '.session_state.json');
const COO_INSIGHT_FILE = path.join(ANTIGRAVITY_DIR, '.coo_insights.json');
const DAEMON_SKILL     = path.join(ANTIGRAVITY_DIR, 'agent', 'skills', 'daemon-core', 'SKILL.md');

const DRY_RUN     = process.argv.includes('--dry-run');
const REPORT_ONLY = process.argv.includes('--report-only');

function log(msg) { console.log(`[coo-optimizer] ${msg}`); }

// ─── State からデータを抽出 ───────────────────────────────────────────────────
function loadStateData() {
  if (!fs.existsSync(STATE_FILE)) return { completed: [], reports: [] };
  try {
    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    return {
      completed: state.completed_tasks || [],
      reports: state.coo_reports || [],
    };
  } catch { return { completed: [], reports: [] }; }
}

// ─── インサイト分析 ───────────────────────────────────────────────────────────
function analyzeData(completed, reports) {
  const insights = {
    total_tasks: completed.length,
    success_count: completed.filter(t => t.result?.success).length,
    fail_count: completed.filter(t => !t.result?.success).length,
    stagnation_count: reports.filter(r => r.reason === 'stagnation').length,
    budget_exhausted_count: reports.filter(r => r.reason === 'budget_exhausted').length,
    avg_llm_calls: 0,
    ttl_violations: [],
    error_hot_spots: {},
    quick_wins: [],
    recommended_ttl: {},
  };

  if (completed.length > 0) {
    insights.avg_llm_calls = Math.round(
      completed.reduce((sum, t) => sum + (t.result?.llmCalls || 0), 0) / completed.length
    );
  }

  // エラーホットスポット集計
  for (const r of reports) {
    for (const e of r.error_summary || []) {
      const key = e.type;
      insights.error_hot_spots[key] = (insights.error_hot_spots[key] || 0) + 1;
    }
  }

  // Quick Wins（1ループで成功したタスク）
  insights.quick_wins = completed
    .filter(t => t.result?.success && (t.result?.loops || 0) <= 3)
    .map(t => ({ task: t.task.substring(0, 80), loops: t.result.loops, llmCalls: t.result.llmCalls }))
    .slice(0, 10);

  // TTL 推奨値（タスクタイプ別の平均完了時間から計算）
  const ttlGroups = {};
  for (const t of completed) {
    const cat = categorizeTask(t.task);
    if (!ttlGroups[cat]) ttlGroups[cat] = [];
    const duration = t.completed_at && t.pushed_at
      ? (new Date(t.completed_at) - new Date(t.pushed_at)) / 1000
      : 600;
    ttlGroups[cat].push(duration);
  }
  for (const [cat, durations] of Object.entries(ttlGroups)) {
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    insights.recommended_ttl[cat] = Math.round(avg * 1.5); // 平均の 1.5 倍が推奨 TTL
  }

  return insights;
}

function categorizeTask(task) {
  if (/test|spec/.test(task)) return 'testing';
  if (/docker|container/.test(task)) return 'docker';
  if (/npm|node/.test(task)) return 'nodejs';
  if (/css|ui|style/.test(task)) return 'frontend';
  if (/fix|bug/.test(task)) return 'bugfix';
  if (/impl|add|create|build/.test(task)) return 'implementation';
  return 'general';
}

// ─── daemon-core SKILL.md を更新 ──────────────────────────────────────────────
function updateDaemonSkill(insights) {
  fs.mkdirSync(path.dirname(DAEMON_SKILL), { recursive: true });

  const errorHotSpots = Object.entries(insights.error_hot_spots)
    .sort((a, b) => b[1] - a[1]).slice(0, 5);

  const recommendedTTL = Object.entries(insights.recommended_ttl)
    .map(([cat, ttl]) => `| ${cat} | ${ttl}s (${Math.round(ttl / 60)}分) |`).join('\n');

  const quickWins = insights.quick_wins
    .map(w => `- "${w.task}" (${w.loops} loops, ${w.llmCalls} calls)`).join('\n');

  const content = `---
name: Daemon Core Operating Insights
description: COO 自己強化学習ループ (L4) が自動生成した Daemon Core の運用知識
generated_by: coo-optimizer
last_updated: ${new Date().toISOString()}
---

# Daemon Core Operating Insights

**COO 自己強化学習ループ（L4）** によって自動生成・更新されるスキルシート。
Daemon Core の実績データから学習した最適運用パラメータを記録する。

## 実績サマリー

| 指標 | 値 |
|------|-----|
| 総タスク数 | ${insights.total_tasks} |
| 成功率 | ${insights.total_tasks > 0 ? Math.round(insights.success_count / insights.total_tasks * 100) : 0}% |
| 平均 LLM コール数 | ${insights.avg_llm_calls} |
| Stagnation 発生 | ${insights.stagnation_count} 件 |
| Budget 超過 | ${insights.budget_exhausted_count} 件 |

## 推奨 TTL（タスクカテゴリ別）

| カテゴリ | 推奨 TTL |
|----------|---------|
${recommendedTTL || '| general | 600s (10分) |'}

## エラーホットスポット（注意すべきエラータイプ）

${errorHotSpots.length > 0
  ? errorHotSpots.map(([type, count]) => `- **${type}**: ${count}件発生`).join('\n')
  : '- データなし（タスク蓄積後に更新されます）'}

## Quick Wins（低コストで成功するタスクパターン）

${quickWins || '- データなし（タスク蓄積後に更新されます）'}

## COO への推奨事項

${insights.stagnation_count > 2
  ? '⚠️ Stagnation が頻発しています。Smart Contract の stagnation_threshold を引き下げるか、Hint の具体性を高めてください。' : ''}
${insights.budget_exhausted_count > 3
  ? '⚠️ Budget 超過が多発しています。max_llm_calls の増加、またはタスク細分化を検討してください。' : ''}
${insights.avg_llm_calls > 20
  ? '💡 平均 LLM コールが多い。ReAct プロンプトのアクション精度を上げると効率化できます。' : ''}
${insights.success_count / Math.max(1, insights.total_tasks) > 0.8
  ? '✅ 高い成功率を維持しています。現在の設定は適切です。' : ''}
`;

  if (!DRY_RUN) {
    fs.writeFileSync(DAEMON_SKILL, content);
    log(`Updated SKILL.md: ${DAEMON_SKILL}`);
  } else {
    log(`[dry-run] Would update: ${DAEMON_SKILL}`);
  }
}

// ─── インサイト保存 ────────────────────────────────────────────────────────────
function saveInsights(insights) {
  if (DRY_RUN) return;
  const existing = fs.existsSync(COO_INSIGHT_FILE) ? JSON.parse(fs.readFileSync(COO_INSIGHT_FILE, 'utf8')) : { history: [] };
  existing.history.push({ ...insights, recorded_at: new Date().toISOString() });
  existing.latest = insights;
  existing.last_updated = new Date().toISOString();
  fs.writeFileSync(COO_INSIGHT_FILE, JSON.stringify(existing, null, 2));
}

// ─── メイン ──────────────────────────────────────────────────────────────────
async function run() {
  log(`Starting COO Self-Reinforcing Learning Loop (L4) (dry-run=${DRY_RUN})`);

  const { completed, reports } = loadStateData();
  log(`Analyzing: ${completed.length} completed tasks, ${reports.length} COO reports`);

  const insights = analyzeData(completed, reports);

  if (REPORT_ONLY) {
    console.log('\n📊 COO Insights Report:\n');
    console.log(JSON.stringify(insights, null, 2));
    return insights;
  }

  log(`Success rate: ${insights.total_tasks > 0 ? Math.round(insights.success_count / insights.total_tasks * 100) : 0}%`);
  log(`Avg LLM calls: ${insights.avg_llm_calls}`);
  log(`Error hot spots: ${Object.keys(insights.error_hot_spots).join(', ') || 'none'}`);

  updateDaemonSkill(insights);
  saveInsights(insights);

  log('✅ COO optimization complete.');
  return insights;
}

run();
module.exports = { run, analyzeData };
