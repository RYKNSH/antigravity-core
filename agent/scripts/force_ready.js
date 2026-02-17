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
const PAGE_ID = "2f465ff1-3b15-81c2-8794-cc1053bb1132";

const options = {
    hostname: 'api.notion.com',
    path: `/v1/pages/${PAGE_ID}`,
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
            console.log("Successfully updated status to Ready");
        } else {
            console.error(`Error: ${res.statusCode} ${data}`);
        }
    });
});

req.write(JSON.stringify({
    properties: {
        "Status": {
            select: {
                name: "Ready"
            }
        }
    }
}));
req.end();
