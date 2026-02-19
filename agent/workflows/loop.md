---
description: The Antigravity Autonomy Engine Protocol (Recursive Self-Healing)
---

# /loop

## ♾️ The Antigravity Loop

**Concept**: A recursive, stateful, and reversible development loop enforced by `loop_engine.js`.
**Goal**: To autonomously iterate on a task until it passes the `120% UX Quality Gate`.

## 📜 The Protocol

### 1. Initialization (The Clean Slate)
*   **User Action**: `/loop <max_retries> <max_cost>`
*   **System Action**:
    1.  Check for "Dirty State" (Uncommitted changes). **ABORT** if dirty.
    2.  Check for existing Lock. **ABORT** if locked.
    3.  `node agent/scripts/loop_engine.js init <max_retries> <max_cost>`
    4.  Tag: `loop-start-{id}`

### 2. The Recursive Cycle
**While (Attempt <= MaxRetries):**

#### Step A: Plan & Execute (Go)
1.  **Checkpoint**: `node agent/scripts/loop_engine.js checkpoint` (Tag: `attempt-{id}-{n}`)
2.  **Think**: Agent reads `Required Context` (including previous failure logs).
3.  **Go**: Agent implements changes.
    *   *Constraint*: No `npm install` without calling `ask_user`.
    *   *Constraint*: No editing `tests/` or `.antigravity/` (Honour System).

#### Step B: Verify (The Gate)
1.  **Verify**: Agent runs `node agent/scripts/loop_engine.js verify`.
    *   This runs `verify_pipeline.js` and checks `verify_result.json`.
    *   **IF SUCCESS**:
        *   `node agent/scripts/loop_engine.js success` (Cleanup tags).
        *   **EXIT LOOP**.
    *   **IF FAILURE**:
        *   **Analyze**: Agent reads `verify_result.json` and logs.
        *   **Rollback**: `node agent/scripts/loop_engine.js rollback` (Revert to Clean Slate).
        *   **Escalate**: `node agent/scripts/loop_engine.js next` (Increment attempt, check limits).
        *   **CONTINUE LOOP** (with failure knowledge).

### 3. Graduation (The Handoff)
*   **On Success**: The code is clean, verified, and tagged.
*   **On Failure**: The system reverts to `loop-start`. No "half-baked" code remains.

## 🤖 Agent Instructions
When executing `/loop`, you MUST strictly follow the `loop_engine.js` commands.
Do not deviate. Do not "fix it manually" without a rollback.
**Trust the Harness.**
