const fs = require('fs');
const path = require('path');
const https = require('https');
const { exec } = require('child_process');
const readline = require('readline');

let ENV_PATH = path.join(process.cwd(), '.env');
const ANTIGRAVITY_ENV = process.env.ANTIGRAVITY_DIR ? path.join(process.env.ANTIGRAVITY_DIR, '.env') : path.join(require("os").homedir(), ".antigravity", ".env");
const GLOBAL_ENV = path.join(require("os").homedir(), '.env');

if (!fs.existsSync(ENV_PATH)) {
    if (fs.existsSync(ANTIGRAVITY_ENV)) ENV_PATH = ANTIGRAVITY_ENV;
    else if (fs.existsSync(GLOBAL_ENV)) ENV_PATH = GLOBAL_ENV;
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

function openBrowser(url) {
    const platform = process.platform;
    let command;
    if (platform === 'darwin') command = `open "${url}"`;
    else if (platform === 'win32') command = `start "" "${url}"`;
    else command = `xdg-open "${url}"`;

    exec(command);
}

async function validateToken(token) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.notion.com',
            path: '/v1/users/me',
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Notion-Version': '2022-06-28'
            }
        };

        const req = https.request(options, (res) => {
            if (res.statusCode === 200) {
                resolve(true);
            } else {
                resolve(false);
            }
        });

        req.on('error', (e) => resolve(false));
        req.end();
    });
}

async function main() {
    console.log('\n🔵 Notion Setup Wizard\n');

    // Check existing env
    let envContent = '';
    if (fs.existsSync(ENV_PATH)) {
        envContent = fs.readFileSync(ENV_PATH, 'utf8');
    }

    const hasKey = envContent.includes('NOTION_API_KEY=');
    const hasDb = envContent.includes('NOTION_DATABASE_ID=');

    if (hasKey && hasDb) {
        console.log('✅ Credentials found in .env. Skipping setup.\n');
        process.exit(0);
    }

    console.log('To connect Notion, we need an Integration Token.');
    console.log('Opening Notion Integrations page...');

    // Open Notion Integrations page
    openBrowser('https://www.notion.so/my-integrations');

    console.log('\n👉 Instructions:');
    console.log('1. Click "New integration"');
    console.log('2. Name it (e.g., "Social Knowledge Blog")');
    console.log('3. Select the workspace');
    console.log('4. Copy the "Internal Integration Secret"');
    console.log('5. IMPORTANT: Go to your target Database page, click "..." > logic/connections, and add this connection.');

    const token = await question('\n🔑 Paste the Internal Integration Secret: ');

    console.log('\nValidating token...');
    if (await validateToken(token.trim())) {
        console.log('✅ Token valid!');
    } else {
        console.error('❌ Token validation failed. Please check the token.');
        process.exit(1);
    }

    const dbId = await question('\n📂 Paste the Database ID (from the URL of your database page): ');

    let newEnvContent = envContent;
    if (!envContent.endsWith('\n') && envContent.length > 0) newEnvContent += '\n';

    if (!hasKey) newEnvContent += `NOTION_API_KEY=${token.trim()}\n`;
    if (!hasDb) newEnvContent += `NOTION_DATABASE_ID=${dbId.trim()}\n`;

    fs.writeFileSync(ENV_PATH, newEnvContent);
    console.log(`\n✅ Saved credentials to ${ENV_PATH}`);
    console.log('🎉 Setup complete!');

    rl.close();
}

main();
