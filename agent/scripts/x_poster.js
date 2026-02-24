const https = require('https');
const crypto = require('crypto');
const fs = require('fs');

// 1. Env Setup
function loadEnv(filePath) {
    if (fs.existsSync(filePath)) {
        const envConfig = fs.readFileSync(filePath, 'utf8');
        envConfig.split('\n').forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim().replace(/^["'](.*)["']$/, '$1');
                if (!process.env[key]) process.env[key] = value;
            }
        });
    }
}

loadEnv('/Users/ryotarokonishi/.antigravity-private/.env');
loadEnv('/Users/ryotarokonishi/Desktop/AntigravityWork/RYKNSH records/Ada/.env');

const API_KEY = process.env.X_API_KEY;
const API_SECRET = process.env.X_API_SECRET;
const ACCESS_TOKEN = process.env.X_ACCESS_TOKEN;
const ACCESS_SECRET = process.env.X_ACCESS_SECRET;

// 2. OAuth 1.0a Signature (Twitter requires this for v1.1 or v2 user-context)
function buildOAuthHeader(method, url, params) {
    const oauthParams = {
        oauth_consumer_key: API_KEY,
        oauth_nonce: crypto.randomBytes(16).toString('hex'),
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
        oauth_token: ACCESS_TOKEN,
        oauth_version: '1.0'
    };

    const allParams = { ...params, ...oauthParams };
    const sortedKeys = Object.keys(allParams).sort();
    const paramStr = sortedKeys
        .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(allParams[k])}`)
        .join('&');

    const baseStr = [
        method.toUpperCase(),
        encodeURIComponent(url),
        encodeURIComponent(paramStr)
    ].join('&');

    const signingKey = `${encodeURIComponent(API_SECRET)}&${encodeURIComponent(ACCESS_SECRET)}`;
    const signature = crypto.createHmac('sha1', signingKey).update(baseStr).digest('base64');
    oauthParams.oauth_signature = signature;

    const headerParts = Object.keys(oauthParams).sort().map(
        k => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`
    );
    return 'OAuth ' + headerParts.join(', ');
}

// 3. Post Tweet (Twitter API v2)
async function postTweet(text) {
    if (!API_KEY || !API_SECRET || !ACCESS_TOKEN || !ACCESS_SECRET) {
        throw new Error(
            'Missing X API credentials. Please set X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET in ~/.antigravity-private/.env'
        );
    }

    const url = 'https://api.twitter.com/2/tweets';
    const body = JSON.stringify({ text });
    const oauthHeader = buildOAuthHeader('POST', url, {});

    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'api.twitter.com',
            path: '/2/tweets',
            method: 'POST',
            headers: {
                'Authorization': oauthHeader,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try { resolve(JSON.parse(data)); }
                    catch (e) { resolve(data); }
                } else {
                    reject(new Error(`X API Error ${res.statusCode}: ${data}`));
                }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

// 4. Run (accepts piped JSON or direct arg)
async function run(jsonStr) {
    let tweet;
    try {
        const content = JSON.parse(jsonStr);
        tweet = content.tweet || content.title;
    } catch (e) {
        // If it's not JSON, treat it as raw tweet text
        tweet = jsonStr.trim();
    }

    if (!tweet) {
        console.error('❌ No tweet content found in input');
        process.exit(1);
    }

    // Trim to 280 chars (X limit)
    if (tweet.length > 280) tweet = tweet.slice(0, 277) + '...';

    console.error(`🐦 Posting to X: "${tweet.slice(0, 60)}..."`);
    const result = await postTweet(tweet);
    console.error(`✅ Tweet posted! ID: ${result?.data?.id}`);
    console.log(JSON.stringify(result));
}

if (process.argv[2]) {
    run(process.argv[2]);
} else {
    let input = '';
    process.stdin.on('data', chunk => input += chunk);
    process.stdin.on('end', () => run(input));
}
