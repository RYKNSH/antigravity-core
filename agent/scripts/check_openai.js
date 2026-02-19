const fs = require('fs');
const path = require('path');

let envPath = path.join(process.cwd(), '.env');
if (!fs.existsSync(envPath)) {
    envPath = '${process.env.ANTIGRAVITY_DIR || path.join(require("os").homedir(), ".antigravity")}/.env';
}

if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    const hasKey = envConfig.includes('OPENAI_API_KEY=');
    console.log(hasKey ? 'YES' : 'NO');
} else {
    console.log('NO_ENV_FILE');
}
