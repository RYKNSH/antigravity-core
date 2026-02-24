#!/usr/bin/env node
/**
 * check_dependency_map.js
 * dependency_map.json の整合性チェック
 *
 * チェック内容:
 * 1. JSON lint（パース可能か）
 * 2. _meta バージョン確認
 * 3. brain_log フォーマット仕様 (INCIDENT_FORMAT.md) の存在確認
 * 4. workflows の参照ファイル実在チェック
 * 5. scripts の参照ファイル実在チェック（future: true は info のみ）
 * 6. hang_correlation の affected コンポーネント確認 (--strict)
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

// ① main() 関数に全処理を収める
async function main() {
    let errors = 0;
    let warnings = 0;

    const ok = (msg) => console.log(`  ✅ ${msg}`);
    const warn = (msg) => { console.warn(`  ⚠️  ${msg}`); warnings++; };
    const fail = (msg) => { console.error(`  ❌ ${msg}`); errors++; };
    const info = (msg) => console.log(`  ℹ️  ${msg}`);

    // ══════════════════════════════════════════
    // Check 1: JSON lint
    // ══════════════════════════════════════════
    console.log('\n📋 Check 1: JSON lint');
    let map;
    try {
        map = JSON.parse(fs.readFileSync(MAP_PATH, 'utf8'));
        ok('dependency_map.json は有効なJSONです');
    } catch (e) {
        fail(`dependency_map.json のパースに失敗: ${e.message}`);
        process.exit(1);
    }

    // ══════════════════════════════════════════
    // Check 2: _meta バージョン確認
    // ══════════════════════════════════════════
    console.log('\n📋 Check 2: _meta バージョン');
    if (map._meta?.version) {
        ok(`version: ${map._meta.version}`);
    } else {
        warn('_meta.version が未定義です');
    }

    // ══════════════════════════════════════════
    // Check 3: brain_log format_spec ファイルの存在
    // ══════════════════════════════════════════
    console.log('\n📋 Check 3: brain_log format_spec ファイル実在確認');
    if (map.brain_log?.format_spec) {
        const formatFile = path.join(ANTIGRAVITY_DIR, map.brain_log.format_spec);
        fs.existsSync(formatFile)
            ? ok(`${map.brain_log.format_spec} が実在します`)
            : fail(`${map.brain_log.format_spec} が見つかりません: ${formatFile}`);
    }

    // ══════════════════════════════════════════
    // Check 4: workflows 参照ファイル実在チェック
    // ══════════════════════════════════════════
    console.log('\n📋 Check 4: workflows 参照ファイル実在確認');
    const wfs = map.workflows || {};
    for (const [name, wf] of Object.entries(wfs)) {
        if (!wf.file) { warn(`workflows.${name}: file フィールドなし`); continue; }
        const wfPath = path.join(ANTIGRAVITY_DIR, wf.file);
        fs.existsSync(wfPath)
            ? ok(`workflows.${name}: ${wf.file}`)
            : fail(`workflows.${name}: ${wf.file} が見つかりません`);
    }

    // ══════════════════════════════════════════
    // Check 5: scripts 実在確認
    // ② KNOWN_MISSINGのハードコードを廃止し dependency_map.json の future フラグを参照
    // ══════════════════════════════════════════
    console.log('\n📋 Check 5: scripts 実在確認');
    const scripts = map.scripts || {};
    for (const [name, meta] of Object.entries(scripts)) {
        const scriptPath = path.join(ANTIGRAVITY_DIR, 'agent', 'scripts', name);
        if (fs.existsSync(scriptPath)) {
            ok(`scripts.${name}`);
        } else if (meta.future === true) {
            // ② dependency_map.json の future: true が単一ソース — info のみ
            info(`scripts.${name} — future: true（将来実装予定: ${meta.purpose || '詳細未定'}）`);
        } else {
            // 未定義の不在 → error でCIブロック
            fail(`scripts.${name} が見つかりません（future: true 未設定 — 削除またはフラグ追加が必要）`);
        }
    }

    // ══════════════════════════════════════════
    // Check 6: hang_correlation の affected 確認 (--strict)
    // ══════════════════════════════════════════
    if (STRICT) {
        console.log('\n📋 Check 6: hang_correlation affected コンポーネント確認 (--strict)');
        const hc = map.hang_correlation || {};
        const definedWFs = new Set(Object.keys(wfs));
        const definedScripts = new Set(Object.keys(scripts));

        for (const [key, entry] of Object.entries(hc)) {
            if (key === 'description') continue;
            for (const a of (entry.affected || [])) {
                const component = a.split(' ')[0];
                if (!definedWFs.has(component) && !definedScripts.has(component)) {
                    warn(`hang_correlation.${key}: affected コンポーネント "${component}" が未定義`);
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
    } else {
        console.log('✅ 全チェック通過');
    }
}

main().catch((err) => {
    console.error('❌ 予期しないエラー:', err.message);
    process.exit(1);
});
