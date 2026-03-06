#!/usr/bin/env node
/**
 * ffmpeg CLI — Antigravity Core
 * ASS字幕生成 + ffmpegコマンド自動生成で動画の自動ポストプロダクションを実現
 *
 * Usage:
 *   node ffmpeg_cli.js ass  <transcript.md> [output.ass]   -- 字幕ファイル生成
 *   node ffmpeg_cli.js burn <video.mp4> <subtitle.ass> [output.mp4]  -- 字幕焼き込み
 *   node ffmpeg_cli.js concat <op.mp4> <main.mp4> <ed.mp4> [output.mp4]  -- OP/ED結合
 *   node ffmpeg_cli.js info <video.mp4>  -- 動画情報表示
 *
 * 動作要件:
 *   - ffmpeg がインストール済み: brew install ffmpeg
 *
 * 例:
 *   node ffmpeg_cli.js ass ./transcript.md ./orientation.ass
 *   node ffmpeg_cli.js burn ./raw.mp4 ./orientation.ass ./final.mp4
 *   node ffmpeg_cli.js concat ./op.mp4 ./main.mp4 ./ed.mp4 ./complete.mp4
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { execSync, spawnSync } = require('child_process');

function printHelp() {
    console.log(`ffmpeg CLI — Antigravity Core
使い方:
  node ffmpeg_cli.js ass    <transcript.md> [output.ass]
  node ffmpeg_cli.js burn   <video.mp4> <subtitle.ass> [output.mp4]
  node ffmpeg_cli.js concat <op.mp4> <main.mp4> <ed.mp4> [output.mp4]
  node ffmpeg_cli.js info   <video.mp4>

例（オリエン動画 完全パイプライン）:
  1. node whisper_cli.js transcribe ./raw.mp4 ./transcript.md
  2. R.K氏 transcript.md レビュー
  3. node ffmpeg_cli.js ass ./transcript.md ./subtitle.ass
  4. node ffmpeg_cli.js burn ./raw.mp4 ./subtitle.ass ./main_with_sub.mp4
  5. node remotion_cli.js render op-ed config/solopro.json ./op.mp4
  6. node ffmpeg_cli.js concat ./op.mp4 ./main_with_sub.mp4 ./op.mp4 ./final.mp4
`);
}

// ── Markdown文字起こし → ASS字幕 変換 ────────────────────────────

function parseTranscriptMarkdown(mdPath) {
    const content = fs.readFileSync(mdPath, 'utf8');
    const segments = [];

    // タイムスタンプ行: **[M:SS → M:SS]** テキスト
    const regex = /\*\*\[(\d+):(\d+)\s*→\s*(\d+):(\d+)\]\*\*\s*(.+)/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
        const startSec = parseInt(match[1]) * 60 + parseInt(match[2]);
        const endSec = parseInt(match[3]) * 60 + parseInt(match[4]);
        let text = match[5].trim();

        // 取り消し線は削除（カット済み）
        if (text.startsWith('~~') && text.endsWith('~~')) continue;
        // テロップ指示を抽出
        const telopMatch = text.match(/\[テロップ:\s*(.+?)\]/);
        if (telopMatch) text = telopMatch[1].trim();
        // 句読点で改行（35文字以上の場合）
        if (text.length > 35) {
            text = text.replace(/(。|、|！|？)/g, '$1\\N');
        }

        segments.push({ start: startSec, end: endSec, text });
    }
    return segments;
}

function secToAss(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    const cs = Math.round((sec - Math.floor(sec)) * 100);
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function cmdAss(transcriptPath, outputPath) {
    if (!transcriptPath || !fs.existsSync(transcriptPath)) {
        console.error('[ffmpeg CLI] transcript.md が見つかりません:', transcriptPath);
        process.exit(1);
    }

    const segments = parseTranscriptMarkdown(transcriptPath);
    if (segments.length === 0) {
        console.error('[ffmpeg CLI] タイムスタンプ付きセグメントが見つかりません');
        console.error('  whisper_cli.js transcribe で生成した .md ファイルを使用してください');
        process.exit(1);
    }

    // ── ASS ヘッダー（SOLOPROブランドスタイル）──────────────────
    const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Noto Sans JP,72,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,1,0,1,3,2,2,80,80,160,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

    const events = segments.map(s => {
        // フェードイン/アウト（150ms）
        const fadeEffect = '{\\fad(150,100)}';
        return `Dialogue: 0,${secToAss(s.start)},${secToAss(s.end)},Default,,0,0,0,,${fadeEffect}${s.text}`;
    });

    const out = outputPath || transcriptPath.replace('.md', '.ass');
    fs.writeFileSync(out, header + events.join('\n') + '\n', 'utf8');

    console.log(`✅ ASS字幕生成完了: ${out}`);
    console.log(`   セグメント数: ${segments.length}`);
}

// ── 字幕焼き込み ──────────────────────────────────────────────

function cmdBurn(videoPath, assPath, outputPath) {
    if (!videoPath || !assPath) {
        console.error('[ffmpeg CLI] video と subtitle が必要です');
        process.exit(1);
    }
    if (!fs.existsSync(videoPath)) { console.error('動画ファイルが見つかりません:', videoPath); process.exit(1); }
    if (!fs.existsSync(assPath)) { console.error('字幕ファイルが見つかりません:', assPath); process.exit(1); }

    const out = outputPath || videoPath.replace(/\.(mp4|mov)$/, '_subtitled.mp4');
    const absAss = path.resolve(assPath).replace(/\\/g, '/');

    console.log(`🎬 字幕焼き込み開始...`);
    console.log(`   入力: ${videoPath}`);
    console.log(`   字幕: ${assPath}`);
    console.log(`   出力: ${out}`);

    const result = spawnSync('ffmpeg', [
        '-i', videoPath,
        '-vf', `ass=${absAss}`,
        '-c:v', 'libx264',
        '-crf', '18',
        '-preset', 'slow',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-y', out,
    ], { stdio: 'inherit', timeout: 600000 });

    if (result.status !== 0) {
        console.error('❌ 字幕焼き込み失敗');
        process.exit(1);
    }
    console.log(`✅ 完了: ${out}`);
}

// ── OP/ED 結合 ────────────────────────────────────────────────

function cmdConcat(opPath, mainPath, edPath, outputPath) {
    if (!opPath || !mainPath || !edPath) {
        console.error('[ffmpeg CLI] op / main / ed の3ファイルが必要です');
        process.exit(1);
    }

    const out = outputPath || './final_with_oped.mp4';
    const listFile = '/tmp/ffmpeg_concat_list_' + Date.now() + '.txt';

    fs.writeFileSync(listFile, [
        `file '${path.resolve(opPath)}'`,
        `file '${path.resolve(mainPath)}'`,
        `file '${path.resolve(edPath)}'`,
    ].join('\n'));

    console.log(`🎬 OP/ED結合開始...`);
    console.log(`   OP:   ${opPath}`);
    console.log(`   MAIN: ${mainPath}`);
    console.log(`   ED:   ${edPath}`);
    console.log(`   出力: ${out}`);

    const result = spawnSync('ffmpeg', [
        '-f', 'concat',
        '-safe', '0',
        '-i', listFile,
        '-c:v', 'libx264',
        '-crf', '18',
        '-preset', 'slow',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-y', out,
    ], { stdio: 'inherit', timeout: 600000 });

    fs.unlinkSync(listFile);

    if (result.status !== 0) {
        console.error('❌ 結合失敗');
        process.exit(1);
    }
    console.log(`✅ 結合完了: ${out}`);
}

// ── 動画情報 ──────────────────────────────────────────────────

function cmdInfo(videoPath) {
    if (!videoPath) { console.error('video_path が必要です'); process.exit(1); }
    execSync(`ffprobe -v quiet -print_format json -show_streams -show_format "${videoPath}" | python3 -m json.tool`, { stdio: 'inherit' });
}

// ── エントリポイント ─────────────────────────────────────────

const [, , cmd, ...args] = process.argv;

switch (cmd) {
    case 'ass': cmdAss(args[0], args[1]); break;
    case 'burn': cmdBurn(args[0], args[1], args[2]); break;
    case 'concat': cmdConcat(args[0], args[1], args[2], args[3]); break;
    case 'info': cmdInfo(args[0]); break;
    default: printHelp();
}
