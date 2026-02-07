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

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

if (!WEBHOOK_URL) {
    console.error("DISCORD_WEBHOOK_URL not found.");
    process.exit(1);
}

// Parse Webhook ID and Token from URL
// URL format: https://discord.com/api/webhooks/{id}/{token}
const match = WEBHOOK_URL.match(/webhooks\/(\d+)\/(.+)/);
if (!match) {
    console.error("Invalid Webhook URL format.");
    process.exit(1);
}

const webhookId = match[1];
const webhookToken = match[2];

const options = {
    hostname: 'discord.com',
    path: `/api/webhooks/${webhookId}/${webhookToken}`,
    method: 'GET'
};

const req = https.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        if (res.statusCode === 200) {
            const json = JSON.parse(data);
            console.log("Webhook Details:");
            console.log(`- Channel ID: ${json.channel_id}`);
            console.log(`- Guild ID: ${json.guild_id}`);
            console.log(`- Name: ${json.name}`);
            console.log(`- Avatar: ${json.avatar}`);
            // Note: Webhook object does NOT usually contain channel name directly.
            // We can only confirm access.
        } else {
            console.error(`Error: ${res.statusCode} ${data}`);
        }
    });
});
req.end();
