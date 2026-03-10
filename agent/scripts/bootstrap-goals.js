#!/usr/bin/env node
/**
 * bootstrap-goals.js — Task 8.1.1
 * 現状コードベースを計測して初期品質目標値を自動設定する。
 * 計測値 × 0.9 と ABSOLUTE_FLOORS の大きい方を閾値として保存。
 * 出力: ~/.antigravity/quality/goals.json
 */

'use strict';

const { execSync } = require('child_process');
const fs            = require('fs');
const path          = require('path');

// ─── 定数 ───────────────────────────────────────────────────────────────────
const ANTIGRAVITY_DIR = process.env.ANTIGRAVITY_DIR || path.join(process.env.HOME, '.antigravity');
const QUALITY_DIR     = path.join(ANTIGRAVITY_DIR, 'quality');
const GOALS_FILE      = path.join(QUALITY_DIR, 'goals.json');

/** 下限フロア: 現状値がどれだけ低くても、これ以下の目標は設定しない */
const ABSOLUTE_FLOORS = {
  quality_pass_rate : 0.50,   // 50% pass 以下は非許容
  lightness_kb      : 10240,  // 10 MB 超は警告だが下限なし（Infinity）
  speed_lighthouse  : 30,     // Lighthouse 30% 以下は設計上問題なし
};

// ─── ユーティリティ ──────────────────────────────────────────────────────────
function tryExec(cmd, cwd, timeoutMs = 30_000) {
  try {
    return execSync(cmd, { cwd, timeout: timeoutMs, encoding: 'utf8', stdio: ['pipe','pipe','pipe'] });
  } catch (_) {
    return null;
  }
}

function nowISO() { return new Date().toISOString(); }

// ─── 計測関数 ────────────────────────────────────────────────────────────────

/**
 * npm test の pass 率を取得。
 * jest / vitest / mocha いずれかのサマリー行を簡易パース。
 */
function measureQuality(cwd = process.cwd()) {
  const out = tryExec('npm test -- --no-coverage 2>&1 | tail -20', cwd, 60_000);
  if (!out) return 0.8; // テスト未設定時は cold_start デフォルト

  // jest: "Tests: N failed, M passed, T total"
  const jestMatch = out.match(/Tests?:\s+(?:(\d+)\s+failed,\s*)?(\d+)\s+passed,\s*(\d+)\s+total/i);
  if (jestMatch) {
    const passed = parseInt(jestMatch[2], 10);
    const total  = parseInt(jestMatch[3], 10);
    return total > 0 ? passed / total : 0.8;
  }

  // mocha: "passing" / "failing"
  const passMatch    = out.match(/(\d+)\s+passing/i);
  const failingMatch = out.match(/(\d+)\s+failing/i);
  if (passMatch) {
    const pass = parseInt(passMatch[1], 10);
    const fail = failingMatch ? parseInt(failingMatch[1], 10) : 0;
    return (pass + fail) > 0 ? pass / (pass + fail) : 0.8;
  }

  console.log('  ※ テストサマリーを自動判定できませんでした。デフォルト 0.8 を使用します。');
  return 0.8;
}

/**
 * bundle KB 計測。
 * dist/ または build/ の合計ファイルサイズ（KB）を返す。
 */
function measureLightnessKb(cwd = process.cwd()) {
  for (const dir of ['dist', 'build', '.next', 'out']) {
    const target = path.join(cwd, dir);
    if (!fs.existsSync(target)) continue;
    const out = tryExec(`du -sk "${target}"`, cwd);
    if (out) {
      const kb = parseInt(out.trim().split(/\s+/)[0], 10);
      if (!isNaN(kb) && kb > 0) return kb;
    }
  }
  return null; // バンドル対象なし
}

/**
 * Lighthouse スコア計測（CLI が未インストールの場合はスキップ）。
 */
function measureLighthouse(cwd = process.cwd()) {
  const hasCli = tryExec('which lighthouse 2>/dev/null', cwd, 3_000);
  if (!hasCli) return null;

  const out = tryExec(
    'lighthouse --output=json --quiet --chrome-flags="--headless --no-sandbox" http://localhost:3000 2>/dev/null | ' +
    'node -e "const d=JSON.parse(require(\'fs\').readFileSync(\'/dev/stdin\',\'utf8\')); console.log(Math.round(d.categories.performance.score*100))"',
    cwd, 60_000
  );
  if (!out) return null;
  const score = parseInt(out.trim(), 10);
  return isNaN(score) ? null : score;
}

// ─── メイン処理 ──────────────────────────────────────────────────────────────
function main() {
  console.log('🎯 bootstrap-goals.js — 品質目標値の初期設定を開始します');
  const cwd = process.cwd();

  // 既存 goals.json があれば上書きしない（再実行は --force オプション）
  const forceMode = process.argv.includes('--force');
  if (fs.existsSync(GOALS_FILE) && !forceMode) {
    console.log(`  ✅ ${GOALS_FILE} は既に存在します。再生成するには --force オプションを付けて実行してください。`);
    return;
  }

  // quality/ ディレクトリ作成
  fs.mkdirSync(QUALITY_DIR, { recursive: true });

  // ─── 各軸を計測 ───────────────────────────────────────────────────
  console.log('  📐 quality (npm test pass率) を計測中...');
  const rawQuality = measureQuality(cwd);
  console.log(`     現在値: ${(rawQuality * 100).toFixed(1)}%`);

  console.log('  📦 lightness (bundle KB) を計測中...');
  const rawKb = measureLightnessKb(cwd);
  console.log(`     現在値: ${rawKb != null ? rawKb + ' KB' : 'スキップ（バンドル対象なし）'}`);

  console.log('  🚀 speed (Lighthouse) を計測中...');
  const rawLighthouse = measureLighthouse(cwd);
  console.log(`     現在値: ${rawLighthouse != null ? rawLighthouse : 'スキップ（Lighthouse CLI 未インストール）'}`);

  // ─── 目標値を算出: 計測値 × 0.9 か ABSOLUTE_FLOORS の大きい方 ──
  const goals = {
    quality_pass_rate : Math.max(rawQuality * 0.9, ABSOLUTE_FLOORS.quality_pass_rate),
    _mode             : 'cold_start',
    _generated_at     : nowISO(),
    _cwd              : cwd,
  };

  if (rawKb != null) {
    // lightness は「小さいほど良い」ので目標は rawKb × 1.1（緩め方向で設定）
    goals.lightness_kb = rawKb * 1.1;
  }

  if (rawLighthouse != null) {
    goals.speed_lighthouse = Math.max(rawLighthouse * 0.9, ABSOLUTE_FLOORS.speed_lighthouse);
  }

  // ─── 保存 ─────────────────────────────────────────────────────────
  fs.writeFileSync(GOALS_FILE, JSON.stringify(goals, null, 2) + '\n', 'utf8');
  console.log(`\n  ✅ goals.json を生成しました: ${GOALS_FILE}`);
  console.log(`     quality_pass_rate : ${(goals.quality_pass_rate * 100).toFixed(1)}%`);
  if (goals.lightness_kb)    console.log(`     lightness_kb      : ${goals.lightness_kb} KB`);
  if (goals.speed_lighthouse) console.log(`     speed_lighthouse  : ${goals.speed_lighthouse}`);
  console.log(`     mode              : ${goals._mode}`);
}

main();
