const https = require('https');
const fs = require('fs');
const path = require('path');

// 1. Env Setup
const homeDir = require('os').homedir();

function loadEnv(filePath) {
    if (fs.existsSync(filePath)) {
        const envConfig = fs.readFileSync(filePath, 'utf8');
        envConfig.split('\n').forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim().replace(/^["'](.*)["']$/, '$1');
                if (!process.env[key]) process.env[key] = value;
            }
        });
    }
}

loadEnv(path.join(homeDir, '.antigravity-private', '.env'));
loadEnv('/Users/ryotarokonishi/Desktop/AntigravityWork/RYKNSH records/Ada/.env');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hqohbmkeyampxlpmkfht.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// 2. Helper: Anthropic API
async function anthropicRequest(body) {
    if (!ANTHROPIC_API_KEY) throw new Error("Missing ANTHROPIC_API_KEY");
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.anthropic.com',
            path: '/v1/messages',
            method: 'POST',
            headers: {
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json'
            }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try { resolve(JSON.parse(data)); }
                    catch (e) { reject(new Error(`Parse error: ${e.message}`)); }
                } else {
                    reject(new Error(`Anthropic Error ${res.statusCode}: ${data}`));
                }
            });
        });
        req.on('error', reject);
        req.write(JSON.stringify(body));
        req.end();
    });
}

// 3. Helper: Fetch life_logs
async function fetchLifeLogs(hours = 48) {
    return new Promise((resolve, reject) => {
        const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
        const url = new URL(
            `/rest/v1/life_logs?select=source,content,logged_at&logged_at=gte.${since}&order=logged_at.desc&limit=100`,
            SUPABASE_URL
        );
        const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: 'GET',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try { resolve(JSON.parse(data)); }
                    catch (e) { reject(new Error(`Parse error: ${e.message}`)); }
                } else {
                    reject(new Error(`Supabase Error ${res.statusCode}: ${data}`));
                }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

// 4. Prompts
const MANUAL_SYSTEM_PROMPT = `あなたは「Ada」— クリエイター ryknsh の声を増幅するブレインです。
Seedを受け取り、以下の構造のJSONのみを出力してください。

{
  "title": "引きのあるエッセイタイトル",
  "concept": "コンテンツの哲学的核心（1文）",
  "body_markdown": "本文エッセイ（Markdown・1500字程度・日本語）",
  "tweet": "X投稿用（140字以内・問いかけまたは断言・ハッシュタグ不要）",
  "threads_post": "Threads用（500字以内・対話を誘う）",
  "image_prompt": "Visual art prompt in English for image generation",
  "tags": ["タグ1", "タグ2"]
}

原則: ryknshの個性・ノイズ・不完全さを薄めない。むしろ強調し、唯一無二の声にする。JSONのみ出力。`;

const AUTO_SYSTEM_PROMPT = `あなたは「Ada」— フルスタックアーティスト兼起業家 ryknsh のライフログを解析し、
唯一無二のコンテンツを自律生成するクリエイティブ・ブレインです。

以下のライフログから最も「コンテンツ化すべき体験クラスター」を1つ選び、JSONを出力してください。

ryknsh: 音楽・アート・コーディングをソロで行う。全部が同じ孤独から生まれている。
その内側の景色を言語化することが、誰も真似できない発信になる。

{
  "title": "引きのあるタイトル",
  "concept": "哲学的核心（1文）",
  "body_markdown": "本文エッセイ（Markdown・日本語）",
  "tweet": "X用（140字以内・問いかけまたは断言）",
  "threads_post": "Threads用（500字以内）",
  "image_prompt": "Visual art prompt in English",
  "tags": ["タグ1", "タグ2"],
  "source_cluster": ["使ったlogを短縮して列挙"]
}

JSONのみ出力。`;

// 5. Anthropic with model fallback
async function callClaude(systemPrompt, userContent) {
    const models = [
        "claude-3-5-sonnet-latest",
        "claude-3-5-sonnet-20241022",
        "claude-3-opus-20240229",
        "claude-3-haiku-20240307"
    ];

    for (const model of models) {
        console.error(`🧠 Ada (${model}) processing...`);
        try {
            const response = await anthropicRequest({
                model,
                max_tokens: 4000,
                system: systemPrompt,
                messages: [{ role: "user", content: userContent }]
            });
            const text = response.content[0].text;
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            return jsonMatch ? jsonMatch[0] : text;
        } catch (error) {
            console.error(`  ⚠️ ${model}: ${error.message}`);
            if (model === models[models.length - 1]) throw error;
        }
    }
}

// 6. Main
async function main() {
    const isAuto = process.argv.includes('--auto');
    const seed = process.argv.find(a => !a.startsWith('-') && a !== process.argv[0] && a !== process.argv[1]);

    if (isAuto) {
        console.error('🤖 Ada --auto mode: reading from life_logs...');
        const logs = await fetchLifeLogs(48);

        if (!logs || logs.length === 0) {
            console.error('⚠️ No life_logs found in the past 48h. Exiting.');
            process.exit(0);
        }

        console.error(`📚 Found ${logs.length} log entries`);
        const logsText = logs
            .map(l => `[${l.source}] ${l.logged_at?.slice(0, 10)} — ${l.content}`)
            .join('\n');

        const result = await callClaude(AUTO_SYSTEM_PROMPT, `ライフログ:\n\n${logsText}`);
        console.log(result);
    } else if (seed) {
        const result = await callClaude(MANUAL_SYSTEM_PROMPT, `Seed: "${seed}"`);
        console.log(result);
    } else {
        console.error('Usage:');
        console.error('  Manual: node ada_processor.js "あなたの感情・気づき"');
        console.error('  Auto:   node ada_processor.js --auto');
        process.exit(1);
    }
}

main().catch(e => {
    console.error('❌ Ada failed:', e.message);
    process.exit(1);
});
