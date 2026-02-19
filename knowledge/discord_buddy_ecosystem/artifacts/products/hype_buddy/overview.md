# Hype Buddy: Community Orchestrator

## 1. Vision & Strategy
**Hype Buddy** (Internal ID: `crew`) transforms static Discord servers into vibrant communities by orchestrating a "crowd" of AI-driven pseudo-personas. Unlike utility bots, it emulates a group of active users to maintain social momentum and prevent the "Empty Screen Anxiety" of quiet servers.

### Core Values
- **Crowd Simulation**: Uses Webhooks to emulate multiple personalities from a single instance.
- **KPI-Driven Autonomy**: Guided by guild objectives (e.g., click-throughs, engagement).
- **UI Honesty**: Every visible affordance must be data-driven. "Functional honesty" is prioritized over mock designs ("The Standee Paradox").

---

## 2. Technical Architecture

### Layered System
- **Bot Layer (`src/bot`)**: Discord Gateway entry point.
- **Sensing Layer (`src/sensing`)**: Captures text, voice (STT), and images (Vision). Extracts `ChatContext` with multimodal assets.
- **Brain Layer (`src/brain`)**: LLM Orchestrator using **Gemini 2.0 Flash**. Processes context to select a persona and generate behavioral responses.
- **Action Layer (`src/action`)**: Webhook masquerading to manifest selected personas.

### Data Models
- **NPC Profile (Persona)**: Defines name, role, and personality prompts.
- **Interaction Logic**: Logs every message with a `kpi_score` (Vibe Score) to track engagement quality.
- **Server Goals**: Guild-specific "Prime Directives" for the orchestrator.

---

## 3. Implementation Details

### Core Workflows
1. **Sensing**: Normalizes events and extracts image URLs.
2. **Reasoning**: Gemini 2.0 analyze "vibe" and image content.
3. **Execution**: Dynamic webhook dispatching with persona metadata.

### Operational Standards
- **Hermetic Environment**: Managed via `uv` on SSD.
- **Dashboard Integration**: Managed via the **Server Detail View** (`/dashboard/servers/[serverId]/crew`). Redirects use the `state=returnTo` pattern for seamless context inheritance.
- **Turbopack Resilience**: `rm -rf .next` is the standard fix for cache corruption on SSD/exFAT.

---

## 4. Technical Specifications

### Functional
- **Multimodal Sensing**: Image analysis within 5s of upload.
- **Goal-Oriented Behavior**: Dynamic ratio of Chatters/Lurkers/Reactors based on guild state.
- **Human-like Dynamics**: Artificial typos, corrections, and emoji reaction chains.

### Non-Functional
- **Latency**: Reaction within 5s of trigger.
- **API Hygiene**: Request queuing with jitter to respect ratelimits.
- **Cost Efficiency**: Sleep modes for LLM inference during inactivity.

---

## 5. Narrative: Substance > Form
The "AI時代はUI/UXより内容の質が大事だから" (Substance > Form) philosophy dictates that a functional, data-driven UI is superior to a polished but hardcoded one. This was formalized after a discovery where a hardcoded invite button ("The Standee") led to a "Discovery Loop" failure. 120% Quality requires that every element the user touches is "real."
