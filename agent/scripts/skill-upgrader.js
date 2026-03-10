#!/usr/bin/env node
/**
 * skill-upgrader.js — L3: Knowledge Upgrade Protocol
 *
 * Daemon が knowledge/ に蓄積した L2 エピソード記憶を解析し、
 * 3件以上の独立した例で裏付けられたパターンを
 * ~/.antigravity/agent/skills/<domain>/SKILL.md に自動昇格させる。
 *
 * Phase 7 - Task 7-1 (L3 実装)
 *
 * Usage:
 *   node skill-upgrader.js [--dry-run] [--min-evidence N]
 *
 * 自動実行トリガー:
 *   - Daemon Core が tasks_completed を 5 の倍数で到達したとき
 *   - agent-loop.js から require('./skill-upgrader').run() で呼び出し可
 */

const fs = require('fs');
const path = require('path');

const ANTIGRAVITY_DIR  = process.env.ANTIGRAVITY_DIR || path.join(process.env.HOME, '.antigravity');
const KNOWLEDGE_DIR    = path.join(ANTIGRAVITY_DIR, 'knowledge');
const SKILLS_DIR       = path.join(ANTIGRAVITY_DIR, 'agent', 'skills');
const SKILL_LOG        = path.join(ANTIGRAVITY_DIR, '.skill_upgrade_log.json');
const MIN_EVIDENCE     = parseInt(process.argv.find(a => a.startsWith('--min-evidence='))?.split('=')[1] || '3', 10);
const DRY_RUN          = process.argv.includes('--dry-run');

function log(msg) { console.log(`[skill-upgrader] ${msg}`); }

// ─── knowledge/ を読み込む ────────────────────────────────────────────────────
function loadKnowledgeFiles() {
  if (!fs.existsSync(KNOWLEDGE_DIR)) return [];
  return fs.readdirSync(KNOWLEDGE_DIR)
    .filter(f => f.endsWith('.md') && !f.startsWith('_'))
    .map(f => {
      const abs = path.join(KNOWLEDGE_DIR, f);
      try { return { file: f, content: fs.readFileSync(abs, 'utf8'), mtime: fs.statSync(abs).mtime }; }
      catch { return null; }
    })
    .filter(Boolean);
}

