#!/usr/bin/env node
/**
 * creative_qc.js — Layer 3: Rule-Based Creative Quality Check
 * 
 * 使用方法:
 *   node creative_qc.js --scenes <scenes.json> --tsx <LpAd.tsx>
 * 
 * 出力:
 *   { passed: N, failed: N, score: N, blocking: [...], warnings: [...] }
 */

const fs = require('fs');
const path = require('path');

const SCENES_FILE = process.argv[process.argv.indexOf('--scenes') + 1] 
  || path.join(__dirname, '../knowledge/creative_dataset/lp_ad_scenes.json');
const TSX_FILE = process.argv[process.argv.indexOf('--tsx') + 1]
  || path.join(__dirname, '../../media/remotion/src/templates/lp/LpAd.tsx');
const FORMAT = process.argv[process.argv.indexOf('--format') + 1] || '30s';

// ======== LOAD DATA ========
const scenes = JSON.parse(fs.readFileSync(SCENES_FILE, 'utf8'));
const tsx = fs.existsSync(TSX_FILE) ? fs.readFileSync(TSX_FILE, 'utf8') : '';
const scenesDef = scenes.formats[FORMAT]?.scenes || [];

// ======== CHECK DEFINITIONS ========
const checks = [
  // --- 死のパターン（MKT-04）---
  {
    id: 'D-01',
    label: '最初の1秒（30f）にロゴ・商品名先出しがないか',
    severity: 'BLOCKING',
    check: () => {
      // Hookシーンのforbiddenにロゴが含まれているか確認（TSX内のテキストでチェック）
      const hookScene = scenesDef.find(s => s.id === 'hook');
      if (!hookScene) return { pass: false, reason: 'hookシーンが定義されていない' };
      const forbidden = hookScene.forbidden || [];
      const hasBrandCheck = forbidden.some(f => f.includes('ロゴ') || f.includes('商品名'));
      return { 
        pass: hasBrandCheck,
        reason: hasBrandCheck ? 'hookシーンのforbiddenにロゴ禁止が定義されている ✓' : 'hookシーンにロゴ禁止が定義されていない'
      };
    }
  },
  {
    id: 'D-02',
    label: '感情の順序がempathy→fomo→hope→liberationになっているか',
    severity: 'BLOCKING',
    check: () => {
      const emotions = scenesDef.map(s => s.emotion);
      const required = ['empathy', 'fomo'];
      const empathyIdx = emotions.findIndex(e => e === 'empathy');
      const fomoIdx = emotions.findIndex(e => e.includes('fomo'));
      const hopeIdx = emotions.findIndex(e => e === 'hope');
      const liberationIdx = emotions.findIndex(e => e === 'liberation');
      const correct = empathyIdx < fomoIdx && fomoIdx < hopeIdx && hopeIdx < liberationIdx;
      return {
        pass: correct,
        reason: correct 
          ? `感情順序が正しい: ${emotions.join(' → ')} ✓`
          : `感情順序が不正: ${emotions.join(' → ')} — empathy→fomo→hope→liberationが必須`
      };
    }
  },
  {
    id: 'D-03',
    label: '全シーンにnarrtion_fileが設定されているか（silence除く）',
    severity: 'WARNING',
    check: () => {
      const missing = scenesDef
        .filter(s => s.emotion !== 'silence' && !s.narration_file)
        .map(s => s.id);
      return {
        pass: missing.length === 0,
        reason: missing.length === 0 
          ? '全シーンにnarration_fileが設定されている ✓'
          : `narration_fileが未設定のシーン: ${missing.join(', ')}`
      };
    }
  },
  {
    id: 'D-04',
    label: 'CTAシーンが存在し、liberationに設定されているか',
    severity: 'BLOCKING',
    check: () => {
      const ctaScene = scenesDef.find(s => s.id === 'cta');
      const pass = ctaScene && ctaScene.emotion === 'liberation';
      return {
        pass: !!pass,
        reason: pass ? 'CTAシーン（liberation）が定義されている ✓' : 'CTAシーン（liberation）が未定義'
      };
    }
  },
  {
    id: 'D-05',
    label: 'CTAのforbiddenに山奔り表現が禁止されているか',
    severity: 'WARNING',
    check: () => {
      const ctaScene = scenesDef.find(s => s.id === 'cta');
      if (!ctaScene) return { pass: false, reason: 'CTAシーン未定義' };
      const hasBan = (ctaScene.forbidden || []).some(f => f.includes('限定') || f.includes('山奔り'));
      return {
        pass: hasBan,
        reason: hasBan ? 'CTAに山奔り表現禁止が定義されている ✓' : 'CTAに山奔り表現禁止が定義されていない'
      };
    }
  },
  // --- Timeline Compliance ---
  {
    id: 'T-01',
    label: 'scenes.jsonのtotal_framesが全シーンのend_frameと一致するか',
    severity: 'BLOCKING',
    check: () => {
      const format = scenes.formats[FORMAT];
      if (!format) return { pass: false, reason: `フォーマット${FORMAT}が定義されていない` };
      const lastScene = format.scenes[format.scenes.length - 1];
      const pass = lastScene.end_frame === format.total_frames;
      return {
        pass,
        reason: pass 
          ? `total_frames(${format.total_frames}) = 最終シーンend_frame(${lastScene.end_frame}) ✓`
          : `total_frames(${format.total_frames}) ≠ 最終シーンend_frame(${lastScene.end_frame})`
      };
    }
  },
  {
    id: 'T-02',
    label: 'シーンのstart_frame/end_frameに重複・ギャップがないか',
    severity: 'BLOCKING',
    check: () => {
      const errors = [];
      for (let i = 1; i < scenesDef.length; i++) {
        const prev = scenesDef[i - 1];
        const curr = scenesDef[i];
        if (curr.start_frame !== prev.end_frame) {
          errors.push(`${prev.id}(${prev.end_frame}) → ${curr.id}(${curr.start_frame}) にギャップまたは重複`);
        }
      }
      return {
        pass: errors.length === 0,
        reason: errors.length === 0 
          ? 'シーンに重複・ギャップなし ✓'
          : errors.join('; ')
      };
    }
  },
  // --- TSX Compliance ---
  {
    id: 'C-01',
    label: 'LpAd.tsxがsolopro_emotion_map.jsonを参照しているか（コメント確認）',
    severity: 'WARNING',
    check: () => {
      const hasRef = tsx.includes('emotion_map') || tsx.includes('CREATIVE_BRIEF') || tsx.includes('scenes.json');
      return {
        pass: hasRef,
        reason: hasRef ? 'TSXにCreative Brief / scenes.jsonへの参照が存在する ✓' : 'TSXにCreative Briefへの参照コメントなし（推奨）'
      };
    }
  }
];

