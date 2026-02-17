const https = require('https');
const fs = require('fs');
const path = require('path');

// 1. Global Env Retrieval
let envPath = path.join(process.cwd(), '.env');
if (!fs.existsSync(envPath)) {
    // Fallback to SSD global env
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

if (!NOTION_API_KEY || !NOTION_DATABASE_ID) {
    console.error('Error: Credentials not found. Please set NOTION_API_KEY and NOTION_DATABASE_ID in .env');
    process.exit(1);
}

// 2. Constants
const STATUS_PROP = "Status";
const DATE_PROP = "予約日時";
const TITLE_PROP = "ドキュメント名";

const GOLDEN_HOURS = [8, 12, 18, 22]; // JST

// 3. Helper Functions
function request(path, method, body) {
    return new Promise((resolve, reject) => {
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

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(JSON.parse(data));
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

function getNextGoldenTime() {
    // Current time in JST (System time is JST based on metadata)
    const now = new Date();
    
    // Find next slot today
    for (const h of GOLDEN_HOURS) {
        const slot = new Date(now);
        slot.setHours(h, 0, 0, 0);
        if (slot > now) {
            return slot;
        }
    }

    // If no slots left today, pick first slot tomorrow
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(GOLDEN_HOURS[0], 0, 0, 0);
    return tomorrow;
}

// Format date to ISO string without offset (YYYY-MM-DDTHH:mm:ss) for Notion with time_zone parameter
function formatToIsoLocal(date) {
    const pad = (n) => n.toString().padStart(2, '0');
    const y = date.getFullYear();
    const m = pad(date.getMonth() + 1);
    const d = pad(date.getDate());
    const h = pad(date.getHours());
    
    // Allow variable minutes if we want random jitter, but sticking to :00 for now
    const min = pad(date.getMinutes());
    const s = pad(date.getSeconds());
    
    return `${y}-${m}-${d}T${h}:${min}:${s}`;
}

async function main() {
    console.log('🔍 Searching for "Ready" posts without scheduled date...');

    try {
        // 1. Find the LATEST occupied slot among Ready/Scheduled posts
        console.log('🔍 Checking for existing future reservations...');
        const occupiedResponse = await request(`/v1/databases/${NOTION_DATABASE_ID}/query`, 'POST', {
            filter: {
                and: [
                    {
                        property: STATUS_PROP,
                        select: {
                            equals: "Ready"
                        }
                    },
                    {
                        property: DATE_PROP,
                        date: {
                            is_not_empty: true
                        }
                    }
                ]
            },
            sorts: [
                {
                    property: DATE_PROP,
                    direction: "descending"
                }
            ],
            page_size: 1
        });

        let baseTime = new Date();
        if (occupiedResponse.results.length > 0) {
            const latestPage = occupiedResponse.results[0];
            const dateStr = latestPage.properties[DATE_PROP]?.date?.start;
            if (dateStr) {
                // Parse date string carefully. 
                // If it's "YYYY-MM-DD", treat as start of day? Or just 00:00?
                // If it's ISO, use it.
                // We know we save as local ISO without offset now, so 'new Date()' might auto-interpret as local or UTC depending on env?
                // Actually 'new Date("2025-01-27T08:00:00")' in Node usually treats as local if no Z.
                // Let's assume input matches our output format.
                baseTime = new Date(dateStr);
                console.log(`⏳ Found existing latest schedule: ${dateStr}`);
            }
        }

        // 2. Find Unscheduled Ready Posts
        console.log('🔍 Searching for "Ready" posts without scheduled date...'); 
        const response = await request(`/v1/databases/${NOTION_DATABASE_ID}/query`, 'POST', {
             filter: {
                 and: [
                     {
                         property: STATUS_PROP,
                         select: {
                             equals: "Ready"
                         }
                     },
                     {
                         property: DATE_PROP,
                         date: {
                             is_empty: true
                         }
                     }
                 ]
             },
             sorts: [
                 {
                    timestamp: "last_edited_time",
                    direction: "ascending" // Oldest first? or Descending? Let's do Ascending (FIFOish) or just stick to one.
                 }
             ]
         });
 
         const pages = response.results;
         if (pages.length === 0) {
             console.log('✅ No unscheduled ready posts found.');
             return;
         }
 
         console.log(`found ${pages.length} post(s) to schedule.`);
         
         // 3. Determine Start Time (Next Golden Hour AFTER baseTime)
         let targetTime = new Date(baseTime);
         
         // Move to next golden hour logic
         // We need a robust "getNextGoldenTimeFrom(date)" function
         // Inline logic for now to ensure flow
         
         function advanceToNextGolden(d) {
             const t = new Date(d);
             const currentH = t.getHours();
             const idx = GOLDEN_HOURS.findIndex(h => h > currentH);
             
             if (idx !== -1) {
                 // Found a slot later today
                 t.setHours(GOLDEN_HOURS[idx], 0, 0, 0);
             } else {
                 // Move to tomorrow first slot
                 t.setDate(t.getDate() + 1);
                 t.setHours(GOLDEN_HOURS[0], 0, 0, 0);
             }
             
             // If d was already exactly on a golden hour (e.g. from previous loop), we still need to advance?
             // If baseTime is 08:00, we want next to be 12:00.
             // The logic above: if currentH is 8, findIndex(h > 8) finds 12. Correct.
             // If currentH is 22, findIndex is -1. Tomorrow 8. Correct.
             
             // Edge case: what if t <= d (because d was not exactly logic aligned)?
             // Ensure result is strictly > d
             if (t <= d) {
                 // Should not happen with logic above unless same hour?
                 // Force +1 hour and retry? or just explicit jump?
                 // simplified:
             }
             return t;
         }

         // Initial jump
         targetTime = advanceToNextGolden(baseTime);

         // Safety: if baseTime was "Now" (no existing posts), ensuring it's in future is handled by advanceToNextGolden of (Now).
         // If baseTime was a past scheduled post (e.g. yesterday), advanceToNextGolden might pick a time in the past?
         // NO, we want "Future" schedule.
         // If "Existing Latest" is in the past (e.g. 01/26 22:00), and now is 01/27 03:00.
         // advanceToNextGolden(01/26 22:00) -> 01/27 08:00. which is > Now. OK.
         // If "Existing Latest" is 01/27 08:00 (Future). advance -> 01/27 12:00. OK.
         // What if "Existing Latest" was long ago?
         // We should probably clamp start time to max(Now, LatestExisting).
         
         const now = new Date();
         if (targetTime < now) {
             // If calculated start is in past, catch up to Now
             targetTime = advanceToNextGolden(now);
         }

         for (const page of pages) {
             const title = page.properties[TITLE_PROP]?.title[0]?.plain_text || "Untitled";
             
             console.log(`📅 Scheduling "${title}" to ${formatToIsoLocal(targetTime)}`);
 
             await request(`/v1/pages/${page.id}`, 'PATCH', {
                 properties: {
                     [DATE_PROP]: {
                         date: {
                             start: formatToIsoLocal(targetTime),
                             time_zone: "Asia/Tokyo" 
                         }
                     }
                 }
             });
 
             console.log(`✨ Scheduled!`);
 
             // Advance for next iteration
             targetTime = advanceToNextGolden(targetTime);
         }
 
     } catch (e) {
         console.error('Error:', e);
         process.exit(1);
     }
 }

main();
