# Deep FBL Pattern: Event-to-Service Mapping Audit

When a large component is refactored into smaller sub-components (as per **Pattern 147: Atomic Context Decoupling**), the most common failure mode shifts from "State Explosion" to "Connectivity Gaps."

## The "Connectivity Gap" Failure
In a decoupled architecture, logic is often "stranded" within a sub-component because the bridge (callback/prop) to the parent service or state manager was never established or was lost during the split.

### Audit Pattern: The Bridge Verification
For every interactive sub-component, the FBL Deep audit must verify the existence and integrity of the "Action Bridge":

1. **Callback Attachment**: Verify that every `onChange`, `onClick`, or `onAction` prop defined in the sub-component is explicitly bound to a handler in the parent card or hook.
    - *Example (Found Bug)*: `ShortCard` rendered `TelopEditor` but failed to pass `onLinesChange`. The editor was a "functional island" with no way to persist changes.
2. **Payload Completeness**: Verify that the payload sent by the sub-component handler actually reaches the final persistence API.
    - *Example (Found Bug)*: `approve()` was called with only a `templateId`, ignoring the locally edited `timeline` buffer that the user just refined.
3. **Dead API Persistence**: Verify that background APIs (e.g., `apply-telop`) are not just implemented on the backend but are actively being called by the frontend's lifecycle or user events.

## Audit Checklist for Decoupled Components
- [x] **Prop Binding**: Do all event-emitting props have handlers? (e.g., `onLinesChange` bound in `ShortCard`)
- [x] **State Propagation**: Does the local change reach the Root State? (e.g., `updateTimeline` in `useReviewShorts`)
- [ ] **Persistence Trigger**: Is there an anti-flicker or debounce mechanism for high-frequency edits?
- [x] **Sync Reconciliation**: Does an optimistic update get verified by a server-side "Ground Truth" fetch? (Implemented via `fetchData()` after actions)

## UX Benefit
By auditing the "Bridges" rather than just the "Islands," FBL Deep ensures that the structural integrity of the refactoring translates into functional reliability for the end-user.

---

## 🔍 Investigation Pattern: The "Not Displayed" Paradox

**Problem**: A user reports that a feature (e.g., Telops) is "not displayed," but the code and logs show no errors.

**Discovery via Browser-Agent Audit**:
A directed audit revealed that the feature was **technically functional** but **visually obscured** due to:
1.  **Progressive Disclosure**: The section was collapsed by default.
2.  **State-Dependent Visibility**: The section was hidden because the entity was in a terminal status (COMPLETED).

**FBL Metric**: 120% quality requires that "It's not working" reports are investigated at the **UX presentation layer**, not just the network/console layer.

**Lesson**: Refactoring often introduces subtle UX changes (like new collapse/expand states) that users perceive as regressions. Audits must cross-reference "Existence in DOM" with "Visibility to User."

---

## Technical Debt: Resource-Induced Monitoring Gaps

**Incident (2026-02-06)**: During a heavy build/render session, the Browser Subagent repeatedly failed with `browser connection is reset` and `action timed out`.

**The Paradox**: The very tools used to verify "High Fidelity" (browser-driven UI testing) are the first to fail when the system is under heavy load (e.g., `pnpm dev` compiling + FFmpeg background rendering).

**Mitigation Protocol**:
1. **Pre-Verify System Load**: Check `top` or `ps aux` before starting long browser verification sessions.
2. **Deterministic Wait States**: If the environment is unstable, use explicit backend-state checks (e.g., reading project JSON or logs) as a fallback before declaring a UI failure.
3. **Environment Isolation**: Acknowledge that "High Fidelity" testing of rendering pipelines requires a stable "Quiet Period" for the local dev server.
