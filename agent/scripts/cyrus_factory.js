const https = require('https');
const fs = require('fs');
const path = require('path');

// 1. Env Setup
const homeDir = require('os').homedir();
const adaEnvPath = '/Users/ryotarokonishi/Desktop/AntigravityWork/RYKNSH records/Ada/.env';

function loadEnv(filePath) {
    if (fs.existsSync(filePath)) {
        const envConfig = fs.readFileSync(filePath, 'utf8');
        envConfig.split('\n').forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim().replace(/^["'](.*)["']$/, '$1');
                process.env[key] = value;
            }
        });
    }
}

loadEnv(adaEnvPath);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// 2. Helper: Supabase API Request
async function supabaseRequest(path, method, body) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error("Missing Supabase config");

    const url = new URL(path, SUPABASE_URL);
    return new Promise((resolve, reject) => {
        const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try { resolve(JSON.parse(data)); }
                    catch (e) { resolve(data); }
                } else {
                    reject(new Error(`Supabase API Error ${res.statusCode}: ${data}`));
                }
            });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function run(jsonStr) {
    try {
        const content = JSON.parse(jsonStr);
        console.error(`🏭 Cyrus is assembling "${content.title}"...`);

        // 1. Get Module ID for 'sns' (default for ACE)
        const modules = await supabaseRequest('/rest/v1/modules?slug=eq.sns&select=id', 'GET');
        if (!modules || modules.length === 0) {
            throw new Error("Module 'sns' not found");
        }
        const moduleId = modules[0].id;

        // 2. Insert into 'contents'
        const insertData = {
            module_id: moduleId,
            title: content.title,
            body_markdown: content.body_markdown,
            is_archived: true, // Draft state
            position: 999
        };

        const result = await supabaseRequest('/rest/v1/contents', 'POST', insertData);
        console.error(`✅ Successfully stored draft in Supabase: ${content.title}`);
        console.log(JSON.stringify(result[0], null, 2));

    } catch (error) {
        console.error("❌ Cyrus factory failed:", error.message);
        process.exit(1);
    }
}

// Support for piped input or argv
if (process.argv[2]) {
    run(process.argv[2]);
} else {
    let input = '';
    process.stdin.on('data', chunk => input += chunk);
    process.stdin.on('end', () => run(input));
}
