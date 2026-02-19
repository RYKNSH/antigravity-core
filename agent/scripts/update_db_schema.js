const https = require('https');
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

if (!NOTION_API_KEY || !NOTION_DATABASE_ID) {
    console.error('Error: Credentials not found.');
    process.exit(1);
}

const updatePayload = {
    properties: {
        "Social_Image_Prompt": { "rich_text": {} },
        "X_Post_Text": { "rich_text": {} },
        "FB_Post_Text": { "rich_text": {} },
        "Threads_Post_Text": { "rich_text": {} },
        "Social_Distribution_Status": {
            "select": {
                "options": [
                    { "name": "Ready", "color": "blue" },
                    { "name": "Done", "color": "green" },
                    { "name": "Error", "color": "red" }
                ]
            }
        }
    }
};

const options = {
    hostname: 'api.notion.com',
    path: `/v1/databases/${NOTION_DATABASE_ID}`,
    method: 'PATCH',
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
        if (res.statusCode === 200) {
            console.log('✅ Successfully updated Notion Database Schema with new properties.');
        } else {
            console.error(`❌ Error updating schema: ${res.statusCode} ${data}`);
        }
    });
});

req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
});

req.write(JSON.stringify(updatePayload));
req.end();
