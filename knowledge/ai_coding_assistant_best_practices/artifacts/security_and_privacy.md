# AI-Assisted Security: Handling Sensitive Information

While high-autonomy agents can assist with system-level tasks (like `sudo` operations), the interaction flow presents significant security risks if handled carelessly. This artifact outlines the standards for preventing credential leaks during AI orchestration sessions.

## 1. The Password Leak Problem
In many scenarios, the agent may request a password to execute privileged commands (e.g., `sudo rm -rf`). If the user provides the password directly in the chat interface:
- **Persistence**: The password remains in the chat history indefinitely.
- **Exposure**: The password may be sent to the LLM provider (Anthropic, Google, OpenAI) as part of the conversation context.
- **Vulnerability**: Any future session or person with access to the chat logs can retrieve the password.

## 2. Best Practices for Privileged Operations

### A. Terminal-Direct Input
Always prioritize native terminal input prompts over chat-based input.
- **Standard**: When an agent executes a command that requires a password, the user should enter the password directly into the terminal window associated with the IDE or CLI, where the input is often hidden (masked) and not stored in the chat log.
- **Agent Responsibility**: The agent should explicitly warn the user: *"Please enter your password directly in the terminal; do not send it here in the chat."*

### B. Environment Variable Management
Avoid hardcoding API keys or secrets in implementation plans or task files.
- **Pattern**: Use `.env` files or system keychains.
- **Constraint**: Agents should be configured to never request the user to "paste the API key here." instead, they should ask for the path to the config file or environment variable name.

### C. Post-Session Sanitization
If a leak occurs (as seen in the 2026-01-24 session where a password was shared):
1. **Immediate Invalidation**: The user or agent should acknowledge the leak and recommend changing the password/key immediately.
2. **De-indexing**: If possible, remove or redact that part of the chat history before generating long-term Knowledge Items.

## 3. Implementation Pattern for Agents
When an agent encounters a password prompt (e.g., `Password:` in command output):
1. **Detection**: Recognize the prompt patterns.
2. **Guidance**: Stop execution or wait for the user to interact with the shell directly.
3. **Information**: Inform the user: *"Task blocked by a password prompt. Please type your password in the terminal to continue."*

---
*Reference: 2026-01-24 integration session (Password exposure incident).*
