/**
 * Antigravity Core — Vault Utility
 * 
 * 1Password CLI (`op read`) を使用してシークレットをセキュアに取得する。
 * 環境変数 OP_SERVICE_ACCOUNT_TOKEN が設定されている場合、
 * 非対話モード（バックグラウンドプロセス対応）で動作する。
 * 
 * Usage:
 *   const { getSecret } = require('./vault');
 *   const apiKey = await getSecret('op://Automation/Notion API/API Key/credential');
 */

const { exec } = require('child_process');

function getSecret(opReference) {
    return new Promise((resolve, reject) => {
        const env = { ...process.env };

        // Service Account Token が設定されていれば非対話モードで実行
        if (process.env.OP_SERVICE_ACCOUNT_TOKEN) {
            env.OP_SERVICE_ACCOUNT_TOKEN = process.env.OP_SERVICE_ACCOUNT_TOKEN;
        }

        exec(`op read "${opReference}"`, { env, timeout: 15000 }, (error, stdout, stderr) => {
            if (error) {
                console.error(`❌ [Vault] Failed to read secret: ${opReference}`, stderr || error.message);
                reject(new Error(`Vault read failed for ${opReference}: ${stderr || error.message}`));
                return;
            }
            resolve(stdout.trim());
        });
    });
}

module.exports = { getSecret };
