# ╔══════════════════════════════════════════════════════════════╗
# ║  Antigravity — Shared Environment Template                  ║
# ║  Location: ~/.antigravity/.env.shared.tpl                   ║
# ║  Purpose: 全プロジェクト共通のシークレット                        ║
# ║                                                              ║
# ║  Usage: checkin が自動で project/.env.tpl とマージして .env 生成  ║
# ║         op inject -i .env.shared.tpl -o /tmp/.env.shared     ║
# ╚══════════════════════════════════════════════════════════════╝

# --- OpenAI & Gemini ---
OPENAI_API_KEY={{ op://Automation/OpenAI/api-key }}
GEMINI_API_KEY={{ op://Automation/57qolbjkiznw5qcymidhj5yfii/credential }}

# --- AI APIs (Editor / Code / Media) ---
ANTHROPIC_API_KEY={{ op://Automation/anthropic/api-key }}
ELEVENLABS_API_KEY={{ op://Automation/elevenlabs/api-key }}
RUNWAY_API_KEY={{ op://Automation/runway/api-key }}
KLING_ACCESS_KEY={{ op://Automation/kling/access-key }}
KLING_SECRET_KEY={{ op://Automation/kling/secret-key }}

# --- Notion ---
NOTION_API_KEY={{ op://Antigravity/notion/api-key }}

# --- Chatwork ---
CHATWORK_API_TOKEN={{ op://Antigravity/chatwork/api-token }}

# --- LINE ---
LINE_CHANNEL_ACCESS_TOKEN={{ op://Antigravity/line/channel-access-token }}
LINE_CHANNEL_SECRET={{ op://Antigravity/line/channel-secret }}
OWNER_LINE_USER_ID={{ op://Antigravity/line/owner-user-id }}

# --- Twitter / X ---
TWITTER_API_KEY={{ op://Antigravity/twitter/api-key }}
TWITTER_API_SECRET={{ op://Antigravity/twitter/api-secret }}
TWITTER_ACCESS_TOKEN={{ op://Antigravity/twitter/access-token }}
TWITTER_ACCESS_TOKEN_SECRET={{ op://Antigravity/twitter/access-token-secret }}

# --- Meta ---
META_ACCESS_TOKEN={{ op://Antigravity/meta/access-token }}

# --- Twilio (Red Phone) ---
TWILIO_ACCOUNT_SID={{ op://Antigravity/twilio/account-sid }}
TWILIO_AUTH_TOKEN={{ op://Antigravity/twilio/auth-token }}
TWILIO_PHONE_NUMBER={{ op://Antigravity/twilio/phone-number }}
OWNER_PHONE_NUMBER={{ op://Antigravity/twilio/owner-phone-number }}

# --- Discord (shared across all projects) ---
DISCORD_BOT_TOKEN={{ op://Antigravity/discord/bot-token }}
DISCORD_GUILD_ID={{ op://Antigravity/discord/guild-id }}
DISCORD_OWNER_ID={{ op://Antigravity/discord/owner-id }}
DISCORD_ARCHIVE_CATEGORY_ID={{ op://Antigravity/discord/archive-category-id }}
DISCORD_APPROVAL_CHANNEL_ID={{ op://Antigravity/discord-channels/approval-channel-id }}
DISCORD_EMERGENCY_CHANNEL_ID={{ op://Antigravity/discord-channels/emergency-channel-id }}
DISCORD_APPROVAL_PLAYGROUND_ID={{ op://Antigravity/discord-channels/approval-playground-id }}
DISCORD_EMERGENCY_PLAYGROUND_ID={{ op://Antigravity/discord-channels/emergency-playground-id }}
DISCORD_GUIDE_CHANNEL_ID={{ op://Antigravity/discord-channels/guide-channel-id }}
DISCORD_CONTROL_CATEGORY_ID={{ op://Antigravity/discord-channels/control-category-id }}
DISCORD_DASHBOARD_CHANNEL_ID={{ op://Antigravity/discord-channels/dashboard-channel-id }}
DISCORD_METRICS_CHANNEL_ID={{ op://Antigravity/discord-channels/metrics-channel-id }}

# --- Discord Buddy (internal API) ---
DISCORD_BUDDY_API_KEY={{ op://Antigravity/discord-buddy/api-key }}

# --- ECAI ---
ECAI_USER={{ op://Antigravity/ecai/user }}
ECAI_PASSWORD={{ op://Antigravity/ecai/password }}

# --- EverWebinar ---
EVERWEBINAR_API_KEY={{ op://Antigravity/everwebinar/api-key }}

# --- Penpot (Design System — Community Production) ---
PENPOT_URL={{ op://Antigravity/penpot/url }}
PENPOT_ACCESS_TOKEN={{ op://Antigravity/penpot/access-token }}
