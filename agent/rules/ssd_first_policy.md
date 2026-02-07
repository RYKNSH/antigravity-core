---
description: Enforces the SSD-First policy for skills and workflows to ensure portability and global availability.
---

# SSD-First Development Policy

## Principle
All reusable knowledge, skills, architecture patterns, and workflows MUST be stored on the Portable SSD to ensure they are available across all projects and machines.

## Storage Locations

- **Global Skills**: `/Volumes/PortableSSD/.antigravity/agent/skills/`
- **Global Workflows**: `/Volumes/PortableSSD/.antigravity/agent/workflows/`
- **Global Scripts**: `/Volumes/PortableSSD/.antigravity/agent/scripts/`
- **Knowledge Base**: `/Volumes/PortableSSD/.antigravity/knowledge/`

## Rules

1.  **Origin on SSD**: When creating a new skill or workflow that could be useful in more than one project, create it directly on the SSD or immediately migrate it there.
2.  **Absolute Reference**: Workflows should reference scripts and skills using their absolute SSD paths to ensure they work regardless of the project directory.
3.  **Sync**: Local `.agent` directories in projects are for cache or temporary overrides only. The SSD is the source of truth.
