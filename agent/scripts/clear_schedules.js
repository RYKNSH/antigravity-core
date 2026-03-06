const { curlRequest } = require('./lib/curl_client');
const fs = require('fs');
const path = require('path');

// Global Env Retrieval
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
const DATE_PROP = "予約日時";

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
        try {
            resolve(curlRequest(options, body));
        } catch (e) {
            reject(e);
        }
    });
}

async function main() {
    console.log('🧹 Clearing scheduled dates for all Ready posts...');

    try {
        const response = await request(`/v1/databases/${NOTION_DATABASE_ID}/query`, 'POST', {
            filter: {
                property: "Status",
                select: {
                    equals: "Ready"
                }
            }
        });

        const pages = response.results;
        console.log(`Found ${pages.length} Ready posts. Clearing dates...`);

        for (const page of pages) {
            const title = page.properties['ドキュメント名']?.title[0]?.plain_text || "Untitled";
            if (page.properties[DATE_PROP]?.date === null) {
                console.log(`- Skipping "${title}" (Already empty)`);
                continue;
            }

            console.log(`- Clearing: "${title}"`);
            await request(`/v1/pages/${page.id}`, 'PATCH', {
                properties: {
                    [DATE_PROP]: {
                        date: null
                    }
                }
            });
        }
        console.log("✨ All cleared.");

    } catch (e) {
        console.error('Error:', e);
    }
}

main();
