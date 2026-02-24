const https = require('https');
const fs = require('fs');
const path = require('path');

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

loadEnv('/Users/ryotarokonishi/Desktop/AntigravityWork/AG controller/.env');
loadEnv('/Users/ryotarokonishi/Desktop/AntigravityWork/RYKNSH records/Ada/.env');

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_MY_USER_ID = process.env.DISCORD_MY_USER_ID || process.env.ALLOWED_USER_IDS?.split(',')[0]?.trim();
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hqohbmkeyampxlpmkfht.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// 2. Helper: Discord API
async function discordRequest(path) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'discord.com',
            path: `/api/v10${path}`,
            method: 'GET',
            headers: {
                'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
                'Content-Type': 'application/json'
            }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try { resolve(JSON.parse(data)); }
                    catch (e) { reject(new Error(`Discord parse error: ${e.message}`)); }
                } else {
                    reject(new Error(`Discord API Error ${res.statusCode}: ${data}`));
                }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

// 3. Helper: Supabase Insert
async function supabaseInsert(records) {
    return new Promise((resolve, reject) => {
        const url = new URL('/rest/v1/life_logs', SUPABASE_URL);
        const body = JSON.stringify(records);
        const options = {
            hostname: url.hostname,
            path: url.pathname,
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=ignore-duplicates'
            }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(true);
                } else {
                    reject(new Error(`Supabase Error ${res.statusCode}: ${data}`));
                }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

// 4. Main Logic
async function main() {
    if (!DISCORD_BOT_TOKEN) {
        console.error('❌ DISCORD_BOT_TOKEN not found');
        process.exit(1);
    }
    if (!DISCORD_MY_USER_ID) {
        console.error('❌ DISCORD_MY_USER_ID or ALLOWED_USER_IDS not found. Set DISCORD_MY_USER_ID in your .env');
        process.exit(1);
    }

    console.error(`🎙️ Discord Log Collector starting... (User: ${DISCORD_MY_USER_ID})`);

    // Get all guilds the bot is in
    const guilds = await discordRequest('/users/@me/guilds');
    console.error(`📡 Found ${guilds.length} guilds`);

    const collected = [];
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(); // Last 48h

    for (const guild of guilds) {
        try {
            const channels = await discordRequest(`/guilds/${guild.id}/channels`);
            const textChannels = channels.filter(c => c.type === 0); // GUILD_TEXT only

            for (const channel of textChannels.slice(0, 10)) { // Limit to 10 channels per guild
                try {
                    const messages = await discordRequest(
                        `/channels/${channel.id}/messages?limit=50`
                    );

                    // Filter: only my own messages
                    const myMessages = messages.filter(m => m.author.id === DISCORD_MY_USER_ID);

                    for (const msg of myMessages) {
                        if (msg.content && msg.content.length > 5) {
                            collected.push({
                                source: 'discord',
                                content: msg.content,
                                metadata: {
                                    guild_id: guild.id,
                                    guild_name: guild.name,
                                    channel_id: channel.id,
                                    channel_name: channel.name,
                                    message_id: msg.id
                                },
                                logged_at: msg.timestamp
                            });
                        }
                    }

                    // Small delay to avoid rate limiting
                    await new Promise(r => setTimeout(r, 200));
                } catch (e) {
                    // Skip channels with permission errors
                    if (!e.message.includes('403')) {
                        console.error(`  ⚠️ Channel ${channel.name}: ${e.message}`);
                    }
                }
            }
        } catch (e) {
            console.error(`  ⚠️ Guild ${guild.name}: ${e.message}`);
        }
    }

    console.error(`✅ Collected ${collected.length} messages from Discord`);

    if (collected.length > 0) {
        await supabaseInsert(collected);
        console.error(`💾 Saved ${collected.length} entries to life_logs`);
    }

    console.log(JSON.stringify({ collected: collected.length, source: 'discord' }));
}

main().catch(e => {
    console.error('❌ Fatal error:', e.message);
    process.exit(1);
});
