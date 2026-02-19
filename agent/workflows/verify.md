---
description: 検証フェーズ (Verify) - 統合テストパイプライン (UX 120% Check) を実行する
---

# /verify - Inspector Mode

**役割**: 実装内容を検証し、品質を保証するモード。
特に **FBL Phase 5 (UX Quality Gate)** を厳格に適用し、「動く」だけでなく「素晴らしい」体験であることを保証する。

```bash
ANTIGRAVITY_DIR="${ANTIGRAVITY_DIR:-$HOME/.antigravity}"

# Session State & Phase Update
CURRENT_BRANCH=$(git branch --show-current)
node "$ANTIGRAVITY_DIR/agent/scripts/project_state.js" phase "$CURRENT_BRANCH" "Verify"
node "$ANTIGRAVITY_DIR/agent/scripts/session_state.js" set-workflow "/verify" "verification"

echo "🔍 Inspector Mode Started"
echo "   Branch: $CURRENT_BRANCH"

# Run the High-Fidelity Verification Pipeline
# 2>&1 | tee ... ensures both stdout and stderr are captured and shown
LOG_FILE="$ANTIGRAVITY_DIR/logs/verify_last_run.log"
node "$ANTIGRAVITY_DIR/agent/scripts/verify_pipeline.js" 2>&1 | tee "$LOG_FILE"

```

> [!IMPORTANT]
> **UX Check**: スクリプトが UX に関する質問をします。
> 単なる機能確認ではなく、**「感動するか？」「親切か？」** という基準で厳しくジャッジしてください。
