# AI Models & Media MCP Servers

AIモデルへのアクセスやメディア生成、コミュニケーションを自動化するためのMCPサーバーです。

## LLM API サーバー

他社のモデルを現在のコンテキストから呼び出すことができます。

### OpenAI
- **Package**: `mcp-openai`
- **Env**: `OPENAI_API_KEY`

### Anthropic
- **Package**: `@anthropic-ai/claude-code-mcp`
- **Env**: `ANTHROPIC_API_KEY`

### Google Gemini
- **Package**: `mcp-server-gemini`
- **Env**: `GOOGLE_API_KEY`

## コミュニケーション

### Discord
Discordボットを介してメッセージの読み書き、チャンネル管理を行います。

- **Package**: `@missionsquad/mcp-discord`
- **Env**: `DISCORD_BOT_TOKEN`
- **Configuration** (Cursor/Claude Desktop/Antigravity):
  ```json
  "discord": {
    "command": "npx",
    "args": ["-y", "@missionsquad/mcp-discord"],
    "env": {
      "DISCORD_BOT_TOKEN": "YOUR_TOKEN_HERE"
    }
  }
  ```
- **Prerequisites**: Discord Developer Portal で Bot を作成。
  - **Gateway Intents**: `MESSAGE_CONTENT` を明示的に有効にする必要があります。さもなければ、メッセージ内容が取得できません。
  - **Permissions**: Bot に `Send Messages`, `Read Message History` などの権限を付与した URL でサーバーへ招待してください。
  - **Limitations**: Discord の仕様により、Bot はプログラムから新しいサーバー（Guild）を作成することはできません。手動で作成したサーバーに Bot を招待する必要があります。

## メディア生成

### ElevenLabs
音声合成（TTS）や効果音生成を行います。

- **Package**: `elevenlabs-mcp` (または `uvx elevenlabs-mcp`)
- **Env**: `ELEVENLABS_API_KEY`, `ELEVENLABS_MCP_BASE_PATH` (保存先)
