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

const options = {
    hostname: 'api.notion.com',
    path: `/v1/databases/${NOTION_DATABASE_ID}/query`,
    method: 'POST',
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
            const json = JSON.parse(data);
            console.log("Recent Articles:");
            json.results.forEach(page => {
                 const title = page.properties['ドキュメント名']?.title[0]?.plain_text || "Untitled";
                 const status = page.properties['Status']?.select?.name || page.properties['ステータス']?.select?.name || "Unknown";
                 const date = page.properties['予約日時']?.date?.start || "No Date";
                 const lastEdited = page.last_edited_time;
                 console.log(`- [${status}] ${title} (Date: ${date}, ID: ${page.id})`);
            });
        } else {
            console.error(`Error: ${res.statusCode} ${data}`);
        }
    });
});
req.write(JSON.stringify({
    page_size: 20,
    sorts: [
        {
            timestamp: "last_edited_time",
            direction: "descending"
        }
    ]
}));
req.end();
