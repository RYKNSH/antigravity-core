#!/usr/bin/env node
/**
 * EverWebinar CLI — Antigravity Core
 *
 * Usage:
 *   node everwebinar_cli.js list                            — ウェビナー一覧を取得
 *   node everwebinar_cli.js info <webinar_id>               — ウェビナー詳細を取得
 *   node everwebinar_cli.js register <webinar_id> <name> <email> [schedule_date]
 *                                                          — 参加者を登録
 *   node everwebinar_cli.js attendees <webinar_id>          — 参加者リストを取得
 *   node everwebinar_cli.js inject-events <webinar_id> <events_json>
 *                                                          — チャット/ポップアップイベントを注入
 *   node everwebinar_cli.js gen-csv <script_md> <output_csv>
 *                                                          — 台本MDからEverWebinar用CSVを生成
 *
 * APIキーは ~/.antigravity/.env に EVERWEBINAR_API_KEY を設定
 */

'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { loadEnv: envLoad, getSecret } = require(path.join(__dirname, 'env_loader'));

// ─── 1Password 優先で環境変数をロード ─────────────────────────────────────────

envLoad();

const API_KEY = getSecret('EVERWEBINAR_API_KEY');

const BASE_URL = 'https://api.webinarjam.com/everwebinar';

// ─── HTTP helper (POST / JSON) ────────────────────────────────────────────────

