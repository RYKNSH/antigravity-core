/**
 * Antigravity Core — Vault Utility (正本)
 * 
 * 1Password CLI (`op read`) を使用してシークレットをセキュアに取得する。
 * 
 * 特徴:
 * - OP_SERVICE_ACCOUNT_TOKEN による非対話モード（バックグラウンドプロセス対応）
 * - インメモリキャッシュ（同一プロセス内で同じシークレットを再取得しない）
 * - タイムアウト付き（op CLI がハングしても15秒で切断）
 * - バリデーション（不正な参照URIを事前にブロック）
 * 
 * Usage:
 *   const { getSecret, preloadSecrets } = require('~/.antigravity/agent/scripts/lib/vault');
 *   const apiKey = await getSecret('op://Automation/Notion API/API Key/credential');
 */

const { exec } = require('child_process');

// In-memory cache per process lifetime
const _cache = new Map();

/**
 * Fetches a secret from 1Password.
 * Results are cached in-memory for the lifetime of the process.
 * 
 * @param {string} opReference The 1Password secret reference URI (e.g., `op://Automation/Item/Field`)
 * @param {object} [opts] Options
 * @param {boolean} [opts.noCache=false] Skip cache and force re-fetch
 * @returns {Promise<string>} The secret value
 */
async function getSecret(opReference, opts = {}) {
    // Validation
    if (!opReference || typeof opReference !== 'string') {
        throw new Error('[Vault] opReference must be a non-empty string');
    }
    if (!opReference.startsWith('op://')) {
        throw new Error(`[Vault] Invalid reference URI: must start with op:// — got "${opReference}"`);
    }

    // Cache check
    if (!opts.noCache && _cache.has(opReference)) {
        return _cache.get(opReference);
    }

    return new Promise((resolve, reject) => {
        const env = { ...process.env };

        // Service Account Token for non-interactive mode
        if (process.env.OP_SERVICE_ACCOUNT_TOKEN) {
            env.OP_SERVICE_ACCOUNT_TOKEN = process.env.OP_SERVICE_ACCOUNT_TOKEN;
        }

        exec(`op read "${opReference}"`, { env, timeout: 15000 }, (error, stdout, stderr) => {
            if (error) {
                const msg = (stderr || error.message || '').trim();
                console.error(`❌ [Vault] Failed to read: ${opReference}`);
                reject(new Error(`[Vault] op CLI error for ${opReference}: ${msg}`));
                return;
            }

            const value = stdout.trim();
            _cache.set(opReference, value);
            resolve(value);
        });
    });
}

/**
 * Preload multiple secrets in parallel at startup.
 * Reduces total latency when multiple secrets are needed.
 * 
 * @param {string[]} refs Array of op:// reference URIs
 * @returns {Promise<Map<string, string>>} Map of reference → value
 */
async function preloadSecrets(refs) {
    const results = await Promise.allSettled(refs.map(r => getSecret(r)));
    const map = new Map();
    refs.forEach((ref, i) => {
        if (results[i].status === 'fulfilled') {
            map.set(ref, results[i].value);
        } else {
            console.error(`❌ [Vault] Preload failed for ${ref}: ${results[i].reason.message}`);
        }
    });
    return map;
}

/**
 * Clear the in-memory cache. Useful for testing.
 */
function clearCache() {
    _cache.clear();
}

module.exports = { getSecret, preloadSecrets, clearCache };
