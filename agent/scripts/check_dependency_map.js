#!/usr/bin/env node
/**
 * check_dependency_map.js
 * dependency_map.json の整合性チェック
 *
 * チェック内容:
 * 1. JSON lint（パース可能か）
 * 2. brain_log フォーマット仕様 (INCIDENT_FORMAT.md) の存在確認
 * 3. workflows/scripts の参照ファイル実在チェック（~/.antigravity 配下のみ）
 * 4. hang_correlation の affected コンポーネントが定義済みか
 *
 * 使用方法:
 *   node agent/scripts/check_dependency_map.js
 *   node agent/scripts/check_dependency_map.js --strict  # 全チェック実施
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const ANTIGRAVITY_DIR = process.env.ANTIGRAVITY_DIR || path.join(os.homedir(), '.antigravity');
const MAP_PATH = path.join(ANTIGRAVITY_DIR, 'dependency_map.json');
const STRICT = process.argv.includes('--strict');

// ② known_missing: 意図的に不在（将来実装予定）のスクリプトを明示リスト化
// このリスト外のスクリプトが不在の場合は error としてCIをブロックする
const KNOWN_MISSING = [
    'sync_private.js',   // 将来実装予定: checkout時のprivate repo sync
    'git_context.js',    // 将来実装予定: コンテキストスナップショット
    'session_state.js',  // 将来実装予定: セッションステート管理
];

let errors = 0;
let warnings = 0;

function ok(msg) { console.log(`  ✅ ${msg}`); }
function warn(msg) { console.warn(`  ⚠️  ${msg}`); warnings++; }
function fail(msg) { console.error(`  ❌ ${msg}`); errors++; }

function resolvePath(p) {
    return p.replace(/^~\//, os.homedir() + '/');
}

function fileExistsLocal(p) {
    // ~/ 配下かつワイルドカードなしのみチェック
    if (p.includes('*') || p.includes('?')) return true; // glob はスキップ
    if (!p.startsWith('~/') && !p.startsWith('/')) return true; // 相対パスはスキップ
    return fs.existsSync(resolvePath(p));
}

// ══════════════════════════════════════════
// Check 1: JSON lint
// ══════════════════════════════════════════
console.log('\n📋 Check 1: JSON lint');
let map;
try {
    const raw = fs.readFileSync(MAP_PATH, 'utf8');
    map = JSON.parse(raw);
    ok(`dependency_map.json は有効なJSONです`);
} catch (e) {
    fail(`dependency_map.json のパースに失敗: ${e.message}`);
    process.exit(1);
}

// ══════════════════════════════════════════
// Check 2: _meta バージョン確認
// ══════════════════════════════════════════
console.log('\n📋 Check 2: _meta バージョン');
if (map._meta && map._meta.version) {
    ok(`version: ${map._meta.version}`);
} else {
    warn('_meta.version が未定義です');
}

// ══════════════════════════════════════════
// Check 3: brain_log フォーマット仕様ファイルの存在
// ══════════════════════════════════════════
console.log('\n📋 Check 3: brain_log format_spec ファイル実在確認');
if (map.brain_log && map.brain_log.format_spec) {
    const formatFile = path.join(ANTIGRAVITY_DIR, map.brain_log.format_spec);
    if (fs.existsSync(formatFile)) {
        ok(`${map.brain_log.format_spec} が実在します`);
    } else {
        fail(`${map.brain_log.format_spec} が見つかりません: ${formatFile}`);
    }
}

// ══════════════════════════════════════════
// Check 4: workflows の参照ファイル実在チェック（ANTIGRAVITY_DIR配下のみ）
// ══════════════════════════════════════════
console.log('\n📋 Check 4: workflows 参照ファイル実在確認');
const wfs = map.workflows || {};
for (const [name, wf] of Object.entries(wfs)) {
    if (!wf.file) { warn(`workflows.${name}: file フィールドなし`); continue; }
    const wfPath = path.join(ANTIGRAVITY_DIR, wf.file);
    if (fs.existsSync(wfPath)) {
        ok(`workflows.${name}: ${wf.file}`);
    } else {
        fail(`workflows.${name}: ${wf.file} が見つかりません`);
    }
}

// ══════════════════════════════════════════
// Check 5: scripts の参照ファイル実在チェック
// ══════════════════════════════════════════
console.log('\n📋 Check 5: scripts 実在確認');
const scripts = map.scripts || {};
for (const [name] of Object.entries(scripts)) {
    const scriptPath = path.join(ANTIGRAVITY_DIR, 'agent', 'scripts', name);
    if (fs.existsSync(scriptPath)) {
        ok(`scripts.${name}`);
    } else if (KNOWN_MISSING.includes(name)) {
        // ② 意図的な不在（将来実装予定）→ infoのみ、CIブロックしない
        console.log(`  ℹ️  scripts.${name} — known_missing（将来実装予定）`);
    } else {
        // ② 未定義の不在 → errorとしてCIをブロック
        fail(`scripts.${name} が見つかりません（known_missingに未登録 — 削除またはリスト追加が必要）`);
    }
}

// ══════════════════════════════════════════
// Check 6: hang_correlation の affected コンポーネント確認
// ══════════════════════════════════════════
if (STRICT) {
    console.log('\n📋 Check 6: hang_correlation affected コンポーネント確認 (--strict)');
    const hc = map.hang_correlation || {};
    const definedWFs = new Set(Object.keys(wfs));
    const definedScripts = new Set(Object.keys(scripts));

    for (const [key, entry] of Object.entries(hc)) {
        if (key === 'description') continue;
        const affected = entry.affected || [];
        for (const a of affected) {
            // "checkin (git pull)" → "checkin" を抽出
            const component = a.split(' ')[0];
            if (!definedWFs.has(component) && !definedScripts.has(component)) {
                warn(`hang_correlation.${key}: affected コンポーネント "${component}" が workflows/scripts に未定義`);
            }
        }
    }
    ok('hang_correlation チェック完了');
}

// ══════════════════════════════════════════
// 結果サマリー
// ══════════════════════════════════════════
console.log('\n══════════════════════════════════════════');
console.log(`結果: ${errors} errors, ${warnings} warnings`);
if (errors > 0) {
    console.error('❌ チェック失敗 — CIをブロックします');
    process.exit(1);
} else if (warnings > 0) {
    console.warn('⚠️  警告あり — ただし続行可能');
    process.exit(0);
} else {
    console.log('✅ 全チェック通過');
    process.exit(0);
}
