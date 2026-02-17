#!/bin/bash
# git_guard.sh — Git セーフティガード
#
# 全git操作前にCWDが意図したプロジェクトのルートか検証する。
# cross-project commit ミスを物理的に防止。
#
# Usage:
#   git_guard.sh <project_id> <git_command...>
#   git_guard.sh videdit add -A
#   git_guard.sh videdit commit -m "fix: login bug"
#   git_guard.sh videdit push
#
#   git_guard.sh --check            # CWDのプロジェクトを表示するだけ
#   git_guard.sh --check <project>  # CWDが指定プロジェクトと一致するか検証

set -euo pipefail

PROJECTS_JSON="${ANTIGRAVITY_DIR:-$HOME/.antigravity}/projects.json"

# ── Helper ──────────────────────────────────────
resolve_project_path() {
  local project_id="$1"
  node -e "
    const p = require('$PROJECTS_JSON');
    const proj = p.projects['$project_id'];
    if (!proj) { process.stderr.write('Unknown project: $project_id\n'); process.exit(1); }
    console.log(proj.path);
  "
}

get_git_toplevel() {
  git rev-parse --show-toplevel 2>/dev/null || echo ""
}

# ── --check mode ──────────────────────────────
if [ "${1:-}" = "--check" ]; then
  TOPLEVEL=$(get_git_toplevel)
  if [ -z "$TOPLEVEL" ]; then
    echo "⚠️ CWD is not inside a git repository"
    exit 1
  fi
  
  # プロジェクトIDを逆引き
  MATCH=$(node -e "
    const p = require('$PROJECTS_JSON');
    const toplevel = '$TOPLEVEL';
    const match = Object.entries(p.projects).find(([k,v]) => v.path === toplevel);
    if (match) console.log(match[0] + ' (' + match[1].name + ')');
    else console.log('UNKNOWN (not in registry)');
  ")
  
  if [ -n "${2:-}" ]; then
    EXPECTED_PATH=$(resolve_project_path "$2")
    if [ "$TOPLEVEL" = "$EXPECTED_PATH" ]; then
      echo "✅ GIT GUARD: CWD matches project '$2'"
      exit 0
    else
      echo "❌ GIT GUARD: CWD ($TOPLEVEL) ≠ expected ($EXPECTED_PATH)"
      exit 1
    fi
  else
    echo "📍 CWD project: $MATCH"
    echo "   Path: $TOPLEVEL"
    exit 0
  fi
fi

# ── Main guard mode ──────────────────────────────
if [ $# -lt 2 ]; then
  echo "Usage: git_guard.sh <project_id> <git_command...>"
  echo "       git_guard.sh --check [project_id]"
  echo ""
  echo "Examples:"
  echo "  git_guard.sh videdit add -A"
  echo "  git_guard.sh videdit commit -m 'fix: bug'"
  echo "  git_guard.sh --check"
  exit 1
fi

PROJECT_ID="$1"
shift

EXPECTED_PATH=$(resolve_project_path "$PROJECT_ID")
TOPLEVEL=$(get_git_toplevel)

if [ -z "$TOPLEVEL" ]; then
  echo "❌ GIT GUARD: CWD is not inside a git repository"
  echo "   Expected: $EXPECTED_PATH"
  echo "   Aborting: git $*"
  exit 1
fi

if [ "$TOPLEVEL" != "$EXPECTED_PATH" ]; then
  echo "❌ GIT GUARD: WRONG PROJECT!"
  echo "   CWD repo:  $TOPLEVEL"
  echo "   Expected:  $EXPECTED_PATH"
  echo "   Aborting:  git $*"
  echo ""
  echo "   Fix: cd $EXPECTED_PATH && git $*"
  exit 1
fi

echo "✅ GIT GUARD: $PROJECT_ID confirmed → git $*"
git "$@"
