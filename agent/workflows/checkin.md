---
description: 環境を最新化して軽量状態で開始
---
# /checkin v4 — SLA-Guaranteed

// turbo-all

```bash
ANTIGRAVITY_DIR="${ANTIGRAVITY_DIR:-$HOME/.antigravity}"

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
    git pull origin main --quiet 2>/dev/null ) &
  disown $!
fi

# セッションブランチ作成（git操作 → 非同期）
if [ -d ".git" ]; then
  CURRENT=$(git branch --show-current 2>/dev/null)
  if [ "$CURRENT" = "main" ] || [ "$CURRENT" = "master" ]; then
    SESSION_BRANCH="session/$(basename "$(pwd)")-$(date +%m%d%H%M)"
    ( git checkout -b "$SESSION_BRANCH" 2>/dev/null \
      && echo "🌿 Branch: $SESSION_BRANCH" ) &
    disown $!
  else
    echo "🌿 Branch: $CURRENT"
  fi
  # 7日以上前のsession/*ブランチを非同期で削除
  (
    git branch --list 'session/*' | while read b; do
      b=$(echo "$b" | xargs)
      LAST=$(git log -1 --format=%ct "$b" 2>/dev/null || echo 0)
      [ $(( $(date +%s) - LAST )) -gt 604800 ] \
        && git branch -D "$b" 2>/dev/null \
        && echo "🗑️ Pruned: $b"
    done
  ) &
  disown $!
fi

# usage tracker（シェルスクリプト実行 → 非同期）
[ -x "$ANTIGRAVITY_DIR/agent/scripts/update_usage_tracker.sh" ] && {
  ( "$ANTIGRAVITY_DIR/agent/scripts/update_usage_tracker.sh" /checkin \
    >/dev/null 2>&1 ) &
  disown $!
}

# ══════════════════════════════════════════════════════
# FAST ZONE — ローカルI/Oのみ: waitして完了を保証
# 全ジョブ合計 < 2秒 を保証
# ══════════════════════════════════════════════════════

# キャッシュ削除
rm -rf \
  ~/.gemini/antigravity/browser_recordings/* \
  ~/.gemini/antigravity/implicit/* \
  ~/.npm/_npx ~/.npm/_logs ~/.npm/_prebuilds ~/.npm/_cacache \
  2>/dev/null &

# 1日以上前の会話キャッシュを削除
find ~/.gemini/antigravity/conversations \
  -mindepth 1 -maxdepth 1 -mtime +1 -exec rm -rf {} + 2>/dev/null &

# ワークスペース同期（ローカルrsync）
mkdir -p .agent/skills .agent/workflows
rsync -a --update --quiet \
  "$ANTIGRAVITY_DIR/agent/workflows/"*.md .agent/workflows/ 2>/dev/null &
rsync -a --update --quiet \
  "$ANTIGRAVITY_DIR/agent/skills/" .agent/skills/ 2>/dev/null &

# 設定ファイルコピー
cp "$ANTIGRAVITY_DIR/mcp_config.json" \
  ~/.gemini/antigravity/mcp_config.json 2>/dev/null &
[ -f "$ANTIGRAVITY_DIR/agent/rules/GEMINI.md.master" ] && \
  cp "$ANTIGRAVITY_DIR/agent/rules/GEMINI.md.master" \
    "$HOME/.gemini/GEMINI.md" 2>/dev/null &

# Git Hooks セットアップ（gitconfig書き込みのみ → 高速）
if [ -d ".git" ]; then
  CURRENT_HOOKS=$(git config --get core.hooksPath 2>/dev/null || echo "")
  if [ -z "$CURRENT_HOOKS" ] && [ -d "$ANTIGRAVITY_DIR/.git-hooks" ]; then
    git config core.hooksPath "$ANTIGRAVITY_DIR/.git-hooks"
    chmod +x "$ANTIGRAVITY_DIR/.git-hooks/"* 2>/dev/null
    echo "🪝 Git hooks activated"
  fi
fi

# FAST ZONE の全ジョブを待つ
# （disownされたSLOW ZONEジョブはwait対象外）
wait

# コンテキスト復元（ディスクのみ参照、git操作なし → 高速）
# ZERO ZONE で stale lock を除去済みのため、ハングしない
node "$ANTIGRAVITY_DIR/agent/scripts/git_context.js" restore 2>/dev/null &
disown $!

# ══════════════════════════════════════════════════════
# 結果表示
# ══════════════════════════════════════════════════════
echo "✅ Check-in complete!" && df -h . | tail -1

# ══════════════════════════════════════════════════════
# NEXT_SESSION 警告読み込み（MR-09: 記録→能動的引き渡し）
# 前セッションの知見を AIが必ず読んで先に報告する
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
# Layer 1: メタルール要約読み込み（MR-09 + Layer 1実装）
# DECISION_USECASES.md からMR見出し一覧のみを抽出（〜1KB）
# セッション開始時のコンテキストに注入することで判断精度を上げる
# ══════════════════════════════════════════════════════
MR_FILE="$ANTIGRAVITY_DIR/DECISION_USECASES.md"
[ -f "$MR_FILE" ] && {
  echo ""
  echo "🧠 Meta Rules (Active):"
  grep "^### MR-" "$MR_FILE" | sed 's/^### /  /' 2>/dev/null
  echo "  ⚠️  Layer 0 Tripwires: 「〜しますか？」「AまたはB？」→ MR-03確認 / 数値を根拠にする → MR-01確認"
}

# 注意点・警告だけを抽出して冒頭でフラグを立てる
# （ゾンビプロセスやI/Oブロック等の警告を見落とさないため）
WARNINGS=""
for f in "./NEXT_SESSION.md" "$ANTIGRAVITY_DIR/NEXT_SESSION.md"; do
  [ -f "$f" ] && {
    W=$(grep -E "(⚠️|警告|注意|ゾンビ|ハング|ブロック|I/Oブロック|残って)" "$f" 2>/dev/null || true)
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
# brain_log 全件スキャン → 未解決タスク → incidents.md 自動転記
# P-04(Long-Running Memory Loss) 対策
# ══════════════════════════════════════════════════════
if [ -d "$ANTIGRAVITY_DIR/brain_log" ]; then
  UNRESOLVED_COUNT=0
  while IFS= read -r log_file; do
    while IFS= read -r task_line; do
      TASK_SUMMARY=$(echo "$task_line" | sed 's/^- \[ \] //' | head -c 80)
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
    done < <(grep -E '^- \[ \]' "$log_file" 2>/dev/null || true)
  done < <(find "$ANTIGRAVITY_DIR/brain_log" -name 'session_*.md' -type f 2>/dev/null)

  [ "$UNRESOLVED_COUNT" -gt 0 ] && \
    echo "📋 brain_log から未解決タスク ${UNRESOLVED_COUNT}件 を incidents.md に転記しました"
fi

# インシデント確認
[ -f "$ANTIGRAVITY_DIR/incidents.md" ] && {
  OPEN_COUNT=$(grep -c "\[OPEN\]" "$ANTIGRAVITY_DIR/incidents.md" 2>/dev/null || echo 0)
  echo "⚠️  Open incidents: $OPEN_COUNT"
  [ "$OPEN_COUNT" -gt 0 ] && grep "\[OPEN\]" "$ANTIGRAVITY_DIR/incidents.md"
}

# ══════════════════════════════════════════════════════
# Workspace grounding scan（2Core + 環境ラベリング確認）
# P-05(God Mode) 対策: 4種のディレクトリと役割を毎回確認
# ══════════════════════════════════════════════════════
echo "🗺️  Workspace (4-Environment Check):"
echo "  Core-A [git managed] : $ANTIGRAVITY_DIR"
echo "  Core-B [AI brain, non-git]: $HOME/.gemini/antigravity"
echo "  Projects [dev]: $HOME/Desktop/AntigravityWork"
echo "  Private [secrets, non-git]: $HOME/.antigravity-private"
echo ""

# 各gitリポジトリのremote確認（Grounding原則）
# タイムアウト5秒・maxdepth 2に制限してハング防止
(
  find "$HOME/Desktop/AntigravityWork" "$HOME/.antigravity" \
    -maxdepth 2 -name ".git" -type d 2>/dev/null | head -20 | while read gitdir; do
    repo=$(dirname "$gitdir")
    remote=$(timeout 3 git -C "$repo" remote get-url origin 2>/dev/null || echo "⚠️ NO_REMOTE")
    echo "  📁 $(basename "$repo") → $remote"
  done
) &
disown $!

# ENVIRONMENTS.md 存在確認（なければ警告）
[ ! -f "$ANTIGRAVITY_DIR/ENVIRONMENTS.md" ] && \
  echo "⚠️  ENVIRONMENTS.md が未作成です。環境ラベリングが未定義です。"
```
