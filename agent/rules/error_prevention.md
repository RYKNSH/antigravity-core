# Error Prevention: Artifact & Dynamic File Access

> **Purpose**: Prevent "File Not Found" errors when accessing dynamically generated artifacts or user-created files.

## Rule: VERIFY Before READ

When intending to read a file that was:
1.  Just created in this session (e.g., outputs of a script)
2.  Newly synchronized or downloaded
3.  An artifact with a generated ID

**You MUST verify its existence first.**

### Recommended Patterns

#### 1. Use `find` or `ls`
Check if the file exists at the expected path.

```bash
ls -l /path/to/expected/file.md
# OR
find /path/to/search -name "filename.md"
```

#### 2. Handle Missing Files Gracefully
If the file is not found:
- Do NOT hallucinate the content.
- Do NOT proceed with `view_file`.
- Report the missing file as a potential issue or retry generation.

### Why?
Blindly calling `view_file` on a non-existent path consumes a tool call, triggers an error message that confuses the context window, and breaks the flow of execution.
