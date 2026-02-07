# The 120% Vision Perfection Loop

The **120% Vision Perfection Loop** is the core development philosophy of the ARTISTORY ecosystem. It moves beyond "fixing bugs" to "achieving the ideal state (理想系)" by iterating through the perspective of the end-user.

## 1. Core Principle
Stability (running without crashing) is the **baseline**, not the goal. The goal is to deliver an experience that exceeds the user's initial expectations (120% completion), where every interaction feels intentional, data flows seamlessly, and the UI is both beautiful and functional.

## 2. The Execution Loop

The loop consists of seven distinct phases:

1.  **UX Empathy (追体験)**: The developer uses the product exactly like a user would. This reveals "invisible" friction points—buttons that respond slowly, confusing copy, or data that technically exists but doesn't tell a story.
2.  **Gap Analysis**: Identifying the difference between the current state and the "Ideal State." This involves finding functions that are "hollow" OR architecture that is missing key vision pillars (Vision Alignment). For example, if the vision is "Launching products," yet there is no "Launch" channel, that is a 120% Gap.
3.  **Implementation Planning**: Mapping out the technical requirements to fill these gaps, prioritizing the "First Principles" of the feature.
4.  **Deep-Audit Implementation**: Executing the plan with high attention to detail (e.g., proper error handling, null-safety, and performance).
5.  **Autonomous Debugging**: Proactively finding and fixing errors before the next UX check.
6.  **Verification Feedback Loop (スキル: 検証フィードバックループ)**: A mandatory sub-loop for every implementation. No task is considered complete until it passes through this cycle:
    - **TypeScript Rigor**: Build confirmation via `npx tsc --noEmit`.
    - **Proactive Correction**: Analyzing errors, fixing, and re-building until green.
    - **E2E/Browser Check**: For UI changes, visual verification and screenshots are required to ensure the "Ideal State" is rendered.
    - **Autonomous Browser Tracing**: Using Browser Agents (e.g., Gemini 2.0 Flash) to navigate critical paths (Create -> Edit -> Verify) to detect RLS errors, hydration mismatches, and broken transitions that static tests miss.
7.  **Refinement Loop**: Repeating phases 1-6 until the experience is flawless.

## 3. Key Indicators of the 120% Vision

-   **Zero "Dead" UI**: Every button has a working handler; every stat card reflects real data.
-   **Proactive Feedback**: The system tells the user what's happening (loading states, success toasts, descriptive error messages).
-   **Sensory Polish**: Unified branding (using the `@discord-buddy/ui` system), consistent spacing, and smooth transitions.
-   **Data Integrity**: Internal IDs (UUIDs) match across ALL services; legacy data is gracefully bridged or remediated.

## 4. Relationship to "Perfect Debug Loop"

While the **Perfect Debug Loop** focuses on the technical reliability of the codebase (concurrency, ports, builds), the **120% Vision Loop** focus on the outcome. 

-   **Perfect Debug Loop** = The engine is running perfectly.
-   **120% Vision Loop** = The journey is amazing for the passenger.

## 5. Implementation Standard

When the USER requests "120% completion," it is a signal to stop compromising. Any `TODO` comment, any `any` type, any placeholder text, and any unresponsive UI element must be eliminated.
