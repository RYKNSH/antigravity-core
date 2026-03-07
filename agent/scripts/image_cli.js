#!/usr/bin/env node
/**
 * image CLI — Antigravity Core
 * 画像処理ユーティリティ: 背景除去、顔検出、アバター生成、スマートクロップ
 *
 * Usage:
 *   node image_cli.js setup                         -- Python venv + 依存関係セットアップ
 *   node image_cli.js remove-bg <input> [output]    -- 背景除去 (rembg isnet-general-use)
 *   node image_cli.js avatar <input> [output]       -- 顔検出→鼻中心クロップのアバター生成
 *   node image_cli.js face-detect <input>           -- 顔検出のみ（座標を返す）
 *   node image_cli.js smart-crop <input> [output] [--size=256] [--target=face|center]
 *                                                    -- スマートクロップ
 *
 * 動作要件:
 *   - Python 3.10+ (macOS default)
 *   - 初回は `node image_cli.js setup` を実行
 *
 * 例:
 *   node image_cli.js setup
 *   node image_cli.js remove-bg ./photo.jpg ./cutout.png
 *   node image_cli.js avatar ./photo.jpg ./avatar.jpg
 *   node image_cli.js smart-crop ./photo.jpg ./cropped.jpg --size=512 --target=face
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { execSync, spawnSync } = require('child_process');

// ── Constants ──────────────────────────────────────────────────
const VENV_DIR = path.join(require('os').homedir(), '.antigravity', '.venv', 'image-tools');
const PYTHON = path.join(VENV_DIR, 'bin', 'python3');
const PIP = path.join(VENV_DIR, 'bin', 'pip');

// ── Helpers ────────────────────────────────────────────────────

function ensureVenv() {
    if (!fs.existsSync(PYTHON)) {
        console.error('❌ Python venv が見つかりません。先に setup を実行してください:');
        console.error('   node image_cli.js setup');
        process.exit(1);
    }
}

function runPython(script, { timeout = 300000 } = {}) {
    ensureVenv();
    const result = spawnSync(PYTHON, ['-c', script], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout,
        env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
    });

    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) {
        const stderr = result.stderr.toString();
        // Filter out noisy warnings
        const filtered = stderr.split('\n')
            .filter(l => !l.includes('WARNING') && !l.includes('UserWarning'))
            .join('\n').trim();
        if (filtered) process.stderr.write(filtered + '\n');
    }

    if (result.status !== 0) {
        console.error('❌ Python スクリプト実行失敗');
        process.exit(1);
    }

    return result.stdout ? result.stdout.toString().trim() : '';
}

function parseArgs(args) {
    const opts = {};
    const positional = [];
    for (const a of args) {
        if (a.startsWith('--')) {
            const [key, val] = a.slice(2).split('=');
            opts[key] = val || true;
        } else {
            positional.push(a);
        }
    }
    return { opts, positional };
}

// ── Commands ───────────────────────────────────────────────────

function cmdSetup() {
    console.log('🔧 画像処理ツール セットアップ開始...');
    console.log(`   venv: ${VENV_DIR}`);

    // Create venv
    const venvParent = path.dirname(VENV_DIR);
    if (!fs.existsSync(venvParent)) fs.mkdirSync(venvParent, { recursive: true });

    if (!fs.existsSync(PYTHON)) {
        console.log('   📦 Python venv 作成中...');
        execSync(`python3 -m venv "${VENV_DIR}"`, { stdio: 'inherit' });
    }

    // Install dependencies
    console.log('   📦 依存関係インストール中...');
    const deps = [
        'rembg[cpu]',     // Background removal with CPU backend
        'opencv-python-headless',  // Face detection
        'Pillow',         // Image processing
    ];
    execSync(`"${PIP}" install ${deps.map(d => `'${d}'`).join(' ')}`, {
        stdio: 'inherit',
        timeout: 300000,
    });

    console.log('✅ セットアップ完了');
    console.log('');
    console.log('使えるコマンド:');
    console.log('  node image_cli.js remove-bg  <input> [output]   -- 背景除去');
    console.log('  node image_cli.js avatar     <input> [output]   -- アバター生成');
    console.log('  node image_cli.js face-detect <input>           -- 顔検出');
    console.log('  node image_cli.js smart-crop <input> [output]   -- スマートクロップ');
}

function cmdRemoveBg(inputPath, outputPath) {
    if (!inputPath || !fs.existsSync(inputPath)) {
        console.error('❌ 入力画像が見つかりません:', inputPath);
        process.exit(1);
    }

    const out = outputPath || inputPath.replace(/\.(jpg|jpeg|png|webp)$/i, '_cutout.png');
    console.log(`✂️  背景除去開始...`);
    console.log(`   入力: ${inputPath}`);
    console.log(`   出力: ${out}`);

    runPython(`
from rembg import remove, new_session
from PIL import Image, ImageFilter

session = new_session('isnet-general-use')
inp = Image.open('${inputPath.replace(/'/g, "\\'")}')
out = remove(inp, session=session)

# Feather alpha edges for natural look
alpha = out.split()[-1]
alpha = alpha.filter(ImageFilter.GaussianBlur(radius=1.2))
out.putalpha(alpha)

out.save('${out.replace(/'/g, "\\'")}')
print(f'✅ 背景除去完了: {out.size[0]}x{out.size[1]}')
`);
}

function cmdFaceDetect(inputPath) {
    if (!inputPath || !fs.existsSync(inputPath)) {
        console.error('❌ 入力画像が見つかりません:', inputPath);
        process.exit(1);
    }

    const output = runPython(`
import cv2
import numpy as np
from PIL import Image
import json

img = Image.open('${inputPath.replace(/'/g, "\\'")}')
w, h = img.size
img_cv = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)

results = []

# Try frontal face
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
faces = face_cascade.detectMultiScale(gray, 1.1, 5, minSize=(50, 50))

if len(faces) > 0:
    for (x, y, fw, fh) in faces:
        nose_x = x + fw // 2
        nose_y = y + int(fh * 0.6)
        results.append({"type": "frontal", "box": [int(x),int(y),int(fw),int(fh)], "nose": [int(nose_x), int(nose_y)]})

# Try profile face
if len(results) == 0:
    profile_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_profileface.xml')
    pfaces = profile_cascade.detectMultiScale(gray, 1.1, 5, minSize=(50, 50))
    if len(pfaces) > 0:
        for (x, y, fw, fh) in pfaces:
            nose_x = x + fw // 2
            nose_y = y + int(fh * 0.6)
            results.append({"type": "profile", "box": [int(x),int(y),int(fw),int(fh)], "nose": [int(nose_x), int(nose_y)]})

# Try flipped profile
if len(results) == 0:
    gray_flip = cv2.flip(gray, 1)
    profile_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_profileface.xml')
    pfaces = profile_cascade.detectMultiScale(gray_flip, 1.1, 5, minSize=(50, 50))
    if len(pfaces) > 0:
        fx, fy, ffw, ffh = pfaces[0]
        nose_x = w - (fx + ffw // 2)
        nose_y = fy + int(ffh * 0.6)
        results.append({"type": "profile_flipped", "box": [int(w-fx-ffw),int(fy),int(ffw),int(ffh)], "nose": [int(nose_x), int(nose_y)]})

print(json.dumps({"image_size": [w, h], "faces": results}, ensure_ascii=False))
`);

    try {
        const data = JSON.parse(output);
        console.log(`📐 画像サイズ: ${data.image_size[0]}x${data.image_size[1]}`);
        if (data.faces.length === 0) {
            console.log('⚠️  顔が検出されませんでした');
        } else {
            data.faces.forEach((f, i) => {
                console.log(`👤 顔 ${i}: type=${f.type} box=(${f.box.join(',')}) nose=(${f.nose.join(',')})`);
            });
        }
        return data;
    } catch (e) {
        console.log(output);
        return null;
    }
}

function cmdAvatar(inputPath, outputPath, opts = {}) {
    if (!inputPath || !fs.existsSync(inputPath)) {
        console.error('❌ 入力画像が見つかりません:', inputPath);
        process.exit(1);
    }

    const size = parseInt(opts.size) || 256;
    const out = outputPath || inputPath.replace(/\.(jpg|jpeg|png|webp)$/i, '_avatar.jpg');

    console.log(`🎯 アバター生成（鼻中心クロップ）...`);
    console.log(`   入力: ${inputPath}`);
    console.log(`   出力: ${out}`);
    console.log(`   サイズ: ${size}x${size}`);

    runPython(`
import cv2
import numpy as np
from PIL import Image

img = Image.open('${inputPath.replace(/'/g, "\\'")}')
w, h = img.size
img_cv = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)

nose_x, nose_y = None, None

# Try frontal → profile → flipped profile
for attempt in ['frontal', 'profile', 'flipped']:
    if nose_x is not None:
        break
    if attempt == 'frontal':
        cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        faces = cascade.detectMultiScale(gray, 1.1, 5, minSize=(50, 50))
    elif attempt == 'profile':
        cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_profileface.xml')
        faces = cascade.detectMultiScale(gray, 1.1, 5, minSize=(50, 50))
    else:
        gray_flip = cv2.flip(gray, 1)
        cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_profileface.xml')
        faces = cascade.detectMultiScale(gray_flip, 1.1, 5, minSize=(50, 50))
        if len(faces) > 0:
            fx, fy, fw, fh = faces[0]
            nose_x = w - (fx + fw // 2)
            nose_y = fy + int(fh * 0.6)
            break
    if len(faces) > 0:
        x, y, fw, fh = faces[0]
        nose_x = x + fw // 2
        nose_y = y + int(fh * 0.6)

if nose_x is None:
    print('⚠️  顔検出失敗 — 画像中央でクロップ')
    nose_x, nose_y = w // 2, h // 2

print(f'👃 鼻位置: ({nose_x}, {nose_y})')

# Square crop centered on nose
face_size = max(w, h) // 3  # adaptive
half = face_size // 2

left = nose_x - half
top = nose_y - half
right = nose_x + half
bottom = nose_y + half

# Clamp
if left < 0: left, right = 0, face_size
if top < 0: top, bottom = 0, face_size
if right > w: right, left = w, w - face_size
if bottom > h: bottom, top = h, h - face_size

cropped = img.crop((left, top, right, bottom))
cropped = cropped.resize((${size}, ${size}), Image.LANCZOS)

ext = '${out}'.lower()
if ext.endswith('.jpg') or ext.endswith('.jpeg'):
    cropped.save('${out.replace(/'/g, "\\'")}', quality=92)
else:
    cropped.save('${out.replace(/'/g, "\\'")}')

print(f'✅ アバター生成完了: ${size}x${size} crop=({left},{top},{right},{bottom})')
`);
}

function cmdSmartCrop(inputPath, outputPath, opts = {}) {
    if (!inputPath || !fs.existsSync(inputPath)) {
        console.error('❌ 入力画像が見つかりません:', inputPath);
        process.exit(1);
    }

    const size = parseInt(opts.size) || 256;
    const target = opts.target || 'face';
    const out = outputPath || inputPath.replace(/\.(jpg|jpeg|png|webp)$/i, `_crop_${size}.jpg`);

    console.log(`✂️  スマートクロップ...`);
    console.log(`   入力: ${inputPath}`);
    console.log(`   出力: ${out}`);
    console.log(`   サイズ: ${size}x${size}`);
    console.log(`   ターゲット: ${target}`);

    if (target === 'face') {
        cmdAvatar(inputPath, out, { size: String(size) });
    } else {
        // Center crop
        runPython(`
from PIL import Image
img = Image.open('${inputPath.replace(/'/g, "\\'")}')
w, h = img.size
s = min(w, h)
left = (w - s) // 2
top = (h - s) // 2
cropped = img.crop((left, top, left + s, top + s))
cropped = cropped.resize((${size}, ${size}), Image.LANCZOS)
cropped.save('${out.replace(/'/g, "\\'")}', quality=92)
print(f'✅ センタークロップ完了: ${size}x${size}')
`);
    }
}

function printHelp() {
    console.log(`image CLI — Antigravity Core
画像処理ユーティリティ

使い方:
  node image_cli.js setup                          Python venv + 依存関係セットアップ
  node image_cli.js remove-bg  <input> [output]    背景除去（rembg isnet-general-use）
  node image_cli.js avatar     <input> [output]    顔検出→鼻中心クロップのアバター生成
  node image_cli.js face-detect <input>            顔検出（座標をJSON出力）
  node image_cli.js smart-crop <input> [output]    スマートクロップ

オプション:
  --size=256    出力サイズ（default: 256）
  --target=face ターゲット（face|center, default: face）

例:
  node image_cli.js setup
  node image_cli.js remove-bg ./photo.jpg ./cutout.png
  node image_cli.js avatar ./photo.jpg ./avatar.jpg --size=512
  node image_cli.js smart-crop ./photo.jpg ./cropped.jpg --size=512 --target=center
`);
}

// ── Entry Point ───────────────────────────────────────────────

const [,, cmd, ...rawArgs] = process.argv;
const { opts, positional } = parseArgs(rawArgs);

switch (cmd) {
    case 'setup':       cmdSetup(); break;
    case 'remove-bg':   cmdRemoveBg(positional[0], positional[1]); break;
    case 'avatar':      cmdAvatar(positional[0], positional[1], opts); break;
    case 'face-detect': cmdFaceDetect(positional[0]); break;
    case 'smart-crop':  cmdSmartCrop(positional[0], positional[1], opts); break;
    default:            printHelp();
}
