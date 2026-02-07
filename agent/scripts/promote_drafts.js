const https = require('https');
const fs = require('fs');
const path = require('path');

// Global Env Retrieval
let envPath = path.join(process.cwd(), '.env');
if (!fs.existsSync(envPath)) {
    envPath = '/Volumes/PortableSSD/.antigravity/.env';
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

const STATUS_PROP = "Status";

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

async function main() {
    console.log('🔍 Searching for posts to promote to Ready...');

    // We want to find pages where Status is NOT "Ready" AND NOT "Published"
    // Notion API "does_not_equal" is useful?
    // Or just OR logic for "Draft" and "Empty".
    // Let's iterate through all recent (page_size 100) and filter in JS to be safe/flexible (since dataset is small)

    try {
        const response = await request(`/v1/databases/${NOTION_DATABASE_ID}/query`, 'POST', {
            page_size: 100,
            sorts: [{ timestamp: "last_edited_time", direction: "descending" }]
        });
        
        const targets = response.results.filter(page => {
            const status = page.properties[STATUS_PROP]?.select?.name;
            return status !== "Ready" && status !== "Published";
        });

        if (targets.length === 0) {
            console.log('✅ No drafts found.');
            return;
        }

        console.log(`Found ${targets.length} drafts. Promoting...`);

        for (const page of targets) {
            const title = page.properties['ドキュメント名']?.title[0]?.plain_text || "Untitled";
            console.log(`- Promoting: ${title}`);
            
            await request(`/v1/pages/${page.id}`, 'PATCH', {
                properties: {
                    [STATUS_PROP]: {
                        select: {
                            name: "Ready"
                        }
                    }
                }
            });
        }
        
        console.log("✨ All promoted to Ready.");

    } catch (e) {
        console.error('Error:', e);
    }
}

main();
