const path = require('path');
const fs = require('fs');
const https = require('https');

// Simple .env parser
let envPath = path.join(process.cwd(), '.env');
if (!fs.existsSync(envPath)) {
    envPath = path.join(process.env.HOME, '.antigravity', '.env');
}

if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim().replace(/^["'](.*)["']$/, '$1');
            process.env[key] = value;
        }
    });
}

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;

if (!NOTION_API_KEY || !NOTION_DATABASE_ID) {
    console.error('Error: NOTION_API_KEY and NOTION_DATABASE_ID environment variables must be set.');
    process.exit(1);
}

const contentFile = process.argv[2];
if (!contentFile) {
    console.error('Usage: node notion_poster.js <content_file_path>');
    process.exit(1);
}

// Database Schema Configuration
const TITLE_KEY = "ドキュメント名";
const TAGS_KEY = "カテゴリー";

let content;
try {
    content = fs.readFileSync(contentFile, 'utf8');
} catch (err) {
    console.error(`Error reading file: ${err.message}`);
    process.exit(1);
}

const lines = content.split('\n');
let pageTitle = 'Untitled Checkpoint';
let startIndex = 0;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() !== '') {
        pageTitle = lines[i].trim().replace(/^#+\s*/, '');
        startIndex = i + 1;
        break;
    }
}

// --- HELPER FUNCTIONS ---

function request(options, body) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        const json = JSON.parse(data);
                        resolve(json);
                    } catch (e) {
                        resolve(data);
                    }
                } else {
                    reject({ statusCode: res.statusCode, body: data });
                }
            });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

function notionApi(path, method, body) {
    const options = {
        hostname: 'api.notion.com',
        path: path,
        method: method,
        headers: {
            'Authorization': `Bearer ${NOTION_API_KEY}`,
            'Content-Type': 'application/json',
            'Notion-Version': '2022-06-28'
        }
    };
    return request(options, body);
}

async function archiveExistingPage(title) {
    console.log(`Checking for existing pages with title: "${title}"...`);
    try {
        const response = await notionApi(`/v1/databases/${NOTION_DATABASE_ID}/query`, 'POST', {
            filter: {
                property: TITLE_KEY,
                title: {
                    equals: title
                }
            }
        });

        if (response.results && response.results.length > 0) {
            console.log(`Found ${response.results.length} existing page(s). Archiving...`);
            for (const page of response.results) {
                await notionApi(`/v1/pages/${page.id}`, 'PATCH', { archived: true });
                console.log(`Archived page: ${page.id}`);
            }
        } else {
            console.log("No duplicate pages found.");
        }
    } catch (error) {
        console.error("Error checking for duplicates:", error);
        // Continue even if check fails, to ensure post happens
    }
}

async function main() {
    // 1. Check and Archive Duplicates
    await archiveExistingPage(pageTitle);

    // 2. Prepare Payload — line-by-line to preserve article breathing pattern
    // Each text line → its own paragraph block
    // Each empty line → empty paragraph block (preserves spacing)
    const bodyLines = lines.slice(startIndex);
    const blocks = [];
    let inCodeBlock = false;
    let codeLines = [];
    let codeLang = '';

    for (const line of bodyLines) {
        // Handle code blocks
        if (line.trim().startsWith('```') && !inCodeBlock) {
            inCodeBlock = true;
            codeLang = line.trim().replace('```', '') || 'plain text';
            codeLines = [];
            continue;
        }
        if (line.trim() === '```' && inCodeBlock) {
            inCodeBlock = false;
            blocks.push({
                object: 'block',
                type: 'code',
                code: {
                    language: codeLang,
                    rich_text: [{ type: 'text', text: { content: codeLines.join('\n') } }]
                }
            });
            continue;
        }
        if (inCodeBlock) {
            codeLines.push(line);
            continue;
        }

        // Empty line → empty paragraph (preserves breathing/spacing)
        if (line.trim() === '') {
            blocks.push({
                object: 'block',
                type: 'paragraph',
                paragraph: { rich_text: [] }
            });
            continue;
        }

        // Text line → paragraph block
        blocks.push({
            object: 'block',
            type: 'paragraph',
            paragraph: {
                rich_text: [{ type: 'text', text: { content: line } }]
            }
        });
    }

    const properties = {};
    properties[TITLE_KEY] = {
        title: [{ text: { content: pageTitle } }]
    };
    properties[TAGS_KEY] = {
        multi_select: [{ name: 'Social Knowledge' }]
    };

    // Notion API limit: max 100 children per request
    const firstChunk = blocks.slice(0, 100);
    const remainingBlocks = blocks.slice(100);

    const data = {
        parent: { database_id: NOTION_DATABASE_ID },
        properties: properties,
        children: firstChunk
    };

    // 3. Create Page (with first 100 blocks)
    try {
        const response = await notionApi('/v1/pages', 'POST', data);
        console.log(`Successfully created page: ${response.url}`);

        // 4. Append remaining blocks in chunks of 100
        if (remainingBlocks.length > 0) {
            const pageId = response.id;
            for (let i = 0; i < remainingBlocks.length; i += 100) {
                const chunk = remainingBlocks.slice(i, i + 100);
                await notionApi(`/v1/blocks/${pageId}/children`, 'PATCH', { children: chunk });
            }
            console.log(`Appended ${remainingBlocks.length} additional blocks.`);
        }
    } catch (error) {
        console.error(`Error creating page: Status Code ${error.statusCode}`);
        console.error(error.body);
        process.exit(1);
    }
}

main();
