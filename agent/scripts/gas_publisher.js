/**
 * Social Knowledge Publisher (GAS Ver.)
 * 
 * 概要: Notionデータベースを定期監視し、予約時刻を過ぎた記事をDiscordへ配信する。
 * 動作: タイムトリガー（15分または1時間ごと）で実行することを想定。
 */

function main() {
  const PROPS = PropertiesService.getScriptProperties();
  const NOTION_API_KEY = PROPS.getProperty('NOTION_API_KEY');
  const NOTION_DATABASE_ID = PROPS.getProperty('NOTION_DATABASE_ID');
  const DISCORD_WEBHOOK_URL = PROPS.getProperty('DISCORD_WEBHOOK_URL');

  if (!NOTION_API_KEY || !NOTION_DATABASE_ID || !DISCORD_WEBHOOK_URL) {
    Logger.log('❌ Error: Missing Script Properties. Please set NOTION_API_KEY, NOTION_DATABASE_ID, DISCORD_WEBHOOK_URL.');
    return;
  }

  Logger.log('⏰ Checking for due articles...');

  // 1. Query "Ready" posts with Date
  const url = `https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}/query`;
  const options = {
    method: 'post',
    headers: {
      'Authorization': `Bearer ${NOTION_API_KEY}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28'
    },
    payload: JSON.stringify({
      filter: {
        and: [
          {
            property: 'Status',
            select: {
              equals: 'Ready'
            }
          },
          {
            property: '予約日時',
            date: {
              is_not_empty: true
            }
          }
        ]
      }
    }),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const json = JSON.parse(response.getContentText());

  if (response.getResponseCode() !== 200) {
    Logger.log(`❌ Notion API Error: ${response.getContentText()}`);
    return;
  }

  const pages = json.results;
  const now = new Date();
  let publishedCount = 0;

  pages.forEach(page => {
    const title = page.properties['ドキュメント名']?.title?.[0]?.plain_text || "Untitled";
    const dateStr = page.properties['予約日時']?.date?.start;
    
    if (!dateStr) return;

    const scheduleTime = new Date(dateStr);

    if (scheduleTime <= now) {
      Logger.log(`🚀 DUE: "${title}" (Scheduled: ${dateStr})`);
      
      try {
        // 2. Fetch Content
        const content = fetchPageContent(NOTION_API_KEY, page.id);
        
        // 3. Post to Discord
        postToDiscord(DISCORD_WEBHOOK_URL, title, page.url, content); 
        
        // 4. Update Status to "Published"
        markAsPublished(NOTION_API_KEY, page.id);
        
        publishedCount++;
        Logger.log(`   ✅ Published & Status Updated.`);
      } catch (e) {
        Logger.log(`   ❌ Failed: ${e.message}`);
      }
    } else {
      Logger.log(`⏳ Pending: "${title}" (Scheduled: ${dateStr})`);
    }
  });

  if (publishedCount === 0) {
    Logger.log('💤 No articles due.');
  }
}

function fetchPageContent(apiKey, pageId) {
  const url = `https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`;
  const options = {
    method: 'get',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Notion-Version': '2022-06-28'
    },
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  if (response.getResponseCode() !== 200) {
    Logger.log(`⚠️ Failed to fetch content for ${pageId}: ${response.getContentText()}`);
    return "Content fetch failed.";
  }

  const json = JSON.parse(response.getContentText());
  let text = "";

  // Helper to extract text from rich_text objects
  const extractText = (richTextArray) => {
    if (!richTextArray) return "";
    return richTextArray.map(t => t.plain_text).join("");
  };

  json.results.forEach(block => {
    const type = block.type;
    let blockText = "";

    if (type === 'paragraph') {
      blockText = extractText(block.paragraph.rich_text);
    } else if (type === 'heading_1') {
      blockText = "# " + extractText(block.heading_1.rich_text);
    } else if (type === 'heading_2') {
      blockText = "## " + extractText(block.heading_2.rich_text);
    } else if (type === 'heading_3') {
      blockText = "### " + extractText(block.heading_3.rich_text);
    } else if (type === 'bulleted_list_item') {
      blockText = "• " + extractText(block.bulleted_list_item.rich_text);
    } else if (type === 'numbered_list_item') {
      blockText = "1. " + extractText(block.numbered_list_item.rich_text);
    } else if (type === 'quote') {
      blockText = "> " + extractText(block.quote.rich_text);
    }

    if (blockText) {
      text += blockText + "\n\n";
    }
  });

  return text.trim();
}

function postToDiscord(webhookUrl, title, articleUrl, content) {
  // Truncate content to fit Discord limit (2000 chars)
  const maxContentLen = 1950;
  
  let finalContent = content;
  if (finalContent.length > maxContentLen) {
    finalContent = finalContent.substring(0, maxContentLen) + "...";
  }

  const payload = {
    "content": finalContent,
    "thread_name": title
  };

  const options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };

  const response = UrlFetchApp.fetch(webhookUrl, options);
  const code = response.getResponseCode();

  if (code >= 400) {
    const errorBody = response.getContentText();
    Logger.log(`❌ Discord Webhook Error (${code}): ${errorBody}`);
    throw new Error(`Discord Webhook failed with status ${code}`);
  }
}

function markAsPublished(apiKey, pageId) {
  const url = `https://api.notion.com/v1/pages/${pageId}`;
  UrlFetchApp.fetch(url, {
    method: 'patch',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28'
    },
    payload: JSON.stringify({
      properties: {
        'Status': {
          select: {
            name: 'Published'
          }
        }
      }
    })
  });
}
