const { curlRequest } = require('./lib/curl_client');
const path = require('path');
const fs = require('fs');
const { loadEnv, getSecret } = require(require('path').join(__dirname, 'env_loader'));

// 1Password 優先で環境変数をロード
loadEnv();

const NOTION_API_KEY = getSecret('NOTION_API_KEY');

if (!NOTION_API_KEY) {
    console.error("Error: NOTION_API_KEY is not set.");
    process.exit(1);
}

// URL or ID from command line
const input = process.argv[2];
if (!input) {
    console.error("Usage: node fetch_notion_page.js <Page_URL_or_ID>");
    process.exit(1);
}

// Extract ID from URL if necessary
let pageId = input;
if (input.includes('notion.so')) {
    const match = input.match(/([a-f0-9]{32})/);
    if (match) {
        pageId = match[1];
    } else {
        // Handle dash-separated IDs in URL if present
        const match2 = input.match(/-([a-f0-9-]{36})/);
        if (match2) pageId = match2[1];
    }
}

// 1. Fetch Page Metadata (Title)
function fetchPage(id) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.notion.com',
            path: `/v1/pages/${id}`,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${NOTION_API_KEY}`,
                'Notion-Version': '2022-06-28'
            }
        };
        try { resolve(curlRequest(options, null)); } catch (e) { reject(e); }
    });
}

// 2. Fetch Page Blocks (Content)
function fetchBlocks(id) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.notion.com',
            path: `/v1/blocks/${id}/children?page_size=100`,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${NOTION_API_KEY}`,
                'Notion-Version': '2022-06-28'
            }
        };
        try { resolve(curlRequest(options, null)); } catch (e) { reject(e); }
    });
}

// Main Execution
async function main() {
    try {
        const page = await fetchPage(pageId);
        const blocks = await fetchBlocks(pageId);

        // Extract Title
        let title = "Untitled";
        const titleProp = Object.values(page.properties).find(p => p.type === 'title');
        if (titleProp && titleProp.title.length > 0) {
            title = titleProp.title.map(t => t.plain_text).join('');
        }

        // Extract Content
        let content = [];

        console.error(`Debug: Found ${blocks.results.length} blocks.`);

        blocks.results.forEach(block => {
            const extractText = (richText) => {
                return richText.map(t => t.plain_text).join('').trimEnd();
            };

            if (block.type === 'paragraph') {
                // Allow empty paragraph for intentional spacing in Notion
                content.push(block.paragraph.rich_text.length > 0 ? extractText(block.paragraph.rich_text) : "");
            } else if (block.type === 'heading_1' && block.heading_1.rich_text.length > 0) {
                content.push('# ' + extractText(block.heading_1.rich_text));
            } else if (block.type === 'heading_2' && block.heading_2.rich_text.length > 0) {
                content.push('## ' + extractText(block.heading_2.rich_text));
            } else if (block.type === 'heading_3' && block.heading_3.rich_text.length > 0) {
                content.push('### ' + extractText(block.heading_3.rich_text));
            } else if (block.type === 'bulleted_list_item' && block.bulleted_list_item.rich_text.length > 0) {
                content.push('- ' + extractText(block.bulleted_list_item.rich_text));
            } else if (block.type === 'numbered_list_item' && block.numbered_list_item.rich_text.length > 0) {
                content.push('1. ' + extractText(block.numbered_list_item.rich_text));
            } else if (block.type === 'quote' && block.quote.rich_text.length > 0) {
                content.push('> ' + extractText(block.quote.rich_text));
            } else if (block.type === 'callout' && block.callout.rich_text.length > 0) {
                content.push('> [!NOTE]\n> ' + extractText(block.callout.rich_text));
            } else if (block.type === 'code' && block.code.rich_text.length > 0) {
                content.push('```' + block.code.language + '\n' + extractText(block.code.rich_text) + '\n```');
            } else {
                // content.push(`[Unsupported Block: ${block.type}]`);
            }
        });

        // Use double newline for 1 empty line between blocks (Standard spacing)
        const fullText = title + "\n\n" + content.join("\n\n");
        console.log(fullText);

    } catch (e) {
        console.error(e.message);
        process.exit(1);
    }
}

main();