function apiPost(endpoint, params = {}) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({ api_key: API_KEY, ...params });
        const url = new URL(BASE_URL + endpoint);
        const options = {
            hostname: url.hostname,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
            },
        };
        const req = https.request(options, res => {
            let data = '';
            res.on('data', chunk => (data += chunk));
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch { reject(new Error(`Parse error: ${data}`)); }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

// ─── コマンド実装 ─────────────────────────────────────────────────────────────

async function cmdList() {
    console.log('📋 ウェビナー一覧を取得中...');
    const res = await apiPost('/webinars');
    if (!res.webinars) { console.error(res); process.exit(1); }
    console.log(`\n✅ ${res.webinars.length} 件のウェビナーが見つかりました:\n`);
    for (const w of res.webinars) {
        console.log(`  [${w.webinar_id}] ${w.name}`);
        console.log(`    ステータス: ${w.status} | セッション数: ${(w.schedules || []).length}`);
    }
}

async function cmdInfo(webinarId) {
    if (!webinarId) { console.error('Usage: node everwebinar_cli.js info <webinar_id>'); process.exit(1); }
    console.log(`📄 ウェビナー詳細取得: ${webinarId}`);
    const res = await apiPost('/webinar', { webinar_id: webinarId });
    if (!res.webinar) { console.error(res); process.exit(1); }
    const w = res.webinar;
    console.log(`\n  名前: ${w.name}`);
    console.log(`  説明: ${w.description || 'なし'}`);
    console.log(`  スケジュール数: ${(w.schedules || []).length}`);
    if (w.schedules) {
        w.schedules.forEach((s, i) => {
            console.log(`    [${i}] date: ${s.date}  time: ${s.time}  timezone: ${s.timezone}`);
        });
    }
}

async function cmdRegister(webinarId, name, email, scheduleDate) {
    if (!webinarId || !name || !email) {
        console.error('Usage: node everwebinar_cli.js register <webinar_id> <name> <email> [schedule_date]');
        process.exit(1);
    }
    console.log(`📝 参加者登録: ${name} <${email}> → ウェビナー ${webinarId}`);
    const params = { webinar_id: webinarId, first_name: name, email };
    if (scheduleDate) params.schedule = scheduleDate;
    const res = await apiPost('/register', params);
    if (res.user && res.user.link) {
        console.log(`\n✅ 登録完了！参加リンク:\n  ${res.user.link}`);
    } else {
        console.error('登録に失敗しました:');
        console.error(JSON.stringify(res, null, 2));
        process.exit(1);
    }
}

async function cmdAttendees(webinarId) {
    if (!webinarId) { console.error('Usage: node everwebinar_cli.js attendees <webinar_id>'); process.exit(1); }
    console.log(`👥 参加者リスト取得: ${webinarId}`);
    const res = await apiPost('/attendees', { webinar_id: webinarId });
    if (!res.attendees) { console.error(res); process.exit(1); }
    console.log(`\n✅ ${res.attendees.length} 名:\n`);
    for (const a of res.attendees) {
        console.log(`  ${a.first_name} ${a.last_name || ''} <${a.email}>`);
    }
}

/**
 * チャット・ポップアップイベントをJSONで渡して注入する
 * events_json 例:
 * [
 *   { "type": "chat", "time": 120, "message": "一緒にやっていきましょう！", "name": "参加者A" },
 *   { "type": "offer", "time": 2400, "title": "今すぐ受け取る", "url": "https://..." }
 * ]
 */
async function cmdInjectEvents(webinarId, eventsJson) {
    if (!webinarId || !eventsJson) {
        console.error('Usage: node everwebinar_cli.js inject-events <webinar_id> <events_json_file_or_string>');
        process.exit(1);
    }
    let events;
    if (fs.existsSync(eventsJson)) {
        events = JSON.parse(fs.readFileSync(eventsJson, 'utf8'));
    } else {
        events = JSON.parse(eventsJson);
    }
    console.log(`🎭 イベント注入: ${events.length} 件 → ウェビナー ${webinarId}`);

    // EverWebinar API: PUT /events (非公式。管理画面URLを直接PATCHする形で対応)
    // ※ 公式APIにイベント注入エンドポイントがない場合はCSV生成で対応
    console.log('\n⚠️  EverWebinar の公式APIにはイベント直接注入エンドポイントがありません。');
    console.log('   代わりに gen-csv コマンドで CSV を生成し、管理画面からインポートしてください。\n');
    console.log('   生成するCSVをプレビュー:\n');
    console.log('timestamp_seconds,speaker_name,message');
    for (const ev of events) {
        if (ev.type === 'chat') {
            console.log(`${ev.time},${ev.name || '参加者'},${ev.message}`);
        }
    }
}

/**
 * Markdown台本からEverWebinar用チャットCSVを自動生成
 *
 * 台本MD内に以下の記法でチャットイベントを埋め込む:
 *   <!-- CHAT @120 name="田中" msg="なるほど！" -->
 *   <!-- OFFER @2400 title="今すぐ受け取る" url="https://..." -->
 */
function cmdGenCsv(scriptMd, outputCsv) {
    if (!scriptMd || !outputCsv) {
        console.error('Usage: node everwebinar_cli.js gen-csv <script_md> <output_csv>');
        process.exit(1);
    }
    if (!fs.existsSync(scriptMd)) {
        console.error(`File not found: ${scriptMd}`);
        process.exit(1);
    }
    const content = fs.readFileSync(scriptMd, 'utf8');
    const chatRows = ['timestamp_seconds,speaker_name,message'];
    const chatRegex = /<!--\s*CHAT\s+@(\d+)\s+name="([^"]+)"\s+msg="([^"]+)"\s*-->/g;
    const offerRegex = /<!--\s*OFFER\s+@(\d+)\s+title="([^"]+)"\s+url="([^"]+)"\s*-->/g;

    let chatCount = 0;
    let m;
    while ((m = chatRegex.exec(content)) !== null) {
        chatRows.push(`${m[1]},${m[2]},"${m[3]}"`);
        chatCount++;
    }
    fs.writeFileSync(outputCsv, chatRows.join('\n'), 'utf8');
    console.log(`✅ チャットCSV生成完了: ${outputCsv} (${chatCount} 件)`);

    // OFFERイベントサマリー出力
    const offerRows = [];
    while ((m = offerRegex.exec(content)) !== null) {
        offerRows.push({ time: m[1], title: m[2], url: m[3] });
    }
    if (offerRows.length > 0) {
        console.log(`\n📢 オファーイベント (管理画面で手動設定):`);
        offerRows.forEach(r => {
            console.log(`  @${r.time}秒 — "${r.title}" → ${r.url}`);
        });
    }
}

// ─── CLI エントリーポイント ────────────────────────────────────────────────────

const [, , cmd, ...args] = process.argv;

(async () => {
    try {
        switch (cmd) {
            case 'list':
                await cmdList();
                break;
            case 'info':
                await cmdInfo(args[0]);
                break;
            case 'register':
                await cmdRegister(args[0], args[1], args[2], args[3]);
                break;
            case 'attendees':
                await cmdAttendees(args[0]);
                break;
            case 'inject-events':
                await cmdInjectEvents(args[0], args[1]);
                break;
            case 'gen-csv':
                cmdGenCsv(args[0], args[1]);
                break;
            default:
                console.log(`EverWebinar CLI — Antigravity Core
Usage:
  node everwebinar_cli.js list
  node everwebinar_cli.js info <webinar_id>
  node everwebinar_cli.js register <webinar_id> <name> <email> [schedule_date]
  node everwebinar_cli.js attendees <webinar_id>
  node everwebinar_cli.js inject-events <webinar_id> <events_json>
  node everwebinar_cli.js gen-csv <script_md> <output_csv>

台本MDにイベントを埋め込む記法:
  <!-- CHAT @120 name="田中" msg="なるほど！" -->
  <!-- OFFER @2400 title="今すぐ受け取る" url="https://example.com" -->
`);
        }
    } catch (err) {
        console.error(`\n❌ エラー: ${err.message}`);
        process.exit(1);
    }
})();
