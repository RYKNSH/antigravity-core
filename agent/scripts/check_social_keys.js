const fs = require('fs');
const path = require('path');

let envPath = path.join(process.cwd(), '.env');
if (!fs.existsSync(envPath)) {
    envPath = '${process.env.ANTIGRAVITY_DIR || path.join(require("os").homedir(), ".antigravity")}/.env';
}

const keysToCheck = [
    'OPENAI_API_KEY',
    'X_API_KEY',
    'X_API_SECRET',
    'FACEBOOK_ACCESS_TOKEN',
    'THREADS_ACCESS_TOKEN'
];

if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    const result = {};
    keysToCheck.forEach(key => {
        result[key] = envConfig.includes(`${key}=`) ? 'YES' : 'NO';
    });
    console.table(result);
} else {
    console.log('NO_ENV_FILE');
}
