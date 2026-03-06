const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

/**
 * Executes an HTTP request using the 'curl' CLI tool.
 * Guarantees strict timeouts and retries at the OS level, avoiding Node.js socket hangs.
 */
function curlRequest(options, body = null) {
    const method = options.method || 'GET';
    const hostname = options.hostname || 'api.notion.com';
    const url = `https://${hostname}${options.path}`;

    // Core robust curl parameters: silent, max-time 15s, retry 3 times
    let curlCmd = `curl -s -w "\\n%{http_code}" -X ${method} --max-time 15 --retry 3 "${url}"`;

    for (const [key, value] of Object.entries(options.headers || {})) {
        curlCmd += ` -H "${key}: ${value}"`;
    }

    let tmpFile;
    if (body) {
        tmpFile = path.join(os.tmpdir(), `curl_payload_${crypto.randomUUID()}.json`);
        // Store payload in a file to prevent shell escaping issues with large JSON containing quotes/newlines
        fs.writeFileSync(tmpFile, JSON.stringify(body), 'utf8');
        curlCmd += ` -d @"${tmpFile}"`;
    }

    try {
        // Execute curl synchronously
        const output = execSync(curlCmd, { encoding: 'utf8' });

        if (tmpFile) {
            try { fs.unlinkSync(tmpFile); } catch (e) { }
        }

        // Parse Standard Output + HTTP Code
        // Format of output because of -w "\n%{http_code}":
        // { ...json... }
        // 200
        const lines = output.trim().split('\n');
        const statusCodeStr = lines.pop(); // last line is the status code
        const statusCode = parseInt(statusCodeStr, 10);
        const dataStr = lines.join('\n').trim();

        if (statusCode >= 200 && statusCode < 300) {
            try {
                return JSON.parse(dataStr || "{}");
            } catch (e) {
                return dataStr;
            }
        } else {
            throw { statusCode: statusCode, body: dataStr };
        }

    } catch (err) {
        if (tmpFile) {
            try { fs.unlinkSync(tmpFile); } catch (e) { }
        }
        // err.status is the exit code of curl (e.g., 28 for timeout)
        if (err.status === 28) {
            throw { statusCode: 408, body: "curl: Operation timed out (15s)" };
        }
        throw err;
    }
}

module.exports = { curlRequest };
