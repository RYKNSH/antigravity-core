# Discord Buddy: Bot Plugins Architecture

Discord Buddy uses a pluggable architecture to deploy autonomous bot capabilities. The core logic resides in the `@discord-buddy/bot-plugins` package.

## 1. Plugin Framework (@discord-buddy/bot-plugins)

The framework allows for dynamic loading of bot features, reducing coupling between the platform and specific bot implementations.

### Core Structure
- **Registry**: A central `PluginManager` handles registration and initialization.
- **Intent Aggregation**: The `PluginManager` calculates the minimal `GatewayIntentBits` required by all active plugins.
- **Independence**: Each plugin manages its own configuration and event handlers.

### Usage Pattern
```typescript
import { createPluginManager, conciergePlugin, voicePlugin } from '@discord-buddy/bot-plugins';
const manager = createPluginManager();
manager.register(conciergePlugin);
manager.register(voicePlugin);

const client = new Client({ intents: manager.getRequiredIntents() });
client.once('ready', () => manager.initializeAll(client, config));
```

## 2. Voice Plugin Implementation

The Voice plugin enables low-latency, AI-powered voice conversations using the OpenAI Realtime API.

### Audio Pipeline (FFmpeg Bridge)
- **Input**: Discord Opus audio -> PCM16 (24kHz Mono) -> OpenAI audio buffer.
- **Output**: OpenAI audio deltas (PCM16 24kHz) -> FFmpeg (48kHz Stereo) -> `@discordjs/voice` AudioPlayer.

### Key Logic
- **WebSocket Connection**: Connects to `wss://api.openai.com/v1/realtime` with modalities `text` and `audio`.
- **Inactivity Management**: Automatically shuts down sessions and deletes ephemeral voice channels after inactivity (default 60s) or when members leave.

## 3. Concierge Plugin
The Concierge plugin provides high-fidelity support interactions via private threads and webhooks, ensuring a polished UI experience for community members.