// ======== RUN CHECKS ========
console.log('\n🎬 SOLOPRO Creative QC — Layer 3 Rule-Based Check');
console.log(`📋 Format: ${FORMAT} | Scenes: ${scenesDef.length}`);
console.log('─'.repeat(60));

const results = checks.map(chk => {
  const result = chk.check();
  const status = result.pass ? '✅ PASS' : (chk.severity === 'BLOCKING' ? '❌ BLOCK' : '⚠️  WARN');
  console.log(`${status} [${chk.id}] ${chk.label}`);
  if (!result.pass) console.log(`   → ${result.reason}`);
  return { ...chk, ...result };
});

const blocking = results.filter(r => !r.pass && r.severity === 'BLOCKING');
const warnings = results.filter(r => !r.pass && r.severity === 'WARNING');
const passed = results.filter(r => r.pass);

const score = Math.round((passed.length / results.length) * 100);

console.log('─'.repeat(60));
console.log(`\n📊 QC Summary:`);
console.log(`  PASS:    ${passed.length}/${results.length}`);
console.log(`  BLOCK:   ${blocking.length}`);
console.log(`  WARN:    ${warnings.length}`);
console.log(`  Score:   ${score}%`);
console.log(`  Verdict: ${blocking.length === 0 ? '🟢 APPROVED (Proceed to render)' : '🔴 BLOCKED (Fix required before render)'}`);

if (blocking.length > 0) {
  console.log('\n🔴 Blocking Issues:');
  blocking.forEach(b => console.log(`  - [${b.id}] ${b.label}: ${b.reason}`));
}

// JSON出力（他スクリプトからの読み込み用）
const output = {
  format: FORMAT,
  timestamp: new Date().toISOString(),
  passed: passed.length,
  failed: blocking.length + warnings.length,
  blocking_count: blocking.length,
  warning_count: warnings.length,
  score,
  verdict: blocking.length === 0 ? 'APPROVED' : 'BLOCKED',
  blocking_issues: blocking.map(b => ({ id: b.id, label: b.label, reason: b.reason })),
  warnings: warnings.map(w => ({ id: w.id, label: w.label, reason: w.reason }))
};

fs.writeFileSync('/tmp/creative_qc_result.json', JSON.stringify(output, null, 2));
console.log('\n📄 結果を /tmp/creative_qc_result.json に保存しました。');
process.exit(blocking.length > 0 ? 1 : 0);