// ─── パターン抽出（簡易 NLP: エラー/解決策ペアを探す） ────────────────────────
function extractPatterns(files) {
  const patternMap = {}; // pattern_key → { examples, domain }

  for (const { file, content } of files) {
    // エラーセクションを探す
    const errorMatches = [...content.matchAll(/## エラー履歴.*?\n([\s\S]*?)(?=\n##|$)/g)];
    const taskMatch = content.match(/## タスク\n(.+)/);
    const task = taskMatch?.[1]?.trim() || file;

    // コマンドエラーパターンを抽出
    const cmdErrors = [...content.matchAll(/### \d+\. command_error\n```\n(.+?)(?:\n|$)/g)];
    for (const [, errMsg] of cmdErrors) {
      const key = normalizePattern(errMsg);
      if (!key) continue;
      if (!patternMap[key]) patternMap[key] = { pattern: key, examples: [], domain: inferDomain(task) };
      patternMap[key].examples.push({ file, task, error: errMsg });
    }

    // SHELLコマンド成功パターン (done セクション)
    if (content.includes('✅ 成功')) {
      const cmds = [...content.matchAll(/- \[x\]\s+(.+)/g)].map(m => m[1]);
      for (const cmd of cmds) {
        const key = `success:${normalizePattern(cmd)}`;
        if (!patternMap[key]) patternMap[key] = { pattern: key, examples: [], domain: inferDomain(task), type: 'success' };
        patternMap[key].examples.push({ file, task, cmd });
      }
    }
  }

  // エビデンス数が MIN_EVIDENCE 以上のパターンのみ昇格対象
  return Object.values(patternMap).filter(p => p.examples.length >= MIN_EVIDENCE);
}

function normalizePattern(str) {
  return str.trim()
    .replace(/\b\d{4,}\b/g, 'N')      // 数値を N に正規化
    .replace(/\/tmp\/[a-z0-9]+/g, '/tmp/TMPFILE')
    .substring(0, 80);
}

function inferDomain(task) {
  if (/test|spec|jest|vitest/.test(task)) return 'testing';
  if (/docker|container/.test(task)) return 'docker';
  if (/\bnpm\b|\bpnpm\b|\bnode\b/.test(task)) return 'nodejs';
  if (/git|commit|push/.test(task)) return 'git';
  if (/css|ui|style|tailwind/.test(task)) return 'frontend';
  return 'general';
}

// ─── SKILL.md に昇格 ─────────────────────────────────────────────────────────
function upgradeSkill(domain, patterns) {
  const skillDir = path.join(SKILLS_DIR, `daemon-${domain}`);
  const skillFile = path.join(skillDir, 'SKILL.md');

  // 既存の SKILL.md を読み込む（なければ新規作成）
  let existing = '';
  if (fs.existsSync(skillFile)) {
    existing = fs.readFileSync(skillFile, 'utf8');
  }

  const upgLog = loadUpgradeLog();
  const newRules = [];

  for (const p of patterns) {
    const ruleId = `rule_${Buffer.from(p.pattern).toString('base64').substring(0, 12)}`;
    if (upgLog.promoted_rules?.includes(ruleId)) continue; // 既に昇格済
    if (existing.includes(p.pattern.substring(0, 40))) continue; // 重複チェック

    const ruleText = p.type === 'success'
      ? `\n### ✅ [${ruleId}] 成功パターン (${p.examples.length}件のエビデンス)\n- **パターン**: ${p.pattern}\n- **例**: ${p.examples.map(e => e.task).slice(0, 3).join(', ')}\n`
      : `\n### ⚠️ [${ruleId}] 回避パターン (${p.examples.length}件のエビデンス)\n- **エラー**: ${p.pattern}\n- **発生タスク**: ${p.examples.map(e => e.task).slice(0, 3).join(', ')}\n- **対策**: エラー発生時は代替アプローチを試みる\n`;

    newRules.push({ ruleId, text: ruleText });
  }

  if (newRules.length === 0) {
    log(`[${domain}] 新しいルールなし`);
    return 0;
  }

  if (!DRY_RUN) {
    fs.mkdirSync(skillDir, { recursive: true });
    const header = existing || `---\nname: Daemon ${domain.charAt(0).toUpperCase() + domain.slice(1)} Skill\ndescription: Daemon Core が自動学習した ${domain} ドメインの知識\ngenerated_by: skill-upgrader\n---\n\n# Daemon ${domain} Skill\n\nこのスキルは Daemon Core の L3 Knowledge Upgrade Protocol によって自動生成されました。\n手動で編集しても次回の昇格サイクルで追記されます。\n\n## 学習ルール\n`;
    const appended = header + newRules.map(r => r.text).join('');
    fs.writeFileSync(skillFile, appended);

    // ログ更新
    const newUpgLog = loadUpgradeLog();
    if (!newUpgLog.promoted_rules) newUpgLog.promoted_rules = [];
    for (const r of newRules) newUpgLog.promoted_rules.push(r.ruleId);
    newUpgLog.last_upgraded = new Date().toISOString();
    newUpgLog.total_rules = (newUpgLog.total_rules || 0) + newRules.length;
    saveUpgradeLog(newUpgLog);
  }

  log(`[${domain}] ${newRules.length} 件のルールを昇格${DRY_RUN ? ' (dry-run)' : ''}`);
  return newRules.length;
}

function loadUpgradeLog() {
  if (!fs.existsSync(SKILL_LOG)) return {};
  try { return JSON.parse(fs.readFileSync(SKILL_LOG, 'utf8')); } catch { return {}; }
}
function saveUpgradeLog(data) { fs.writeFileSync(SKILL_LOG, JSON.stringify(data, null, 2)); }

// ─── メイン ──────────────────────────────────────────────────────────────────
async function run() {
  log(`Starting L3 Knowledge Upgrade Protocol (min-evidence=${MIN_EVIDENCE}, dry-run=${DRY_RUN})`);

  const files = loadKnowledgeFiles();
  log(`Loaded ${files.length} knowledge files from ${KNOWLEDGE_DIR}`);

  if (files.length === 0) { log('No knowledge files found. Skipping.'); return { upgraded: 0 }; }

  const patterns = extractPatterns(files);
  log(`Found ${patterns.length} eligible patterns (evidence >= ${MIN_EVIDENCE})`);

  // ドメイン別にグルーピングして昇格
  const byDomain = {};
  for (const p of patterns) {
    if (!byDomain[p.domain]) byDomain[p.domain] = [];
    byDomain[p.domain].push(p);
  }

  let totalUpgraded = 0;
  for (const [domain, domainPatterns] of Object.entries(byDomain)) {
    totalUpgraded += upgradeSkill(domain, domainPatterns);
  }

  log(`✅ Total: ${totalUpgraded} rules promoted to SKILL.md`);
  return { upgraded: totalUpgraded };
}

run();
module.exports = { run };
