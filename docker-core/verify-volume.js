#!/usr/bin/env node
/**
 * verify-volume.js — Volume マウント & State Hydration 検証スクリプト
 * 
 * コンテナ内で実行し、 ~/.antigravity/ が正しくマウントされ
 * .session_state.json が読み書きできることを確認する。
 *
 * MS 5.1.2 — Volume マウント検証
 *
 * Usage (コンテナ内から):
 *   node /antigravity/docker-core/verify-volume.js
 * 
 * Usage (Mac上テスト):
 *   node verify-volume.js
 */

const fs = require('fs');
const path = require('path');

const ANTIGRAVITY_DIR = process.env.ANTIGRAVITY_DIR || path.join(process.env.HOME, '.antigravity');
const STATE_FILE = path.join(ANTIGRAVITY_DIR, '.session_state.json');

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ❌ ${name}: ${e.message}`);
    failed++;
  }
}

console.log('\n🔍 Volume & State Hydration 検証\n');
console.log(`   ANTIGRAVITY_DIR = ${ANTIGRAVITY_DIR}`);
console.log(`   STATE_FILE      = ${STATE_FILE}\n`);

// 1. ディレクトリ存在確認
check('ANTIGRAVITY_DIR が存在する', () => {
  if (!fs.existsSync(ANTIGRAVITY_DIR)) throw new Error(`Not found: ${ANTIGRAVITY_DIR}`);
  const stat = fs.statSync(ANTIGRAVITY_DIR);
  if (!stat.isDirectory()) throw new Error('Not a directory');
});

// 2. 書き込み可能確認
check('ANTIGRAVITY_DIR に書き込みできる', () => {
  const testFile = path.join(ANTIGRAVITY_DIR, '.volume_test_tmp');
  fs.writeFileSync(testFile, 'ok');
  fs.unlinkSync(testFile);
});

// 3. .session_state.json の存在確認
check('.session_state.json が存在する', () => {
  if (!fs.existsSync(STATE_FILE)) throw new Error(`Not found: ${STATE_FILE}`);
});

// 4. JSON として正常にパースできる
check('.session_state.json が有効なJSONである', () => {
  const raw = fs.readFileSync(STATE_FILE, 'utf8');
  const parsed = JSON.parse(raw);
  if (typeof parsed !== 'object') throw new Error('Not an object');
});

// 5. State の書き込み & 再読み込み
check('.session_state.json の書き込み→再読み込みが一致する', () => {
  const raw = fs.readFileSync(STATE_FILE, 'utf8');
  const state = JSON.parse(raw);
  const sentinel = `verify_${Date.now()}`;
  state._volume_verify = sentinel;
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  const reread = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  if (reread._volume_verify !== sentinel) throw new Error('Read-after-write mismatch');
  // Clean up
  delete reread._volume_verify;
  fs.writeFileSync(STATE_FILE, JSON.stringify(reread, null, 2));
});

// 6. サブディレクトリ確認
const expectedDirs = ['docs', 'agent', 'knowledge'];
for (const d of expectedDirs) {
  const dirPath = path.join(ANTIGRAVITY_DIR, d);
  check(`サブディレクトリ ${d}/ が存在する`, () => {
    if (!fs.existsSync(dirPath)) throw new Error(`Not found: ${dirPath}`);
  });
}

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`  結果: ${passed} passed / ${failed} failed`);
if (failed === 0) {
  console.log('  🎉 Volume マウント & State Hydration 正常');
  process.exit(0);
} else {
  console.log('  ⚠️  異常を検出しました。docker-compose.yml のVolume設定を確認してください。');
  process.exit(1);
}
