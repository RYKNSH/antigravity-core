const https = require('https');
const fs = require('fs');
const path = require('path');
const prompts = require('./social_prompts');

// 1. Env Setup
let envPath = path.join(process.cwd(), '.env');
if (!fs.existsSync(envPath)) {
    envPath = '${process.env.ANTIGRAVITY_DIR || path.join(require("os").homedir(), ".antigravity")}/.env';
}
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) process.env[match[1].trim()] = match[2].trim().replace(/^["'](.*)["']$/, '$1');
    });
}

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// 2. Helper: Notion API
async function notionRequest(endpoint, method, body) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.notion.com',
            path: endpoint,
            method: method,
            headers: {
                'Authorization': `Bearer ${NOTION_API_KEY}`,
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28'
            }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) resolve(JSON.parse(data));
                else reject(new Error(`Notion API Error ${res.statusCode}: ${data}`));
            });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

// 3. Helper: OpenAI API
async function openaiRequest(endpoint, body) {
    if (!OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY");
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.openai.com',
            path: endpoint,
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) resolve(JSON.parse(data));
                else reject(new Error(`OpenAI API Error ${res.statusCode}: ${data}`));
            });
        });
        req.on('error', reject);
        req.write(JSON.stringify(body));
        req.end();
    });
}

// 4. Main Logic
async function main() {
    console.log('🖼️ Starting Social Asset Generation...');

    try {
        // A. Find "Ready" articles that MISS social assets
        // Criteria: Status=Ready AND (X_Post_Text is empty OR Social_Distribution_Status is not Done)
        // For simplicity, let's filter for Status=Ready for now and check properties in code
        const query = await notionRequest(`/v1/databases/${NOTION_DATABASE_ID}/query`, 'POST', {
             filter: {
                 property: "Status",
                 select: { equals: "Ready" }
             }
        });

        const pages = query.results;
        console.log(`Found ${pages.length} Ready articles.`);

        for (const page of pages) {
            const title = page.properties['ドキュメント名']?.title?.[0]?.plain_text || "Untitled";
            const xText = page.properties['X_Post_Text']?.rich_text?.[0]?.plain_text;
            
            // Skip if already has X text (assuming if X is there, others are too, or we re-run)
            // Or check a specific "Social_Distribution_Status"
            const distStatus = page.properties['Social_Distribution_Status']?.select?.name;
            if (distStatus === 'Done' || (xText && xText.length > 5)) {
                console.log(`⏩ Skipping "${title}" (Assets already exist or Done).`);
                continue;
            }

            console.log(`🎨 Generating assets for: "${title}"...`);

            // Fetch Content for context
            // (Simplified: using title only for now to save tokens, or implement fetch blocks if needed)
            // let content = ... (use existing fetch logic if needed) 
            
            // --- 1. Text Generation ---
            let socialTexts = { twitter: "", facebook: "", threads: "" };
            if (OPENAI_API_KEY) {
                console.log('   🤖 Generating copy via OpenAI...');
                try {
                    const completion = await openaiRequest('/v1/chat/completions', {
                        model: "gpt-4", // or gpt-3.5-turbo
                        messages: [
                            { role: "system", content: prompts.getSocialSystemPrompt() },
                            { role: "user", content: `Article Title: ${title}\nPlease generate social posts.` }
                        ],
                        response_format: { type: "json_object" }
                    });
                    
                    socialTexts = JSON.parse(completion.choices[0].message.content);
                } catch (e) {
                    console.error('   ❌ OpenAI Text Gen Failed:', e.message);
                }
            } else {
                console.log('   ⚠️ Missing OpenAI Key. Generating MOCK placeholders.');
                socialTexts = {
                    twitter: `[MOCK] ${title} is out! Check it out. #SoloPro`,
                    facebook: `[MOCK] New article: ${title}. Read more here.`,
                    threads: `[MOCK] ${title}. Thoughts?`
                };
            }

            // --- 2. Image Generation ---
            let imageUrl = "";
            let imagePrompt = prompts.getImagePrompt(title, "");
            
            // Note: Sending DALL-E image to Notion Cover requires the URL to be hosted/public. 
            // DALL-E URLs expire. We might just store the Prompt for now, OR upload to Notion if URL is valid.
            // Notion API 'cover' property takes an external URL.
            
            if (OPENAI_API_KEY) {
                console.log('   🎨 Generating image via DALL-E 3...');
                try {
                    const imageRes = await openaiRequest('/v1/images/generations', {
                        model: "dall-e-3",
                        prompt: imagePrompt,
                        n: 1,
                        size: "1024x1024",
                        quality: "standard" // "hd" is sharper
                    });
                    imageUrl = imageRes.data[0].url;
                    // Note: DALL-E URLs expire in an hour. Notion needs to download it? 
                    // Actually Notion 'external' block just links it. It might break later.
                    // Ideally we upload to a storage bucket (S3/Cloudinary) then Notion. 
                    // For now, we will just LINK it and hope Notion caches it (it often does for Covers).
                } catch (e) {
                    console.error('   ❌ Image Gen Failed:', e.message);
                }
            } else {
                console.log('   ⚠️ Missing OpenAI Key. Skipping Image Gen.');
            }

            // --- 3. Update Notion ---
            console.log('   💾 Saving to Notion...');
            const updateProps = {
                "X_Post_Text": { rich_text: [{ text: { content: socialTexts.twitter } }] },
                "FB_Post_Text": { rich_text: [{ text: { content: socialTexts.facebook } }] },
                "Threads_Post_Text": { rich_text: [{ text: { content: socialTexts.threads } }] },
                "Social_Image_Prompt": { rich_text: [{ text: { content: imagePrompt } }] },
                "Social_Distribution_Status": { select: { name: "Ready" } }
            };

            // Prepare Page Update Payload
            const payload = { properties: updateProps };
            
            // If we have an image, set it as Cover
            if (imageUrl) {
                payload.cover = {
                    type: "external",
                    external: { url: imageUrl }
                };
            }

            await notionRequest(`/v1/pages/${page.id}`, 'PATCH', payload);
            console.log(`   ✅ Assets saved for "${title}"`);
        }

    } catch (e) {
        console.error('❌ Fatal Error:', e);
    }
}

main();
