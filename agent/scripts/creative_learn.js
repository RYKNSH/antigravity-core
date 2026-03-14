#!/usr/bin/env node
/**
 * creative_learn.js — GUI編集→diff→知識学習ループ
 *
 * 使用方法:
 *   node creative_learn.js [--file <tsx_path>] [--commit <sha>] [--dry-run]
 *
 * 動作:
 *   1. git diff HEAD <file> から変更差分を取得
 *   2. 差分をセマンティック解析（タイポグラフィ / 色 / コピー / タイミング）
 *   3. learned_preferences.json に知見を追記
 *   4. CREATIVE_BRIEF.md の「学習済み好み」セクションを自動更新
 *   5. 次回 /ad review でCreative Boardへ自動注入される
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ── 設定 ───────────────────────────────────────
const TSX_PATH = process.argv[process.argv.indexOf('--file') + 1]
  || path.join(__dirname, '../../media/remotion/src/templates/lp/LpAd.tsx');
const LEARN_FILE = path.join(__dirname, '../knowledge/creative_dataset/learned_preferences.json');
const BRIEF_FILE = path.join(__dirname, '../knowledge/creative_dataset/CREATIVE_BRIEF.md');
const STYLE_GUIDE = path.join(__dirname, '../knowledge/creative_dataset/creative_style_guide.md');
const DRY_RUN = process.argv.includes('--dry-run');

console.log('\n🧠 SOLOPRO Creative Learning Loop');
console.log(`📂 Target: ${path.basename(TSX_PATH)}`);
console.log(`${DRY_RUN ? '🔵 DRY RUN MODE' : '🟢 LIVE MODE'}`);
console.log('─'.repeat(60));

// ── Step 1: git diff を取得 ─────────────────────
let diff = '';
try {
  const repoRoot = path.join(__dirname, '../../media/remotion');
  const relPath = path.relative(repoRoot, TSX_PATH);
  diff = execSync(`git -C "${repoRoot}" diff HEAD -- "${relPath}"`, { encoding: 'utf8' });
  if (!diff.trim()) {
    diff = execSync(`git -C "${repoRoot}" diff HEAD~1 HEAD -- "${relPath}"`, { encoding: 'utf8' });
  }
} catch (e) {
  console.log('⚠️  git diff 取得失敗 — ファイル全体を解析します');
  diff = fs.existsSync(TSX_PATH) ? fs.readFileSync(TSX_PATH, 'utf8') : '';
}

if (!diff.trim()) {
  console.log('ℹ️  変更差分なし。Remotion Studioで編集してから再実行してください。');
  process.exit(0);
}

console.log(`\n📋 差分を検出 (${diff.split('\n').filter(l => l.startsWith('+')).length} 行の追加)`);

// ── Step 2: セマンティック解析 ──────────────────
const findings = [];

const addedLines = diff.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++'));
const removedLines = diff.split('\n').filter(l => l.startsWith('-') && !l.startsWith('---'));

// ── 2a. Typography changes ─────────────────────
const fsChange = addedLines.find(l => /fontSize:\s*\d+/.test(l));
const fsOld = removedLines.find(l => /fontSize:\s*\d+/.test(l));
if (fsChange && fsOld) {
  const newSize = fsChange.match(/fontSize:\s*(\d+)/)?.[1];
  const oldSize = fsOld.match(/fontSize:\s*(\d+)/)?.[1];
  if (newSize !== oldSize) {
    const direction = parseInt(newSize) > parseInt(oldSize) ? '大きく' : '小さく';
    findings.push({
      category: 'typography',
      key: 'font_size_preference',
      insight: `フォントサイズを ${oldSize}px → ${newSize}px に${direction}した`,
      value: parseInt(newSize),
      confidence: 'HIGH',
    });
  }
}

const fwChange = addedLines.find(l => /fontWeight:\s*\d+/.test(l));
const fwOld = removedLines.find(l => /fontWeight:\s*\d+/.test(l));
if (fwChange && fwOld) {
  const newW = fwChange.match(/fontWeight:\s*(\d+)/)?.[1];
  const oldW = fwOld.match(/fontWeight:\s*(\d+)/)?.[1];
  if (newW !== oldW) {
    findings.push({
      category: 'typography',
      key: 'font_weight_preference',
      insight: `fontWeightを${oldW}→${newW}に変更。${parseInt(newW) > parseInt(oldW) ? 'より太く' : 'より細く'}することを好む`,
      value: parseInt(newW),
      confidence: 'HIGH',
    });
  }
}

const lsChange = addedLines.find(l => /letterSpacing:/.test(l));
const lsOld = removedLines.find(l => /letterSpacing:/.test(l));
if (lsChange && lsOld && lsChange !== lsOld) {
  findings.push({
    category: 'typography',
    key: 'letter_spacing_preference',
    insight: `letterSpacingを調整。new: ${lsChange.trim()} / old: ${lsOld.trim()}`,
    confidence: 'MEDIUM',
  });
}

// ── 2b. Color changes ──────────────────────────
const colorAdded = addedLines.filter(l => /#[0-9A-Fa-f]{6}/.test(l));
const colorRemoved = removedLines.filter(l => /#[0-9A-Fa-f]{6}/.test(l));
if (colorAdded.length > 0) {
  const newColors = [...new Set(colorAdded.flatMap(l => l.match(/#[0-9A-Fa-f]{6}/g) || []))];
  const oldColors = [...new Set(colorRemoved.flatMap(l => l.match(/#[0-9A-Fa-f]{6}/g) || []))];
  const changedColors = newColors.filter(c => !oldColors.includes(c));
  if (changedColors.length > 0) {
    findings.push({
      category: 'color',
      key: 'color_preference',
      insight: `新しいカラー ${changedColors.join(', ')} を採用`,
      value: changedColors,
      confidence: 'HIGH',
    });
  }
}

// ── 2c. Copy / text changes ────────────────────
const copyAdded = addedLines.filter(l => /[^\w][\u3040-\u30FF\u4E00-\u9FFF]{3,}/.test(l));
const copyRemoved = removedLines.filter(l => /[^\w][\u3040-\u30FF\u4E00-\u9FFF]{3,}/.test(l));
if (copyAdded.length > 0 && copyRemoved.length > 0) {
  const extractText = lines => lines
    .map(l => l.match(/>(.*?)</)?.[1] || l.match(/text=["'`](.*?)["'`]/)?.[1])
    .filter(Boolean)
    .join(' / ');
  const added = extractText(copyAdded);
  const removed = extractText(copyRemoved);
  if (added && removed) {
    findings.push({
      category: 'copy',
      key: 'copy_preference',
      insight: `コピー変更: "${removed}" → "${added}"`,
      reasoning: 'ユーザーがGUI編集で選んだコピーの方向性',
      confidence: 'HIGH',
    });
  }
}

// ── 2d. Timing / frame changes ─────────────────
const timingAdded = addedLines.find(l => /dur:\s*\d+/.test(l) || /durationInFrames={\d+}/.test(l));
const timingOld = removedLines.find(l => /dur:\s*\d+/.test(l) || /durationInFrames={\d+}/.test(l));
if (timingAdded && timingOld) {
  const newDur = timingAdded.match(/(\d{2,})/)?.[1];
  const oldDur = timingOld.match(/(\d{2,})/)?.[1];
  if (newDur !== oldDur) {
    const direction = parseInt(newDur) > parseInt(oldDur) ? '長く' : '短く';
    findings.push({
      category: 'timing',
      key: 'scene_duration_preference',
      insight: `シーン尺を${oldDur}f → ${newDur}f に${direction}した (${direction === '長く' ? '+' : ''}${parseInt(newDur) - parseInt(oldDur)}f)`,
      value: parseInt(newDur),
      confidence: 'MEDIUM',
    });
  }
}

// ── 2e. Animation / effect changes ─────────────
const springAdded = addedLines.find(l => /spring\(|interpolate\(/.test(l));
if (springAdded) {
  const dampingMatch = springAdded.match(/damping:\s*(\d+)/);
  const stiffMatch = springAdded.match(/stiffness:\s*(\d+)/);
  if (dampingMatch || stiffMatch) {
    findings.push({
      category: 'animation',
      key: 'animation_speed',
      insight: `アニメーション調整: damping=${dampingMatch?.[1] || '?'}, stiffness=${stiffMatch?.[1] || '?'}`,
      confidence: 'LOW',
    });
  }
}

console.log(`\n🔍 検出した知見: ${findings.length}件`);
findings.forEach((f, i) => {
  console.log(`  [${f.confidence}] ${f.category}: ${f.insight}`);
});

// ── Step 3: learned_preferences.json に追記 ────
const existing = fs.existsSync(LEARN_FILE)
  ? JSON.parse(fs.readFileSync(LEARN_FILE, 'utf8'))
  : { meta: { version: '1.0', description: 'GUI編集からの自動学習ログ' }, sessions: [] };

const session = {
  timestamp: new Date().toISOString(),
  source: path.basename(TSX_PATH),
  findings_count: findings.length,
  findings,
};

if (!DRY_RUN && findings.length > 0) {
  existing.sessions.unshift(session);
  // 最新50セッションのみ保持
  existing.sessions = existing.sessions.slice(0, 50);
  fs.writeFileSync(LEARN_FILE, JSON.stringify(existing, null, 2));
  console.log(`\n✅ learned_preferences.json に ${findings.length} 件の知見を保存`);
} else if (DRY_RUN) {
  console.log('\n🔵 (dry-run) 保存スキップ');
}

// ── Step 4: CREATIVE_BRIEF.md の学習済みセクションを更新 ──
if (!DRY_RUN && findings.length > 0) {
  const brief = fs.readFileSync(BRIEF_FILE, 'utf8');
  const learnSection = `
## 📚 学習済みユーザー好み（自動生成 - 上書き禁止）

> 最終更新: ${new Date().toLocaleString('ja-JP')}

${findings.map(f => `- **[${f.category}]** ${f.insight}`).join('\n')}
`;

  const updatedBrief = brief.includes('## 📚 学習済みユーザー好み')
    ? brief.replace(/## 📚 学習済みユーザー好み[\s\S]*$/, learnSection)
    : brief + '\n' + learnSection;

  fs.writeFileSync(BRIEF_FILE, updatedBrief);
  console.log('✅ CREATIVE_BRIEF.md に学習済み好みセクションを更新');
}

// ── Step 5: creative_style_guide.md を自動生成（次回生成への自動注入） ──
if (!DRY_RUN) {
  const allSessions = fs.existsSync(LEARN_FILE)
    ? JSON.parse(fs.readFileSync(LEARN_FILE, 'utf8')).sessions || []
    : [];

  // 全セッションの知見を集約してカテゴリ別にまとめる
  const byCategory = {};
  allSessions.forEach(s => {
    (s.findings || []).forEach(f => {
      if (!byCategory[f.category]) byCategory[f.category] = [];
      byCategory[f.category].push({ insight: f.insight, confidence: f.confidence, ts: s.timestamp });
    });
  });

  // カテゴリ別に最新N件を取得
  const TOP_N = 5;
  const guideLines = Object.entries(byCategory).map(([cat, items]) => {
    const recent = items.slice(0, TOP_N);
    const lines = recent.map(i => `  - [${i.confidence}] ${i.insight}`).join('\n');
    return `### ${cat}\n${lines}`;
  }).join('\n\n');

  const styleGuide = `# Creative Style Guide（自動生成）

> このファイルは \`creative_learn.js\` が自動生成します。直接編集しないこと。
> 最終更新: ${new Date().toLocaleString('ja-JP')}
> 学習セッション数: ${allSessions.length}

---

## 🎨 ユーザー学習済み好み（/ad review・/ad build で自動適用）

${guideLines || '(まだ学習データがありません)'}

---

## ✅ 適用ルール

次のコンポーネントを生成・修正する際は、上記の好みを **最優先で反映** すること:
- LpAd.tsx の全シーン
- SceneHook / SceneBreak / SceneAgitation / SceneSolution / SceneCTA
- SCENE定数 (dur) の調整
- カラートークン定義
`;

  fs.writeFileSync(STYLE_GUIDE, styleGuide);
  console.log(`✅ creative_style_guide.md を生成 (${allSessions.length} セッション分を集約)`);
}

// ── Summary ────────────────────────────────────
console.log('\n' + '─'.repeat(60));
console.log('📊 学習ループ完了');
console.log(`  発見した知見: ${findings.length} 件`);
console.log(`  学習ファイル: ${LEARN_FILE}`);
console.log(`  次回 /ad review でCreative Boardへ自動注入されます`);
if (findings.length === 0) {
  console.log('\n  ℹ️  差分が少なく知見を抽出できませんでした。');
  console.log('  Remotion Studioで編集してから再実行してください。');
}

process.exit(0);
