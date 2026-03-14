#!/usr/bin/env node
/**
 * creative_watch.js — ファイルウォッチャー
 *
 * LpAd.tsxの保存を検知して creative_learn.js を自動実行する。
 * /ad studio と同時に起動されることを想定。
 *
 * 使用方法:
 *   node creative_watch.js &   (バックグラウンド起動)
 *   node creative_watch.js     (フォアグラウンド)
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

const WATCH_FILE = path.join(__dirname, '../../media/remotion/src/templates/lp/LpAd.tsx');
const LEARN_SCRIPT = path.join(__dirname, 'creative_learn.js');
const DEBOUNCE_MS = 800; // 連続保存を間引く

let debounceTimer = null;
let lastMtime = null;

console.log('👁️  creative_watch.js 起動');
console.log(`📂 監視: ${path.basename(WATCH_FILE)}`);
console.log('─────────────────────────────────────────');
console.log('💡 Remotion Studioで編集して保存すると自動学習します');
console.log('   Ctrl+C で停止\n');

function runLearn() {
  console.log('\n🔄 変更検知 → creative_learn.js を実行します...');
  try {
    const output = execSync(`node "${LEARN_SCRIPT}" --file "${WATCH_FILE}"`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    console.log(output);
  } catch (e) {
    console.error('❌ 学習スクリプトエラー:', e.message);
  }
  console.log('─────────────────────────────────────────');
  console.log('✅ 学習完了。次回 /ad review で自動反映されます。続けて編集できます。\n');
}

// ポーリングで監視（macOS のfseventsが不安定なケースに対応）
setInterval(() => {
  try {
    const stat = fs.statSync(WATCH_FILE);
    const mtime = stat.mtimeMs;
    if (lastMtime !== null && mtime !== lastMtime) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(runLearn, DEBOUNCE_MS);
    }
    lastMtime = mtime;
  } catch (_) {}
}, 500);
