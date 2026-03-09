#!/usr/bin/env node
/**
 * knowledge-distiller.js — L5: Knowledge Distillation Loop
 *
 * knowledge/ と agent/skills/ の蓄積知識を定期的に圧縮・蒸留し、
 * knowledge/distilled/ に「濃縮原則」として保存する。
 * 詳細な元データは knowledge/archived/ にアーカイブし、
 * コンテキスト膨張を防ぐ。
 *
 * Phase 7 - Task 7-3 (L5 実装)
 *
 * Principles:
 *  1. Reversibility: オリジナルは knowledge/archived/ に保持（ロールバック可能）
 *  2. Evidence-Backed: 5件以上の独立例で裏付けられた知識のみ蒸留
 *  3. Scheduled: タスク完了数が 10 の倍数のときに自動トリガー
 *
 * Usage:
 *   node knowledge-distiller.js [--dry-run] [--force] [--min-evidence N]
 */

const fs = require('fs');
const path = require('path');

const ANTIGRAVITY_DIR  = process.env.ANTIGRAVITY_DIR || path.join(process.env.HOME, '.antigravity');
const KNOWLEDGE_DIR    = path.join(ANTIGRAVITY_DIR, 'knowledge');
const DISTILLED_DIR    = path.join(ANTIGRAVITY_DIR, 'knowledge', 'distilled');
const ARCHIVED_DIR     = path.join(ANTIGRAVITY_DIR, 'knowledge', 'archived');
const DISTILL_LOG      = path.join(ANTIGRAVITY_DIR, '.distillation_log.json');

const DRY_RUN          = process.argv.includes('--dry-run');
const FORCE            = process.argv.includes('--force');
const MIN_EVIDENCE     = parseInt(process.argv.find(a => a.startsWith('--min-evidence='))?.split('=')[1] || '5', 10);
const SIZE_THRESHOLD   = 50; // KB — この値を超えたら自動トリガー

function log(msg, level = 'INFO') { console.log(`[knowledge-distiller] [${level}] ${msg}`); }

// ─── ナレッジメトリクス ───────────────────────────────────────────────────────
function getKnowledgeMetrics() {
  if (!fs.existsSync(KNOWLEDGE_DIR)) return { fileCount: 0, totalSizeKB: 0, files: [] };
  const files = fs.readdirSync(KNOWLEDGE_DIR)
    .filter(f => f.endsWith('.md') && !f.startsWith('_'))
    .filter(f => {
      const abs = path.join(KNOWLEDGE_DIR, f);
      return fs.statSync(abs).isFile();
    });
  const totalSize = files.reduce((sum, f) => sum + fs.statSync(path.join(KNOWLEDGE_DIR, f)).size, 0);
  return { fileCount: files.length, totalSizeKB: Math.round(totalSize / 1024), files };
}

// ─── 蒸留対象判定 ────────────────────────────────────────────────────────────
function shouldDistill(metrics) {
  if (FORCE) return true;
  const log = loadDistillLog();
  const completedTasks = readStateTaskCount();
  const lastDistilledAt = log.last_distilled_at ? new Date(log.last_distilled_at) : new Date(0);
  const hoursSince = (Date.now() - lastDistilledAt) / 3600000;

  if (metrics.totalSizeKB >= SIZE_THRESHOLD) {
    log(`Size threshold reached: ${metrics.totalSizeKB}KB >= ${SIZE_THRESHOLD}KB`, 'INFO');
    return true;
  }
  if (completedTasks > 0 && completedTasks % 10 === 0) {
    log(`Task count trigger: ${completedTasks} tasks completed`, 'INFO');
    return true;
  }
  if (hoursSince > 24 && metrics.fileCount > 5) {
    log(`Time trigger: ${hoursSince.toFixed(1)}h since last distillation`, 'INFO');
    return true;
  }
  return false;
}

function readStateTaskCount() {
  const stateFile = path.join(ANTIGRAVITY_DIR, '.session_state.json');
  if (!fs.existsSync(stateFile)) return 0;
  try {
    const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    return (state.completed_tasks || []).length;
  } catch { return 0; }
}

