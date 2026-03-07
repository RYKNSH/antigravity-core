const { curlRequest } = require('./lib/curl_client');
const fs = require('fs');
const path = require('path');
const { loadEnv, getSecret } = require(require('path').join(__dirname, 'env_loader'));

// 1Password 優先で環境変数をロード
loadEnv();

const NOTION_API_KEY = getSecret('NOTION_API_KEY');
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

const body = {
    properties: {
        "Status": {
            select: {
                name: "Ready"
            }
        }
    }
};

try {
    const result = curlRequest(options, body);
    console.log("Successfully updated status to Ready");
} catch (err) {
    console.error(`Error: ${err.statusCode || 'unknown'} ${err.body || err.message || err}`);
}
