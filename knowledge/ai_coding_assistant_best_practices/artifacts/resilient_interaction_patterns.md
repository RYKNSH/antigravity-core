# Resilient Interaction Patterns (Browser & Native)

AI agents must interact with environments where visual feedback is limited. These patterns ensure reliability during automated execution.

## 1. Browser Automation (IDE Injection)
For web-based editors (Google Apps Script, Online IDEs):
- **Monaco API Injection**: Prefer `monaco.editor.getModels()[0].setValue(code)` over keyboard simulation to avoid syntax corruption from auto-completion and lag.
- **URI Encoding**: Use URI encoding for code payload during `execute_browser_javascript` to prevent string interpolation errors.
- **Save-and-Verify Loop**: Programmatically check for "Saving..." status completion and capture log screenshots for hard verification.

## 2. Native Bridge Resilience (Tauri/React)
- **Explicit State Management**: Every asynchronous bridge call (`invoke`) MUST manage `isLoading` and `error` states.
- **Visible Error Banners**: Display errors in the UI, not just `console.log`. This allows the agent (via screenshots) and users to diagnose failures.
- **Debug Logs in UI**: Include a toggleable "Mini Log Viewer" in the dashboard for real-time observability.
- **State Priority**: Manual user inputs (e.g., path selection) must override auto-detection logic to break "Deadlock Loops."

## 3. Automated Execution Chains
- **Zero-Touch Transitions**: Design around "State Transitions" rather than clicking individual buttons.
- **Priming the Environment**: Sequential execution of (Symlink -> Metadata Sync -> App Launch) to ensure the workspace is ready before user interaction.
- **Graceful Fallbacks**: If a specific detection fails, provide a "Relaxed Detection" mode that allows manual selection.
