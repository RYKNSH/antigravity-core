# Antigravity Automation & Quality Utilities

Global automation scripts used to maintain high hygiene and 120% quality across all portable projects.

## 1. Environment Synchronization & Discovery

### 1.1 `list_resources.sh`
Dynamically discovers all global resources stored on the Portable SSD and synchronizes the project's interface.

- **Primary Logic**:
    - Scans `.antigravity/agent/workflows/` and `skills/`.
    - Counts active Knowledge Items and custom Scripts.
    - **GEMINI.md Integration**: With the `--update-gemini` flag, it automatically rewrites the "MAP" section of `GEMINI.md`, ensuring the AI assistant is always aware of the latest available tools without manual maintenance.
- **Trigger**: Executed during session `/checkin`.

---

## 2. Usage Tracking & Optimization

### 2.1 `update_usage_tracker.sh`
Maintains a project-wide ledger of workflow utilization (`USAGE_TRACKER.md`).

- **Metrics Tracked**:
    - **Usage Count**: How many times a specific command (e.g., `/fbl`, `/debate`) has been run.
    - **Last Used Date**: Identifies stale or deprecated workflows.
- **Value**: Enables "Workflow Darwinism"—identifying high-value paths and flagging underused or high-friction tools for refactoring.
- **Trigger**: Integrated into the start/end phases of major workflows.

---

## 3. Headless Quality Assurance

### 3.1 `validate_pr.sh`
A mission-critical quality gate script designed for headless execution or pre-commit checks.

- **Verification Stack**:
    - **Linting**: Enforces strict `code-standards.md`.
    - **Type Integrity**: Runs `tsc` or equivalent for static analysis.
    - **Testing**: Executes `vitest` or `pytest` to confirm backward compatibility.
    - **Security Audit**: Basic secrets scanning and dependency vulnerability checks.
- **Logic**: Returns a non-zero exit code on any failure, blocking the "Commit" phase in the `/new-feature` or `/bug-fix` workflows.
- **Policy**: No code is "Done" until `validate_pr.sh` passes 100%.

---

## 4. Integration Protocol

These utilities are strictly decoupled from the codebase and reside in `.antigravity/agent/scripts/` to ensure they can be used across any project (React, Python, Tauri) within the ecosystem.
