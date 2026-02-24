const https = require('https');
const fs = require('fs');

// 1. Env Setup
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

// Prefer mcp_config which has the real GitHub token
const mcpConfig = '/Users/ryotarokonishi/.antigravity-private/mcp_config.json';
if (fs.existsSync(mcpConfig)) {
    try {
        const conf = JSON.parse(fs.readFileSync(mcpConfig, 'utf8'));
        const ghToken = conf?.mcpServers?.github?.env?.GITHUB_PERSONAL_ACCESS_TOKEN;
        if (ghToken) process.env.GITHUB_TOKEN = ghToken;
    } catch (e) { }
}

loadEnv('/Users/ryotarokonishi/Desktop/AntigravityWork/RYKNSH records/Ada/.env');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hqohbmkeyampxlpmkfht.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// 2. Helper: GitHub API
async function githubRequest(path) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.github.com',
            path: path,
            method: 'GET',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'User-Agent': 'RYKNSH-Life-OS',
                'Accept': 'application/vnd.github.v3+json'
            }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try { resolve(JSON.parse(data)); }
                    catch (e) { reject(new Error(`GitHub parse error: ${e.message}`)); }
                } else {
                    reject(new Error(`GitHub API Error ${res.statusCode}: ${data.slice(0, 200)}`));
                }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

// 3. Helper: Supabase Insert
async function supabaseInsert(records) {
    return new Promise((resolve, reject) => {
        const url = new URL('/rest/v1/life_logs', SUPABASE_URL);
        const body = JSON.stringify(records);
        const options = {
            hostname: url.hostname,
            path: url.pathname,
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=ignore-duplicates'
            }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) resolve(true);
                else reject(new Error(`Supabase Error ${res.statusCode}: ${data}`));
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

// 4. Main Logic
async function main() {
    if (!GITHUB_TOKEN) {
        console.error('❌ GITHUB_TOKEN not found');
        process.exit(1);
    }

    console.error('🐙 GitHub Log Collector starting...');

    // Get all of my repos (including private) sorted by recent push
    const user = await githubRequest('/user');
    console.error(`👤 GitHub User: ${user.login}`);

    const repos = await githubRequest(`/user/repos?sort=pushed&per_page=50&type=all`);
    console.error(`📦 Found ${repos.length} repositories`);

    const collected = [];
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    for (const repo of repos) {
        if (repo.fork) continue; // skip forks
        try {
            const commits = await githubRequest(
                `/repos/${repo.full_name}/commits?author=${user.login}&since=${since}&per_page=30`
            );

            for (const commit of commits) {
                const message = commit.commit.message;
                const date = commit.commit.author.date;

                // Skip merge commits and empty messages
                if (message.startsWith('Merge') || message.length < 3) continue;

                collected.push({
                    source: 'github',
                    content: message,
                    metadata: {
                        repo: repo.full_name,
                        sha: commit.sha.slice(0, 7),
                        url: commit.html_url
                    },
                    logged_at: date
                });
            }

            await new Promise(r => setTimeout(r, 100)); // rate limit buffer
        } catch (e) {
            if (!e.message.includes('409') && !e.message.includes('404')) {
                console.error(`  ⚠️ ${repo.name}: ${e.message}`);
            }
        }
    }

    console.error(`✅ Collected ${collected.length} commits from GitHub`);

    if (collected.length > 0) {
        await supabaseInsert(collected);
        console.error(`💾 Saved ${collected.length} entries to life_logs`);
    }

    console.log(JSON.stringify({ collected: collected.length, source: 'github' }));
}

main().catch(e => {
    console.error('❌ Fatal error:', e.message);
    process.exit(1);
});
