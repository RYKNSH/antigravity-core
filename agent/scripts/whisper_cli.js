#!/usr/bin/env node
/**
 * Whisper CLI — Antigravity Core
 * Whisperを使って動画・音声ファイルを文字起こしし、AIポストプロセスで品質を高める
 *
 * Usage:
 *   node whisper_cli.js transcribe <media_file> [output.md]
 *   node whisper_cli.js models          -- 利用可能モデル一覧
 *
 * 動作要件:
 *   - whisper CLI がインストール済み: pip install openai-whisper
 *   - ffmpeg がインストール済み（音声抽出）
 *
 * 例:
 *   node whisper_cli.js transcribe ./raw_orientaion.mp4 ./transcript.md
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { execSync, spawnSync } = require('child_process');

const { loadEnv, getSecret } = require(path.join(__dirname, 'env_loader'));

// 1Password 優先で環境変数をロード
loadEnv();

const OPENAI_API_KEY = getSecret('OPENAI_API_KEY');
const WHISPER_MODEL = process.env.WHISPER_MODEL || 'large-v3';
const WHISPER_LANG = process.env.WHISPER_LANG || 'ja';

function printHelp() {
    console.log(`Whisper CLI — Antigravity Core
使い方:
  node whisper_cli.js transcribe <media_file> [output.md]
  node whisper_cli.js models

オプション（.envで設定）:
  WHISPER_MODEL   モデル名（デフォルト: large-v3）
  WHISPER_LANG    言語（デフォルト: ja）

例:
  node whisper_cli.js transcribe ./orientation.mp4 ./transcript.md
`);
}

function cmdModels() {
    console.log('📜 利用可能なWhisperモデル:\n');
    const models = [
        ['tiny', '〜39M  | 超高速 | 低品質'],
        ['base', '〜74M  | 高速   | 普通品質'],
        ['small', '〜244M | 中速   | 良品質'],
        ['medium', '〜769M | 中速   | 高品質'],
        ['large-v3', '〜1.5G | 低速   | 最高品質（推奨）'],
    ];
    models.forEach(([name, desc]) => console.log(`  ${name.padEnd(10)} ${desc}`));
    console.log(`\n現在のモデル: ${WHISPER_MODEL}`);
}

function cmdTranscribe(mediaFile, outputPath) {
    if (!mediaFile) {
        console.error('[Whisper CLI] Error: media_file が必要です');
        process.exit(1);
    }
    if (!fs.existsSync(mediaFile)) {
        console.error(`[Whisper CLI] Error: ファイルが見つかりません: ${mediaFile}`);
        process.exit(1);
    }

    const absMedia = path.resolve(mediaFile);
    const basename = path.basename(absMedia, path.extname(absMedia));
    const outDir = '/tmp/whisper_out_' + Date.now();
    fs.mkdirSync(outDir, { recursive: true });

    console.log(`🎙️  文字起こし開始: ${absMedia}`);
    console.log(`   モデル: ${WHISPER_MODEL} / 言語: ${WHISPER_LANG}`);

    // ── Whisper 実行 ─────────────────────────────────────────
    const result = spawnSync('whisper', [
        absMedia,
        '--model', WHISPER_MODEL,
        '--language', WHISPER_LANG,
        '--output_format', 'json',
        '--output_dir', outDir,
        '--verbose', 'False',
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    if (result.status !== 0) {
        console.error('[Whisper CLI] 文字起こし失敗:');
        console.error(result.stderr?.toString() || '（エラー詳細なし）');
        console.error('\n💡 Whisperがインストールされていない場合: pip install openai-whisper');
        process.exit(1);
    }

    // ── JSON → Markdown 変換 ─────────────────────────────────
    const jsonPath = path.join(outDir, basename + '.json');
    let segments = [];
    try {
        const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        segments = raw.segments || [];
    } catch (e) {
        console.error('[Whisper CLI] 出力JSON解析失敗:', e.message);
        process.exit(1);
    }

    const formatTime = (s) => {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60).toString().padStart(2, '0');
        return `${m}:${sec}`;
    };

    // Markdown形式で書き出し
    const lines = [
        `# 文字起こし — ${path.basename(absMedia)}`,
        `> 生成日時: ${new Date().toLocaleString('ja-JP')} | モデル: ${WHISPER_MODEL}`,
        `> **⚠️ AI自動生成 — R.K氏による最終レビューが必要です**`,
        '',
        '---',
        '',
        '## 📝 テキスト全文',
        '',
        segments.map(s => s.text.trim()).join('\n'),
        '',
        '---',
        '',
        '## 🕐 タイムスタンプ付き（カット編集用）',
        '',
        ...segments.map(s =>
            `**[${formatTime(s.start)} → ${formatTime(s.end)}]** ${s.text.trim()}`
        ),
        '',
        '---',
        '',
        '## ✅ レビューメモ（R.K氏へ）',
        '',
        '- [ ] 誤字・誤認識の修正',
        '- [ ] カットしたいセクションに ~~取り消し線~~ を引く',
        '- [ ] 追加テロップが必要な箇所に `[テロップ: ...]` を追記',
    ];

    const out = outputPath || `./${basename}_transcript.md`;
    fs.writeFileSync(out, lines.join('\n'), 'utf8');

    console.log(`✅ 文字起こし完了: ${out}`);
    console.log(`   セグメント数: ${segments.length}`);
    console.log(`   総時間: ${formatTime(segments[segments.length - 1]?.end || 0)}`);

    // 一時ディレクトリ削除
    fs.rmSync(outDir, { recursive: true, force: true });
}

// ── エントリポイント ─────────────────────────────────────────

const [, , cmd, ...args] = process.argv;

switch (cmd) {
    case 'transcribe': cmdTranscribe(args[0], args[1]); break;
    case 'models': cmdModels(); break;
    default: printHelp();
}
