const https = require('https');
const fs = require('fs');
const path = require('path');

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
const PAGE_ID = "2f565ff1-3b15-81a4-825e-cfa51bbc08a1"; // "寝てても..." article

const options = {
    hostname: 'api.notion.com',
    path: `/v1/pages/${PAGE_ID}`,
    method: 'GET',
    headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': '2022-06-28'
    }
};

const req = https.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const json = JSON.parse(data);
        console.log("Title:", json.properties['ドキュメント名'].title[0].plain_text);
        console.log("X Text:", json.properties['X_Post_Text']?.rich_text?.[0]?.plain_text || "EMPTY");
        console.log("FB Text:", json.properties['FB_Post_Text']?.rich_text?.[0]?.plain_text || "EMPTY");
        console.log("Distribution Status:", json.properties['Social_Distribution_Status']?.select?.name || "EMPTY");
    });
});
req.end();
