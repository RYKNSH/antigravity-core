const { curlRequest } = require('./lib/curl_client');
const fs = require('fs');
const path = require('path');
const { loadEnv, getSecret } = require(require('path').join(__dirname, 'env_loader'));

// 1Password 優先で環境変数をロード
loadEnv();

const NOTION_API_KEY = getSecret('NOTION_API_KEY');
const NOTION_DATABASE_ID = getSecret('NOTION_DATABASE_ID');

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
        try {
            resolve(curlRequest(options, body));
        } catch (e) {
            reject(e);
        }
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