// ─── 類似度計算（Jaccard係数） ─────────────────────────────────────────────────
function jaccardSimilarity(a, b) {
  const setA = new Set(a.toLowerCase().split(/\s+/));
  const setB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

// ─── 蒸留処理 ─────────────────────────────────────────────────────────────────
function distillKnowledge(files) {
  // ファイルを読み込んでグループ化
  const docs = files.map(f => {
    const abs = path.join(KNOWLEDGE_DIR, f);
    const content = fs.readFileSync(abs, 'utf8');
    const taskMatch = content.match(/## タスク\n(.+)/);
    const successMatch = content.includes('✅ 成功');
    const errorMatches = [...content.matchAll(/### \d+\. (\w+)\n```\n(.+?)(?:\n|$)/g)];
    return {
      file: f, content, abs,
      task: taskMatch?.[1]?.trim() || f,
      success: successMatch,
      errors: errorMatches.map(m => ({ type: m[1], msg: m[2] })),
    };
  });

  // 類似ドキュメントをクラスタリング（Jaccard > 0.3 なら同クラスタ）
  const clusters = [];
  const assigned = new Set();

  for (let i = 0; i < docs.length; i++) {
    if (assigned.has(i)) continue;
    const cluster = [docs[i]];
    assigned.add(i);
    for (let j = i + 1; j < docs.length; j++) {
      if (assigned.has(j)) continue;
      const sim = jaccardSimilarity(docs[i].task, docs[j].task);
      if (sim > 0.3) { cluster.push(docs[j]); assigned.add(j); }
    }
    clusters.push(cluster);
  }

  log(`Clustered ${docs.length} docs into ${clusters.length} clusters`);

  // エビデンス数が MIN_EVIDENCE 以上のクラスタのみ蒸留
  const distillable = clusters.filter(c => c.length >= MIN_EVIDENCE);
  const distilled = [];

  for (const cluster of distillable) {
    const successCount = cluster.filter(d => d.success).length;
    const errorTypes = {};
    for (const d of cluster) {
      for (const e of d.errors) {
        errorTypes[e.type] = (errorTypes[e.type] || 0) + 1;
      }
    }
    const topErrors = Object.entries(errorTypes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type, count]) => `- ${type}: ${count}件`);

    const principle = {
      id: `principle_${Date.now()}_${distilled.length}`,
      topic: cluster[0].task.substring(0, 50),
      evidence_count: cluster.length,
      success_rate: Math.round(successCount / cluster.length * 100),
      key_errors: topErrors,
      files: cluster.map(d => d.file),
    };
    distilled.push(principle);
  }

  return { distilled, allClusters: clusters, distillableDocs: distillable.flat() };
}

// ─── 蒸留結果の保存 ───────────────────────────────────────────────────────────
function saveDistillation(distilled) {
  if (!DRY_RUN) {
    fs.mkdirSync(DISTILLED_DIR, { recursive: true });
    fs.mkdirSync(ARCHIVED_DIR, { recursive: true });
  }

  const today = new Date().toISOString().split('T')[0];
  const distillPath = path.join(DISTILLED_DIR, `${today}_principles.md`);

  const content = `# 蒸留原則 — ${today}
生成: knowledge-distiller.js (L5 Knowledge Distillation Loop)
エビデンス要件: ${MIN_EVIDENCE}件以上

---

${distilled.map(p => `
## ${p.topic}
- **エビデンス数**: ${p.evidence_count}件
- **成功率**: ${p.success_rate}%
- **主要エラー**:
${p.key_errors.join('\n') || '  なし'}
- **元ファイル**: ${p.files.slice(0, 5).join(', ')}${p.files.length > 5 ? ` 他${p.files.length - 5}件` : ''}
`).join('\n---\n')}
`;

  if (!DRY_RUN) {
    fs.writeFileSync(distillPath, content);
    log(`Distilled principles saved to: ${path.basename(distillPath)}`);
  } else {
    log(`[dry-run] Would save to: ${distillPath}`);
    log(`[dry-run] Content preview:\n${content.substring(0, 500)}`);
  }

  return distillPath;
}

// ─── アーカイブ処理（Reversibility 原則） ────────────────────────────────────
function archiveDocs(docs) {
  if (DRY_RUN) { log(`[dry-run] Would archive ${docs.length} docs`); return; }
  fs.mkdirSync(ARCHIVED_DIR, { recursive: true });
  for (const doc of docs) {
    const dest = path.join(ARCHIVED_DIR, doc.file);
    if (!fs.existsSync(dest)) {
      fs.renameSync(doc.abs, dest);
      log(`Archived: ${doc.file}`);
    }
  }
}

// ─── ログ管理 ─────────────────────────────────────────────────────────────────
function loadDistillLog() {
  if (!fs.existsSync(DISTILL_LOG)) return {};
  try { return JSON.parse(fs.readFileSync(DISTILL_LOG, 'utf8')); } catch { return {}; }
}

function saveDistillLog(data) {
  if (!DRY_RUN) fs.writeFileSync(DISTILL_LOG, JSON.stringify(data, null, 2));
}

// ─── メイン ──────────────────────────────────────────────────────────────────
async function run() {
  log(`Starting L5 Knowledge Distillation Loop (min-evidence=${MIN_EVIDENCE}, dry-run=${DRY_RUN}, force=${FORCE})`);

  const metrics = getKnowledgeMetrics();
  log(`Knowledge metrics: ${metrics.fileCount} files, ${metrics.totalSizeKB}KB`);

  if (!shouldDistill(metrics)) {
    log('Distillation not needed yet. Skipping.');
    return { distilled: 0, archived: 0, skipped: true };
  }

  if (metrics.files.length === 0) {
    log('No knowledge files to distill.');
    return { distilled: 0, archived: 0 };
  }

  const { distilled, distillableDocs } = distillKnowledge(metrics.files);

  if (distilled.length === 0) {
    log(`No clusters with >= ${MIN_EVIDENCE} evidence. Try lowering --min-evidence.`);
    return { distilled: 0, archived: 0 };
  }

  const distillPath = saveDistillation(distilled);
  archiveDocs(distillableDocs);

  const distillLog = loadDistillLog();
  distillLog.last_distilled_at = new Date().toISOString();
  distillLog.total_principles = (distillLog.total_principles || 0) + distilled.length;
  distillLog.total_archived = (distillLog.total_archived || 0) + distillableDocs.length;
  saveDistillLog(distillLog);

  log(`✅ Distillation complete:`);
  log(`   Principles: ${distilled.length}`);
  log(`   Archived:   ${distillableDocs.length} docs`);
  log(`   Saved to:   ${path.basename(distillPath)}`);

  return { distilled: distilled.length, archived: distillableDocs.length };
}

run();
module.exports = { run, shouldDistill, getKnowledgeMetrics };
