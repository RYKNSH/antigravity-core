---
description: 実装フェーズ (Go) - 計画に基づき実装を行う (Fuzzy Match & Worktree Support)
---

# /go - Builder Mode

**役割**: 計画されたタスクを実装するモード。Fuzzy Matchにより対象ブランチ/Worktreeを特定して移動する。

```bash
ANTIGRAVITY_DIR="${ANTIGRAVITY_DIR:-$HOME/.antigravity}"
QUERY="${1}"

# 1. Branch Identification
if [ -n "$QUERY" ]; then
    echo "🔍 Searching for task matching: '$QUERY'..."
    RESULT=$(node "$ANTIGRAVITY_DIR/agent/scripts/fuzzymatch.js" "$QUERY")
    
    FOUND=$(echo "$RESULT" | grep -o '"found":true')
    TYPE=$(echo "$RESULT" | grep -o '"type":"[^"]*"' | cut -d'"' -f4)
    
    if [ "$FOUND" ]; then
        if [ "$TYPE" = "single" ]; then
            BRANCH=$(echo "$RESULT" | grep -o '"branch":"[^"]*"' | cut -d'"' -f4)
            WORKTREE_PATH=$(echo "$RESULT" | grep -o '"worktree_path":"[^"]*"' | cut -d'"' -f4)
            TASK=$(echo "$RESULT" | grep -o '"task":"[^"]*"' | cut -d'"' -f4)
            
            echo "✅ Match Found: $TASK ($BRANCH)"
            
            # Update State Phase to Implementation
            node "$ANTIGRAVITY_DIR/agent/scripts/project_state.js" phase "$BRANCH" "Go"
            
            # Worktree Logic
            # Check if we are already in the right place
            # or need to cd to worktree (which agent can't do for user shell easily, but can guide)
            
            echo "🚀 Launching Builder Mode for $TASK"
            # In a real workflow, we might cd here if it's a subshell, but user shell stays.
            # Best practice: Provide command for user OR assume we run tools inside.
            
            # Ensure branch is checked out
            git checkout "$BRANCH" 2>/dev/null || git checkout -b "$BRANCH"
            
        else
            echo "⚠️  Multiple matches found. Please be more specific."
            echo "$RESULT"
            exit 1
        fi
    else
        echo "❌ No active task found for '$QUERY'."
        echo "💡 Suggestion: Start a new task with:"
        echo "   /think \"$QUERY\""
        exit 1
    fi
else
    # No query, assume current branch/context
    echo "⏩ Continuing on current branch..."
fi

# 2. Session Init
node "$ANTIGRAVITY_DIR/agent/scripts/session_state.js" set-workflow "/go" "implementation"

# 3. Execution (Builder Instructions)
echo ""
echo "🤖 BUILDER INSTRUCTIONS:"
echo "1. Read 'implementation_plan.md'"
echo "2. Implement changes."
echo "3. Commit: git commit -m 'impl: ...'"
```
