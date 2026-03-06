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
        if (match) process.env[match[1].trim()] = match[2].trim().replace(/^["'](.*)[\"']$/, '$1');
    });
}

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;

const options = {
    hostname: 'api.notion.com',
    path: `/v1/databases/${NOTION_DATABASE_ID}`,
    method: 'GET',
    headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': '2022-06-28'
    }
};

try {
    const json = curlRequest(options);
    console.log(Object.keys(json.properties));
    if (json.properties['ステータス']) {
        console.log('Status options:', JSON.stringify(json.properties['ステータス'].status || json.properties['ステータス'].select));
    }
    if (json.properties['Status']) {
        console.log('Status options:', JSON.stringify(json.properties['Status'].status || json.properties['Status'].select));
    }
} catch (err) {
    console.error(`Error: ${err.statusCode || 'unknown'} ${err.body || err.message || err}`);
}
