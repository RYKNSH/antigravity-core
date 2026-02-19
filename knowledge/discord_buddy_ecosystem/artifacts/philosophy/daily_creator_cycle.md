# Daily Creator Cycle (Creator Community Pattern)

The **Daily Creator Cycle** is a strategic architectural pattern for Discord-based creator communities. It transforms a static server into a dynamic "factory" that guides users from passive consumption to active production and eventually to market launch.

## 1. The Core Lifecycle

The cycle defines five distinct stages that every active community member should traverse:

1.  **HOME (Entrance)**: The starting point. Focuses on **Onboarding** and **Vision Alignment**. Users understand the rules and the goal of the collective.
2.  **LABO (Research/Input)**: The "Hacking" phase. Focuses on **Information Ingest**. Users consume AI news, experimental tool reviews, and cutting-edge tech trends.
3.  **ACADEMY (Learning/Practice)**: The "Skill-Up" phase. Focuses on **Curriculum & Mentorship**. Users follow structured paths to turn raw information into actionable skill sets.
4.  **CREATIVE (Production/Output)**: The "Workshop" phase. Focuses on **Showcasing & Feedback**. Users submit work (WIP), receive "Dojo-style" (hardcore) feedback, and iterate on their projects.
5.  **LAUNCHPAD (Distribution/Market)**: The "Final Output" phase. Focuses on **Strategy & Launch**. Users collaborate on project recruiting, develop launch strategies, and eventually release their creations to the world.

## 2. Implementation: Category Flow

In the `schema.json`, this cycle is enforced through the physical ordering of categories, ensuring the user's sidebar reflects this logical progression:

-   `📅 EVENTS | イベント` (**Hub**: The energetic starting point of the loop)
-   `📖 PLAY GUIDE | プレイガイド` (**HOME**: Clean onboarding and vision alignment)
-   `📢 ANNOUNCEMENTS | インフォメーション` (**Info**: Crucial updates)
-   `🔬 LABO | 最新AI研究室` (**LABO**: Fast input of latest AI trends)
-   `🎓 COURSES | カリキュラム` (**ACADEMY**: Read-only structured curriculum steps 1-6)
-   `🛠️ TECHNIQUES | 実践とUGC` (**CREATIVE**: Mirrored output galleries - The Mirror Pattern)
-   `📚 CASE STUDIES | ケーススタディ` (**Social Proof**: Learning from peers)
-   `🛒 MARKETPLACE | マーケット` (**LAUNCHPAD**: Economy, wallet, and market launch)
-   `⚙️ SYSTEM | システム`

## 3. The 120% UX Role: "Synchronizer"

To ensure this cycle remains intact, the platform uses two critical mechanisms:
-   **Strict Schema Enforcement (Pruning)**: Automatically removing channels that distract from this core flow.
-   **Position Synchronization**: Programmatically reordering categories and channels periodically (or via `/setup`) to maintain the visual hierarchy of the cycle.

## 4. Value Proposition

By structuring a server around the Daily Creator Cycle, a community moves beyond being a simple "Chat Room" and becomes a **High-Throughput Creator Ecosystem** where the path to success (from news input to market launch) is physically built into the interface.

## 5. Advanced Implementation: The Mirror Pattern (Tutorial -> UGC)

To maximize the transition from "Student" to "Creator", the cycle often employs a **Mirror Pattern**:

- **COURSES (Read-Only)**: A series of channels (e.g., Step 1 to 6) containing structured lessons, prompts, and vision. Users consume information here.
- **TECHNIQUES (Forum/UGC)**: A mirrored series of forum channels with identical names to the Courses. This provides a designated, frictionless space for users to post the specific outputs required for each course step.

This visual and structural alignment reinforces the "Input-Output" reflex, creating a low-barrier psychological bridge for users to start sharing their work.

## 6. Localized Identity Tier (UX Personalization)

To bridge the gap between "System" and "Sanctuary", high-engagement cycles often apply a **Localized Identity Tier**:

- **Terminology**: Replacing technical slugs (e.g., `Mindset`, `Project Design`) with local language terms (e.g., `マインドセット`, `プロジェクト設計`).
- **Emotional Priming**: Ensuring the naming convention reflects human action (e.g., adding "Share" or "Log" in the local language) to lower the psychological barrier to participation.
- **Premium Separators**: Using specific characters like `｜` (Vertical Bar) instead of generic dots `・` to create a structured, professional, and "high-end" vibe.
- **Pinned Descriptions (Permanent Vision Layer)**: Ensuring that the initial purpose or guide for each localized channel is automatically pinned. This prevents the vision from being buried by user conversation, maintaining a consistent environment regardless of the channel's history.
- **Visual Consistency**: Using emojis and localized labels to make the server feel like a "Home" rather than an "Instrument".
