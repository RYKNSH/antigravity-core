const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// 1. Global Env Retrieval
let envPath = path.join(process.cwd(), '.env');
if (!fs.existsSync(envPath)) {
    envPath = '${process.env.ANTIGRAVITY_DIR || path.join(require("os").homedir(), ".antigravity")}/.env';
}

if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) process.env[match[1].trim()] = match[2].trim().replace(/^["'](.*)["']$/, '$1');
    });
}

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

const STATUS_PROP = "Status";
const DATE_PROP = "予約日時";
const TITLE_PROP = "ドキュメント名";

// 2. Helpers
function request(path, method, body) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.notion.com',
            path: path,
            method: method,
            headers: {
                'Authorization': `Bearer ${NOTION_API_KEY}`,
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(JSON.parse(data));
                } else {
                    reject({ statusCode: res.statusCode, body: data });
                }
            });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

function runDiscordPoster(pageId) {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(__dirname, 'discord_poster.js');
        // Use 'node' command. scriptPath should be absolute or correct relative.
        // We assume discord_poster.js is in same dir.
        exec(`node "${scriptPath}" ${pageId}`, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error posting ${pageId}:`, stderr);
                reject(error);
            } else {
                console.log(stdout.trim());
                resolve();
            }
        });
    });
}

async function markAsPublished(pageId) {
    await request(`/v1/pages/${pageId}`, 'PATCH', {
        properties: {
            [STATUS_PROP]: {
                select: {
                    name: "Published"
                }
            }
        }
    });
}

async function main() {
    console.log('⏰ Checking for due articles...');

    try {
        // Query "Ready" posts with Date NOT empty
        // We will filter by time in JS to be precise with Timezones
        const response = await request(`/v1/databases/${NOTION_DATABASE_ID}/query`, 'POST', {
            filter: {
                and: [
                    {
                        property: STATUS_PROP,
                        select: {
                            equals: "Ready"
                        }
                    },
                    {
                        property: DATE_PROP,
                        date: {
                            is_not_empty: true
                        }
                    }
                ]
            }
        });

        const pages = response.results;
        const now = new Date();
        let publishedCount = 0;

        for (const page of pages) {
            const title = page.properties[TITLE_PROP]?.title[0]?.plain_text || "Untitled";
            const dateStr = page.properties[DATE_PROP]?.date?.start;
            
            // Notion API date with time_zone returns full ISO string in JS usually?
            // Actually request returns whatever was saved. 
            // If we saved "2026-01-27T08:00:00" and time_zone "Asia/Tokyo", 
            // The API response for 'start' usually contains offset IF it was auto-normalized, 
            // OR we must re-construct.
            // Let's rely on Date.parse handling.
            // If Notion returns "2026-01-27T08:00:00.000+09:00", Date.parse works.
            
            if (!dateStr) continue;

            const scheduleTime = new Date(dateStr);
            
            // Check if Due
            if (scheduleTime <= now) {
                console.log(`🚀 DUE: "${title}" (Scheduled: ${dateStr})`);
                console.log(`   Posting to Discord...`);
                
                try {
                    await runDiscordPoster(page.id);
                    await markAsPublished(page.id);
                    publishedCount++;
                    console.log(`   ✅ Published & Status Updated.`);
                } catch (e) {
                    console.error(`   ❌ Failed to publish: ${e.message}`);
                }

            } else {
                console.log(`⏳ Pending: "${title}" (Scheduled: ${dateStr}) - Not due yet.`);
            }
        }

        if (publishedCount === 0) {
            console.log('💤 No articles are due right now.');
        } else {
            console.log(`🎉 Processed ${publishedCount} articles.`);
        }

    } catch (e) {
        console.error('Error:', e);
        process.exit(1);
    }
}

main();
