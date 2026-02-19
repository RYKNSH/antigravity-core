---
description: The "Strict Think" Workflow - Enforcing Read-First and Structured Planning.
---

# /think (Strict Mode)

## 🎯 Goal
To generate a **Harness Plan** that minimizes ambiguity and maximizes "Agent Legibility".
This mode enforces a "Read-First" policy and requires a specific JSON output format.

## 🛑 The Golden Principles (Strict Enforcement)
1.  **Read First**: You MUST read the `Required Context` file defined in `PROJECT_STATE.md` *before* proposing a plan.
2.  **No Code**: You MUST NOT write implementation code in this phase. Only plan.
3.  **Structured Output**: You MUST end your response with a `Harness Plan` JSON block.

## Workflow Steps:

1.  **Core Initialization**:
    *   Check if `PROJECT_STATE.md` exists. If not, run `node ~/.antigravity/agent/scripts/setup.js`.
    *   **READ** `PROJECT_STATE.md` to find `Required Context`.
    *   **READ** the `Required Context` file (e.g., specific workflow logic or failure logs).

2.  **Project State Registration**:
    *   Use `node ~/.antigravity/agent/scripts/project_state.js add "Task Name" "branch-name" "Think"` to register the new task.

3.  **Deep Research & Setup**:
    *   Research necessary libraries/docs.
    *   Propose tool installations (e.g., `brew install xyz`).

4.  **Harness Planning**:
    *   Break down the task into atomic steps suited for `/go`.
    *   Identify "Quality Gates" (What defines success?).

5.  **Output**:
    *   Generate the `Harness Plan` block.

## 📤 Harness Plan Format
```json
{
  "taskName": "...",
  "goal": "...",
  "requiredTooling": ["brew install ..."],
  "steps": [
    { "id": 1, "action": "Create file X", "validation": "File exists" },
    { "id": 2, "action": "Implement logic Y", "validation": "Test Z passes" }
  ],
  "qualityGates": [
    "UX Check: Mobile Responsive",
    "Perf Check: < 100ms"
  ]
}
```
