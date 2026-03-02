---
description: 環境を最新化して軽量状態で開始
---
# /checkin v5 — Anti-Hang Edition

// turbo-all

```bash
ANTIGRAVITY_DIR="${ANTIGRAVITY_DIR:-$HOME/.antigravity}"

# ══════════════════════════════════════════════════════
# GLOBAL WATCHDOG — checkin 全体を60秒で強制完了させる
# どんなI/Oハングが起きても必ず戻ってくる
# ══════════════════════════════════════════════════════
CHECKIN_TIMEOUT=60
CHECKIN_PID=$$
(
  sleep "$CHECKIN_TIMEOUT"
  if kill -0 "$CHECKIN_PID" 2>/dev/null; then
    echo "⚠️ checkin watchdog: ${CHECKIN_TIMEOUT}s timeout — forcing completion"
    kill -TERM "$CHECKIN_PID" 2>/dev/null
    sleep 2
    kill -9 "$CHECKIN_PID" 2>/dev/null || true
  fi
) &
WATCHDOG_PID=$!
# watchdog をスクリプト終了時に確実に kill
trap 'kill $WATCHDOG_PID 2>/dev/null; exit' EXIT TERM INT

# ══════════════════════════════════════════════════════
# ZERO ZONE — git 操作より前に必ず実行（ハング根本対策）
# 前セッションの強制終了で残った stale lock を除去する
# index.lock が残っていると全 git 操作が永続ハングする（safe-commands.md 根本原因3）
# ══════════════════════════════════════════════════════
rm -f "$ANTIGRAVITY_DIR/.git/index.lock" 2>/dev/null
rm -f "$ANTIGRAVITY_DIR/.git/MERGE_HEAD" 2>/dev/null   # 中断マージも除去
[ -d ".git" ] && rm -f ".git/index.lock" 2>/dev/null   # カレントプロジェクトも

# ══════════════════════════════════════════════════════
# SLOW ZONE — ネットワーク/重いgit操作
# disown で完全切り離し → waitしない → ブロックしない
# ══════════════════════════════════════════════════════

# ~/.antigravity の最新化（ネットワーク依存 → 完全非同期）
if [ -d "$ANTIGRAVITY_DIR/.git" ]; then
  ( cd "$ANTIGRAVITY_DIR" && GIT_TERMINAL_PROMPT=0 \
    timeout 15 git pull origin main --quiet 2>/dev/null || true ) &
  disown $!
fi

# セッションブランチ作成前に自律修復（Bulletproof State Sync Protocol）
if [ -d ".git" ]; then
  CURRENT=$(timeout 3 git branch --show-current 2>/dev/null || echo "unknown")
  
  # main/masterにいる場合のみSync Protocolを発動
  if [ "$CURRENT" = "main" ] || [ "$CURRENT" = "master" ]; then
    echo "🔄 State Sync Check for $CURRENT..."
    GIT_TERMINAL_PROMPT=0 timeout 10 git fetch --all 2>/dev/null || true
    BEHIND=$(timeout 3 git rev-list HEAD..origin/"$CURRENT" --count 2>/dev/null || echo 0)
    
    if [ -n "$BEHIND" ] && [ "$BEHIND" -gt 0 ] 2>/dev/null; then
      echo "⚠️ Local is behind origin/$CURRENT by $BEHIND commits. Initiating Self-Healing Sync..."
      
      # 1. 未コミット変更の安全退避 (Data Loss Prevention)
      STASH_OUT=$(timeout 5 git stash push -m "Auto-fallback-recovery" 2>&1)
      HAS_STASH=false
      if echo "$STASH_OUT" | grep -q 'Saved working directory'; then
        HAS_STASH=true
        echo "🛡️ Uncommitted changes stashed safely."
      fi

      # 2. 履歴の直列化 (Rebase)
      if GIT_TERMINAL_PROMPT=0 timeout 15 git rebase origin/"$CURRENT" 2>/dev/null; then
        echo "✅ Successfully synced with origin/$CURRENT."
        # 3. 退避した作業の復元
        if [ "$HAS_STASH" = true ]; then
          if timeout 5 git stash pop 2>/dev/null; then
             echo "📦 Restored uncommitted changes."
          else
             echo "🚨 CONFLICT during stash pop. Please resolve manually: git stash pop"
          fi
        fi
      else
        # 4. コンフリクト時の安全停止 (Code Destruction Prevention)
        echo "🚨 CONFLICT during rebase. Aborting sync to protect local code."
        git rebase --abort 2>/dev/null || true
        echo "⚠️ Please resolve the divergence manually before proceeding."
      fi
    else
      echo "✅ Local is up to date."
    fi

    # 同期・修復後にセッションブランチを作成（非同期）
    SESSION_BRANCH="session/$(basename "$(pwd)")-$(date +%m%d%H%M)"
    ( timeout 5 git checkout -b "$SESSION_BRANCH" 2>/dev/null \
      && echo "🌿 Branch: $SESSION_BRANCH" ) &
    disown $!
  else
    echo "🌿 Branch: $CURRENT"
  fi

  # 7日以上前のsession/*ブランチを非同期で削除（タイムアウト付き）
  (
    timeout 10 git branch --list 'session/*' 2>/dev/null | head -20 | while read b; do
      b=$(echo "$b" | xargs)
      LAST=$(timeout 3 git log -1 --format=%ct "$b" 2>/dev/null || echo 0)
      [ $(( $(date +%s) - ${LAST:-0} )) -gt 604800 ] \
        && timeout 3 git branch -D "$b" 2>/dev/null \
        && echo "🗑️ Pruned: $b"
    done
  ) &
  disown $!
fi

# usage tracker（シェルスクリプト実行 → 非同期・タイムアウト付き）
[ -x "$ANTIGRAVITY_DIR/agent/scripts/update_usage_tracker.sh" ] && {
  ( timeout 10 "$ANTIGRAVITY_DIR/agent/scripts/update_usage_tracker.sh" /checkin \
    >/dev/null 2>&1 ) &
  disown $!
}

# ══════════════════════════════════════════════════════
# SECRET ZONE — 1Password CLIで.envを自動生成
# shared (.env.shared.tpl) + project (.env.tpl) の2層マージ
# ══════════════════════════════════════════════════════
if [ ! -f ".env" ]; then
  SHARED_TPL="$ANTIGRAVITY_DIR/.env.shared.tpl"
  PROJECT_TPL=".env.tpl"

  if command -v op &>/dev/null && op account list &>/dev/null 2>&1; then
    echo "🔑 .env not found — generating from 1Password..."
    _ok=true

    # 1. Shared secrets
    if [ -f "$SHARED_TPL" ]; then
      op inject -i "$SHARED_TPL" -o .env 2>/dev/null || { echo "⚠️ shared inject failed"; _ok=false; }
    fi

    # 2. Project-specific (append)
    if [ -f "$PROJECT_TPL" ] && [ "$_ok" = true ]; then
      op inject -i "$PROJECT_TPL" >> .env 2>/dev/null || echo "⚠️ project inject failed"
    fi

    [ "$_ok" = true ] && echo "✅ .env generated ($(grep -cE '^[A-Z_]+=' .env) vars)"
  else
    echo "⚠️ .env not found. Run: bash scripts/setup-secrets.sh"
  fi
fi

# ══════════════════════════════════════════════════════
# FAST ZONE — ローカルI/Oのみ
# ★ 全操作に timeout 付き → I/Oハングで wait が永久ブロックしない
# 全ジョブ合計 < 5秒 を保証
# ══════════════════════════════════════════════════════

# キャッシュ削除（timeout 5秒）
( timeout 5 rm -rf \
  ~/.gemini/antigravity/browser_recordings/* \
  ~/.gemini/antigravity/implicit/* \
  ~/.npm/_npx ~/.npm/_logs ~/.npm/_prebuilds ~/.npm/_cacache \
  2>/dev/null ) &

# 1日以上前の会話キャッシュを削除（timeout 5秒）
( timeout 5 find ~/.gemini/antigravity/conversations \
  -mindepth 1 -maxdepth 1 -mtime +1 -exec rm -rf {} + 2>/dev/null ) &

# ワークスペース同期（★ ここがハングの最大原因だった）
# rsync を disown で完全切り離し → wait 対象外にする
mkdir -p .agent/skills .agent/workflows 2>/dev/null
( timeout 10 rsync -a --update --quiet \
  "$ANTIGRAVITY_DIR/agent/workflows/"*.md .agent/workflows/ 2>/dev/null ) &
disown $!
( timeout 10 rsync -a --update --quiet \
  "$ANTIGRAVITY_DIR/agent/skills/" .agent/skills/ 2>/dev/null ) &
disown $!

# 設定ファイルコピー（timeout 3秒ずつ）
( timeout 3 cp "$ANTIGRAVITY_DIR/mcp_config.json" \
  ~/.gemini/antigravity/mcp_config.json 2>/dev/null ) &
[ -f "$ANTIGRAVITY_DIR/agent/rules/GEMINI.md.master" ] && \
  ( timeout 3 cp "$ANTIGRAVITY_DIR/agent/rules/GEMINI.md.master" \
    "$HOME/.gemini/GEMINI.md" 2>/dev/null ) &

# Git Hooks セットアップ（gitconfig書き込みのみ → 高速）
if [ -d ".git" ]; then
  CURRENT_HOOKS=$(git config --get core.hooksPath 2>/dev/null || echo "")
  if [ -z "$CURRENT_HOOKS" ] && [ -d "$ANTIGRAVITY_DIR/.git-hooks" ]; then
    git config core.hooksPath "$ANTIGRAVITY_DIR/.git-hooks"
    chmod +x "$ANTIGRAVITY_DIR/.git-hooks/"* 2>/dev/null
    echo "🪝 Git hooks activated"
  fi
fi

# FAST ZONE の timeout付きジョブのみ待つ（disown されたジョブは待たない）
wait

# コンテキスト復元（disown + timeout → ハングしない）
( timeout 10 node "$ANTIGRAVITY_DIR/agent/scripts/git_context.js" restore 2>/dev/null ) &
disown $!

# ══════════════════════════════════════════════════════
# Discord Session Hook（プロジェクト内にhookがあれば自動実行）
# ══════════════════════════════════════════════════════
DISCORD_HOOK="./src/discord/session-hook.js"
if [ -f "$DISCORD_HOOK" ]; then
  PROJECT_NAME=$(basename "$(pwd)" | tr '[:lower:]' '[:upper:]' | tr '-' ' ')
  SESSION_LABEL="dev-$(date +%m%d)"
  ( timeout 10 node "$DISCORD_HOOK" checkin "$PROJECT_NAME" "$SESSION_LABEL" 2>/dev/null ) &
  disown $!
  echo "🔗 Discord session hook triggered"
fi

# ══════════════════════════════════════════════════════
# 結果表示
# ══════════════════════════════════════════════════════
echo "✅ Check-in complete!" && df -h . | tail -1

# ══════════════════════════════════════════════════════
# NEXT_SESSION 警告読み込み（MR-09: 記録→能動的引き渡し）
# ══════════════════════════════════════════════════════

# プロジェクト側 NEXT_SESSION.md
[ -f "./NEXT_SESSION.md" ] && {
  echo "📋 NEXT_SESSION (project):"
  cat "./NEXT_SESSION.md"
}

# Core側 NEXT_SESSION.md（~/.antigravity）
[ -f "$ANTIGRAVITY_DIR/NEXT_SESSION.md" ] && {
  echo ""
  echo "📋 NEXT_SESSION (core — ~/.antigravity):"
  cat "$ANTIGRAVITY_DIR/NEXT_SESSION.md"
}

# ══════════════════════════════════════════════════════
# NEXT_SESSION 読み込み後の行動原則（構造的遷移）
# ══════════════════════════════════════════════════════
echo ""
echo "⚡ 次のアクション（構造的遷移）"
echo "> 構造を理解し、理念＞ビジョン＞ミッションに合致しているか照合しろ。合致していたら即着手。"
echo "> （❌「何から始めますか？」などとユーザーに聞かないこと）"

# ══════════════════════════════════════════════════════
# Layer 1: メタルール要約読み込み
# ══════════════════════════════════════════════════════
MR_FILE="$ANTIGRAVITY_DIR/DECISION_USECASES.md"
[ -f "$MR_FILE" ] && {
  echo ""
  echo "🧠 Meta Rules (Active):"
  grep "^### MR-" "$MR_FILE" | sed 's/^### /  /' 2>/dev/null
  echo "  ⚠️  Layer 0 Tripwires: 「〜しますか？」「AまたはB？」→ MR-03確認 / 数値を根拠にする → MR-01確認"
}

# 注意点・警告だけを抽出（タイムアウト付き grep — ハング対策）
WARNINGS=""
for f in "./NEXT_SESSION.md" "$ANTIGRAVITY_DIR/NEXT_SESSION.md"; do
  [ -f "$f" ] && {
    W=$(timeout 3 grep -E "(⚠️|警告|注意|ゾンビ|ハング|ブロック|I/Oブロック|残って)" "$f" 2>/dev/null || true)
    [ -n "$W" ] && WARNINGS="$WARNINGS\n$W"
  }
done

[ -n "$WARNINGS" ] && {
  echo ""
  echo "🚨 ════════════════════════════════════════"
  echo "🚨 前セッションからの警告（要確認）:"
  echo -e "$WARNINGS"
  echo "🚨 ════════════════════════════════════════"
  echo ""
}

[ -f ".sweep_patterns.md" ] && echo "📚 Patterns loaded"

# ══════════════════════════════════════════════════════
# brain_log スキャン → 未解決タスク → incidents.md 自動転記
# ★ ハング対策: head -50 でファイル数上限、timeout 10秒で全体保護
# ══════════════════════════════════════════════════════
if [ -d "$ANTIGRAVITY_DIR/brain_log" ]; then
  (
    timeout 10 bash -c '
      ANTIGRAVITY_DIR="'"$ANTIGRAVITY_DIR"'"
      UNRESOLVED_COUNT=0
      for log_file in $(find "$ANTIGRAVITY_DIR/brain_log" -name "session_*.md" -type f 2>/dev/null | head -50); do
        while IFS= read -r task_line; do
          TASK_SUMMARY=$(echo "$task_line" | sed "s/^- \[ \] //" | head -c 80)
          if ! grep -qF "$TASK_SUMMARY" "$ANTIGRAVITY_DIR/incidents.md" 2>/dev/null; then
            LOG_NAME=$(basename "$log_file")
            {
              echo ""
              echo "## UNRESOLVED-$(date +%m%d%H%M) [OPEN] brain_log未解決タスク"
              echo ""
              echo "**発生元**: $LOG_NAME"
              echo "**内容**: $TASK_SUMMARY"
              echo "**転記日**: $(date +%Y-%m-%d)"
              echo ""
              echo "> 未解決のまま次セッションに持ち越されたタスク。/incident で詳細記録推奨。"
              echo ""
              echo "---"
            } >> "$ANTIGRAVITY_DIR/incidents.md"
            UNRESOLVED_COUNT=$((UNRESOLVED_COUNT + 1))
          fi
        done < <(grep -E "^- \[ \]" "$log_file" 2>/dev/null | head -20)
      done
      [ "$UNRESOLVED_COUNT" -gt 0 ] && \
        echo "📋 brain_log から未解決タスク ${UNRESOLVED_COUNT}件 を incidents.md に転記しました"
    '
  ) || echo "⚠️ brain_log scan timed out (skipped)"
fi

# インシデント確認（timeout 付き）
[ -f "$ANTIGRAVITY_DIR/incidents.md" ] && {
  OPEN_COUNT=$(timeout 3 grep -c "\[OPEN\]" "$ANTIGRAVITY_DIR/incidents.md" 2>/dev/null || echo 0)
  echo "⚠️  Open incidents: $OPEN_COUNT"
  [ "$OPEN_COUNT" -gt 0 ] && timeout 3 grep "\[OPEN\]" "$ANTIGRAVITY_DIR/incidents.md" | head -10
}

# ══════════════════════════════════════════════════════
# Workspace grounding scan
# ══════════════════════════════════════════════════════
echo "🗺️  Workspace (4-Environment Check):"
echo "  Core-A [git managed] : $ANTIGRAVITY_DIR"
echo "  Core-B [AI brain, non-git]: $HOME/.gemini/antigravity"
echo "  Projects [dev]: $HOME/Desktop/AntigravityWork"
echo "  Private [secrets, non-git]: $HOME/.antigravity-private"
echo ""

# 各gitリポジトリのremote確認（タイムアウト厳格化 + head制限）
(
  timeout 10 bash -c '
    find "$HOME/Desktop/AntigravityWork" "$HOME/.antigravity" \
      -maxdepth 2 -name ".git" -type d 2>/dev/null | head -10 | while read gitdir; do
      repo=$(dirname "$gitdir")
      remote=$(timeout 3 git -C "$repo" remote get-url origin 2>/dev/null || echo "⚠️ NO_REMOTE")
      echo "  📁 $(basename "$repo") → $remote"
    done
  '
) || echo "  ⚠️ Workspace scan timed out (skipped)"

# ENVIRONMENTS.md 存在確認（なければ警告）
[ ! -f "$ANTIGRAVITY_DIR/ENVIRONMENTS.md" ] && \
  echo "⚠️  ENVIRONMENTS.md が未作成です。環境ラベリングが未定義です。"

# Watchdog cleanup（正常終了時）
kill $WATCHDOG_PID 2>/dev/null || true
```
