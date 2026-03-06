#!/usr/bin/env node
/**
 * Penpot CLI — Antigravity Core
 * Penpot デザインプラットフォームの API クライアント
 *
 * Usage:
 *   node penpot_cli.js list-files <team_id>
 *   node penpot_cli.js export <file_id> <format: png|svg|pdf>
 *   node penpot_cli.js list-templates
 *   node penpot_cli.js apply-template <template_name> <project_id>
 *
 * 環境変数（~/.antigravity/.env）:
 *   PENPOT_URL          : https://your-penpot.railway.app
 *   PENPOT_ACCESS_TOKEN : Penpotのアクセストークン
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

// .env 読み込み（nativeパース — dotenv不要）
const envPath = path.join(process.env.HOME, '.antigravity', '.env');
if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
        const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
        if (m) process.env[m[1].trim()] = m[2].trim();
    });
}

const PENPOT_URL = process.env.PENPOT_URL;
const PENPOT_EMAIL = process.env.PENPOT_EMAIL || process.env.PENPOT_ACCESS_TOKEN;
const PENPOT_PASSWORD = process.env.PENPOT_PASSWORD;
const COOKIE_JAR = '/tmp/penpot_session_cookies.txt';

if (!PENPOT_URL) {
    console.error('[Penpot CLI] Error: PENPOT_URL が設定されていません。');
    console.error('  ~/.antigravity/.env に設定してください。');
    process.exit(1);
}

// ── セッション管理 ────────────────────────────────────────────

function login() {
    if (!PENPOT_EMAIL || !PENPOT_PASSWORD) {
        console.error('[Penpot CLI] Error: PENPOT_EMAIL と PENPOT_PASSWORD が必要です。');
        process.exit(1);
    }
    const cmd = `curl -sf -c "${COOKIE_JAR}" -X POST \
      "${PENPOT_URL}/api/rpc/command/login-with-password" \
      -H "Content-Type: application/json" \
      -d '{"email":"${PENPOT_EMAIL}","password":"${PENPOT_PASSWORD}"}'`;
    try {
        execSync(cmd, { timeout: 15000 });
    } catch (e) {
        console.error('[Penpot CLI] ログイン失敗:', e.message);
        process.exit(1);
    }
}

function curl(method, endpoint, body = null) {
    // セッションCookieがなければログイン
    if (!fs.existsSync(COOKIE_JAR)) login();
    const url = `${PENPOT_URL}/api/rpc/command${endpoint}`;
    let cmd = `curl -sL -b "${COOKIE_JAR}" -X ${method} "${url}" \
    -H "Accept: application/json" \
    -H "Content-Type: application/json"`;
    if (body) cmd += ` -d '${JSON.stringify(body)}'`;
    try {
        const result = execSync(cmd, { timeout: 15000 }).toString();
        return JSON.parse(result);
    } catch (e) {
        console.error(`[Penpot CLI] API エラー: ${endpoint}`);
        console.error(e.message);
        process.exit(1);
    }
}


function printHelp() {
    console.log(`Penpot CLI — Antigravity Core
Usage:
  node penpot_cli.js list-files <team_id>
  node penpot_cli.js export <file_id> <format: png|svg|pdf> [output_path]
  node penpot_cli.js list-templates
  node penpot_cli.js apply-template <template_name> <project_id>
  node penpot_cli.js profile
`);
}

// ── コマンド実装 ────────────────────────────────────────────

async function cmdProfile() {
    const data = curl('GET', '/get-profile');
    // Penpot APIはcamelCase JSONを返す (Accept: application/json時)
    const name = data.fullname || data['~:fullname'] || '(不明)';
    const email = data.email || data['~:email'] || '(不明)';
    const id = data.id || data['~:id'] || '(不明)';
    console.log(`✅ ログイン中: ${name} (${email})`);
    console.log(`   ID: ${id}`);
    console.log(`   defaultTeamId: ${data.defaultTeamId || data['~:defaultTeamId'] || '(不明)'}`);
}

async function cmdListFiles(teamId) {
    if (!teamId) { console.error('team_id が必要です'); process.exit(1); }
    const data = curl('GET', `/get-files?team_id=${teamId}`);
    const files = Array.isArray(data) ? data : (data.files || []);
    console.log(`📁 ファイル一覧（チーム: ${teamId}）— ${files.length} 件\n`);
    files.forEach(f => console.log(`  [${f.id}] ${f.name} (修正: ${f['modified-at']})`));
}

async function cmdExport(fileId, format, outputPath) {
    if (!fileId || !format) { console.error('file_id と format が必要です'); process.exit(1); }
    const validFormats = ['png', 'svg', 'pdf'];
    if (!validFormats.includes(format)) {
        console.error(`format は ${validFormats.join('/')} のいずれかを指定してください`);
        process.exit(1);
    }
    console.log(`📤 エクスポート中: ${fileId} → ${format.toUpperCase()}`);
    // エクスポートAPIはバイナリを返すのでcurlを直接実行
    const out = outputPath || `./penpot_export_${Date.now()}.${format}`;
    const cmd = `curl -sf -X GET \
    "${PENPOT_URL}/api/rpc/command/export-file?file-id=${fileId}&type=${format}" \
    -H "Authorization: Token ${ACCESS_TOKEN}" \
    -o "${out}"`;
    execSync(cmd, { stdio: 'inherit', timeout: 60000 });
    console.log(`✅ エクスポート完了: ${out}`);
}

async function cmdListTemplates() {
    const templatesDir = path.join(process.env.HOME, '.antigravity', 'media', 'remotion', 'templates');
    if (!fs.existsSync(templatesDir)) {
        console.log('⚠️  テンプレートディレクトリが見つかりません: ' + templatesDir);
        return;
    }
    const templates = fs.readdirSync(templatesDir).filter(d =>
        fs.statSync(path.join(templatesDir, d)).isDirectory()
    );
    console.log(`🎨 利用可能なテンプレート — ${templates.length} 件\n`);
    templates.forEach(t => console.log(`  - ${t}`));
}

// ── エントリポイント ────────────────────────────────────────

const [, , cmd, ...args] = process.argv;

(async () => {
    switch (cmd) {
        case 'profile': await cmdProfile(); break;
        case 'list-files': await cmdListFiles(args[0]); break;
        case 'export': await cmdExport(args[0], args[1], args[2]); break;
        case 'list-templates': await cmdListTemplates(); break;
        default: printHelp();
    }
})();
