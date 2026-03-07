const https = require('https');
const fs = require('fs');
const path = require('path');

// 1. Global Env Retrieval
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
const NOTION_API_KEY = process.env.NOTION_API_KEY;

if (!WEBHOOK_URL) {
    console.error("Error: DISCORD_WEBHOOK_URL is not set.");
    process.exit(1);
}

// 2. Argument Parsing
// Usage: node discord_poster.js <Notion_Page_ID>
const pageId = process.argv[2];
if (!pageId) {
    console.error("Usage: node discord_poster.js <Notion_Page_ID>");
    process.exit(1);
}

// 3. Helpers
function notionRequest(path) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.notion.com',
            path: path,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${NOTION_API_KEY}`,
                'Notion-Version': '2022-06-28'
            }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) resolve(JSON.parse(data));
                else reject({ statusCode: res.statusCode, body: data });
            });
        });
        req.on('error', reject);
        req.end();
    });
}

function postToDiscord(content, title) {
    return new Promise((resolve, reject) => {
        // Simple chunking if > 2000 chars (Discord limit)
        // For Social Knowledge essays, we might need robust chunking.
        // Or just post a summary + link?
        // Strategy says: "Deep thoughts". Usually full text is preferred if readability is good.
        // Let's implement simple linking for now + summary, or strictly text splitting.
        
        // Better: Post Title + Link + Summary/FullText
        // For now, let's just post the link and title as a rich embed?
        // Webhooks support embeds.
        
        const payload = {
            content: content.substring(0, 1900),
            thread_name: title
        };

        // If content is very long, maybe we thread it? (Not easy with single webhook call)
        // User asked for "Notion -> Discord".
        // Let's start with a solid notification format.
        
        // Parse ID/Token
        const match = WEBHOOK_URL.match(/webhooks\/(\d+)\/(.+)/);
        const webhookId = match[1];
        const webhookToken = match[2];

        const options = {
            hostname: 'discord.com',
            path: `/api/webhooks/${webhookId}/${webhookToken}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) resolve();
                else reject({ statusCode: res.statusCode, body: data });
            });
        });
        req.on('error', reject);
        req.write(JSON.stringify(payload));
        req.end();
    });
}

async function main() {
    try {
        console.log(`Fetching Notion Page: ${pageId}...`);
        
        // Need to fetch page properties (Title)
        const page = await notionRequest(`/v1/pages/${pageId}`);
        const title = page.properties['ドキュメント名']?.title[0]?.plain_text || "Untitled";

        // Fetch blocks (Content) - Increased page_size to capture full article
        const blocks = await notionRequest(`/v1/blocks/${pageId}/children?page_size=100`);
        let excerpt = "";
        
        blocks.results.forEach(b => {
            let text = "";
            let prefix = "";
            let suffix = "\n"; // Default newline

            if (b.type === 'paragraph' && b.paragraph.rich_text.length > 0) {
                text = b.paragraph.rich_text.map(t => t.plain_text).join('');
            } else if (b.type === 'heading_1' && b.heading_1.rich_text.length > 0) {
                text = b.heading_1.rich_text.map(t => t.plain_text).join('');
                prefix = "# ";
                suffix = "\n\n";
            } else if (b.type === 'heading_2' && b.heading_2.rich_text.length > 0) {
                text = b.heading_2.rich_text.map(t => t.plain_text).join('');
                prefix = "## ";
                suffix = "\n\n";
            } else if (b.type === 'heading_3' && b.heading_3.rich_text.length > 0) {
                text = b.heading_3.rich_text.map(t => t.plain_text).join('');
                prefix = "### ";
                suffix = "\n\n";
            } else if (b.type === 'bulleted_list_item' && b.bulleted_list_item.rich_text.length > 0) {
                text = b.bulleted_list_item.rich_text.map(t => t.plain_text).join('');
                prefix = "- ";
            } else if (b.type === 'numbered_list_item' && b.numbered_list_item.rich_text.length > 0) {
                text = b.numbered_list_item.rich_text.map(t => t.plain_text).join('');
                prefix = "1. "; // Simplified
            }

            if (text) {
                excerpt += prefix + text + suffix;
            }
        });
        
        // const pageUrl = page.url; // Removed link as requested
        const msg = excerpt.trim(); // Just the content
        
        await postToDiscord(msg, title);
        console.log("✅ Posted to Discord.");

    } catch (e) {
        console.error("Error:", e);
        process.exit(1);
    }
}

main();
