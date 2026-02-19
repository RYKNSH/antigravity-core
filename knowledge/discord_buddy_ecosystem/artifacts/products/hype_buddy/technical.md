# Hype Buddy: Technical Architecture & Implementation

## 1. System Design
Hype Buddy uses a layered architecture to sense community activity and respond via AI-driven personas using Discord Webhooks.

### Layered Architecture
- **Sensing Layer (`src/sensing`)**: Normalizes events and extracts image URLs.
- **Brain Layer (`src/brain`)**: Orchestration via Gemini 2.0 Flash with Multimodal and KPI reasoning.
- **Action Layer (`src/action`)**: Manifests responses via localized webhooks.

---

## 2. Data Models & Schema

### 2.1 NPC Profile (Persona)
Defines name, role, and personality prompts for the "actors".
```json
{
  "id": "npc_001",
  "name": "Ken_The_Warrior",
  "role_type": "Chatter",
  "personality_prompt": "熱血漢。FPS好き。語尾は『だぜ』。",
  "avatar_url": "s3://bucket/ken.png",
  "affinity_score": 0.85
}
```

### 2.2 Server Goal / Context
```json
{
  "server_id": "123456789",
  "current_goal": "QUEST_PARTICIPATION",
  "target_url": "https://game.link/quest",
  "vibe_temperature": "HIGH"
}
```

### 2.3 SQL Persistence (SQLAlchemy)
- **PersonaModel (`personas`)**: Persistent profiles.
- **InteractionModel (`interactions`)**: Logs messages with `kpi_score` (Vibe Score).
- **ServerGoalModel (`server_goals`)**: Tracks guild-specific objectives.

---

## 3. Integration Patterns

### LLM JSON Mode
 Gemini 2.0 Flash is enforced to output structured JSON for programmatic decision-making.
```json
{
  "should_reply": boolean,
  "selected_persona_id": string | null,
  "reply_content": string | null
}
```

### Webhook Masquerading
The bot emulates multiple users via channel webhooks.
```python
async def send_as_persona(self, channel_id: int, persona: Persona, content: str):
    webhook = await self.get_or_create_webhook(channel)
    await webhook.send(content=content, username=persona.name, avatar_url=persona.avatar_url)
```

---

## 4. Technical Specifications

### Functional
- **Multimodal Sensing**: Image analysis within 5s for context-aware reactions.
- **Goal-Oriented Behavior**: Dynamic ratio of actively chatting vs. reacting bots.
- **Human Dynamics**: Artificial typing indicators, "typos", and correction chains.

### Performance & Reliability
- **Latency**: Reaction within 5s of sensing.
- **API Hygiene**: Request queuing with jitter to stay within Discord rate limits.
- **Hermetic Build**: Managed via `uv` on SSD for zero-host-footprint deployment.

---

## 5. Troubleshooting Reference

- **Dev Server Hang**: If the dashboard or bot server hangs (no reload), kill processes (`pkill -f "next dev"`) and restart.
- **Turbopack Cache**: If startup fails with "invalid digit" errors on SSD, use `rm -rf .next`.
- **Python site.py Unicode**: Use `PYTHONNOUSERSITE=1` to isolate from host resource-fork pollution.
