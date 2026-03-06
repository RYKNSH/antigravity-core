#!/usr/bin/env node
/**
 * Remotion CLI — Antigravity Core
 * Remotionテンプレートを使って動画をレンダリングするラッパースクリプト
 *
 * Usage:
 *   node remotion_cli.js list-templates
 *   node remotion_cli.js render <template> <config_json_or_file> [output.mp4]
 *   node remotion_cli.js preview <template>
 *
 * 例（インラインJSON）:
 *   node remotion_cli.js render hook '{"title":"今だけ","subtitle":"AIの力を手に"}' ./hook.mp4
 *
 * 例（JSONファイル指定）:
 *   node remotion_cli.js render hook ./config/solopro.json ./hook.mp4
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { execSync, spawnSync } = require('child_process');

const TEMPLATES_DIR = path.join(process.env.HOME, '.antigravity', 'media', 'remotion', 'templates');
const REMOTION_PACKAGE = path.join(process.env.HOME, '.antigravity', 'media', 'remotion');

function printHelp() {
    console.log(`Remotion CLI — Antigravity Core
Usage:
  node remotion_cli.js list-templates
  node remotion_cli.js render <template> <config_json> [output.mp4]
  node remotion_cli.js preview <template>

利用可能テンプレート: hook / proof / demo / op-ed

例:
  node remotion_cli.js render hook '{"title":"今だけ限定","subtitle":"AIの力を手に","duration":30}' ./hook.mp4
  node remotion_cli.js preview op-ed
`);
}

function cmdListTemplates() {
    if (!fs.existsSync(TEMPLATES_DIR)) {
        console.error(`⚠️  テンプレートディレクトリが見つかりません: ${TEMPLATES_DIR}`);
        process.exit(1);
    }
    const templates = fs.readdirSync(TEMPLATES_DIR).filter(d =>
        fs.statSync(path.join(TEMPLATES_DIR, d)).isDirectory()
    );
    console.log(`🎬 利用可能なRemotionテンプレート — ${templates.length} 件\n`);
    const descriptions = {
        'hook': '冒頭フック型（広告冒頭 / 0-3秒で掴む）',
        'proof': '実績・証拠型（スクショ・数字・お客様の声）',
        'demo': 'デモ・説明型（製品・サービスの使い方）',
        'op-ed': 'OP/EDブランドアニメーション（5秒）',
    };
    templates.forEach(t => {
        const desc = descriptions[t] || '（説明なし）';
        console.log(`  [${t}] ${desc}`);
    });
}

function cmdRender(template, configArg, outputPath) {
    if (!template || !configArg) {
        console.error('template と config が必要です（JSON文字列またはファイルパス）');
        process.exit(1);
    }

    // JSONファイルパスかインラインJSONかを判定
    let config;
    try {
        if (configArg.endsWith('.json') && fs.existsSync(configArg)) {
            const raw = fs.readFileSync(configArg, 'utf8');
            const allConfigs = JSON.parse(raw);
            // ファイルが全テンプレート設定を持つ場合、テンプレートキーで取得
            config = allConfigs[template] || allConfigs;
        } else {
            config = JSON.parse(configArg);
        }
    } catch (e) {
        console.error('config のJSON解析に失敗しました:', e.message);
        process.exit(1);
    }

    const templateDir = path.join(TEMPLATES_DIR, template);
    if (!fs.existsSync(templateDir)) {
        console.error(`テンプレートが見つかりません: ${template}`);
        console.error(`利用可能: hook / proof / demo / op-ed`);
        process.exit(1);
    }

    const out = outputPath || `./remotion_${template}_${Date.now()}.mp4`;

    // config を一時ファイルに書き出してRemotionに渡す
    const tmpConfig = `/tmp/remotion_config_${Date.now()}.json`;
    fs.writeFileSync(tmpConfig, JSON.stringify(config));

    console.log(`🎬 レンダリング開始: ${template} → ${out}`);
    console.log(`   設定: ${JSON.stringify(config)}`);

    // composition IDマッピング（op-ed はそのままIDとして使用）
    const compositionId = template; // index.tsx の Composition id に対応

    const result = spawnSync('npx', [
        'remotion', 'render',
        path.join(REMOTION_PACKAGE, 'src', 'index.tsx'),
        compositionId,
        out,
        '--props', tmpConfig,
    ], {
        cwd: REMOTION_PACKAGE,
        stdio: 'inherit',
        timeout: 180000,
    });

    fs.unlinkSync(tmpConfig);

    if (result.status !== 0) {
        console.error('❌ レンダリング失敗');
        process.exit(1);
    }
    console.log(`✅ レンダリング完了: ${out}`);
}

function cmdPreview(template) {
    if (!template) { console.error('template が必要です'); process.exit(1); }
    console.log(`🔍 プレビュー起動: ${template}`);
    spawnSync('npx', ['remotion', 'studio'], {
        cwd: REMOTION_PACKAGE,
        stdio: 'inherit',
        env: { ...process.env, REMOTION_COMPONENT: template },
    });
}

// ── エントリポイント ────────────────────────────────────────

const [, , cmd, ...args] = process.argv;

switch (cmd) {
    case 'list-templates': cmdListTemplates(); break;
    case 'render': cmdRender(args[0], args[1], args[2]); break;  // config = JSONファイルパス or インラインJSON
    case 'preview': cmdPreview(args[0]); break;
    default: printHelp();
}
