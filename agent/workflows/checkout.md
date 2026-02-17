---
description: セッション終了時にデータを整理し、自己評価・改善提案を行いクリーンな状態で終了
---
# Check-out (セッション終了)

作業終了時に実行。クリーンアップ＋**自己評価フィードバックループ**。

## Cross-Reference

```
/go → ... → /checkout（自動呼び出し）
  ├─ Phase 0: Social Knowledge 自動判定 → /checkpoint_to_blog
  ├─ Phase 0.5: Git Save & PR
  ├─ Phase 1-1.5: クリーンアップ
  ├─ Phase 2: 自己評価 + Vision OS 乖離チェック
  ├─ Phase 3: 改善実装
  └─ Phase 4: NEXT_SESSION.md 生成 → SSDログ保存
```

## 実行タイミング

- 1日の作業終了時
- PC再起動/シャットダウン前
- SSD取り外し前

---

## Phase -1: Pre-flight SWAP Check

セッション終了前にSWAP圧迫を検知し、必要に応じてクリーンアップを実行する。

// turbo
```bash
swap_mb=$(sysctl vm.swapusage | awk '{print $7}' | sed 's/M//')
echo "🏥 Pre-flight Check: SWAP ${swap_mb}MB"

if [ $(echo "$swap_mb > 2048" | bc) -eq 1 ]; then
  echo "⚠️ SWAP高負荷検知 (${swap_mb}MB > 2048MB) — mini-lightweight 実行"
  # 安全な操作のみ:
  find ~/.gemini/antigravity/browser_recordings -type f -mmin +120 -delete 2>/dev/null
  rm -rf ~/.npm/_logs 2>/dev/null
  echo "✅ mini-lightweight 完了"
fi
```

---

## Phase -0.5: Context Compression（コンテキスト圧縮）

セッション終了前に、重要情報を抽出・圧縮して永続化する。

// turbo
```bash
echo "🧠 コンテキスト圧縮中..."

# セッション開始時刻を記録（なければ現在時刻の6時間前）
SESSION_START=${SESSION_START:-$(($(date +%s) - 21600))}

# 1. セッションデータ収集
SESSION_DATA=$(SESSION_START=$SESSION_START node $ANTIGRAVITY_DIR/agent/scripts/collect_session_data.js)

# 2. 重要情報抽出
COMPRESSED=$(echo "$SESSION_DATA" | node $ANTIGRAVITY_DIR/agent/scripts/extract_context.js)

# 3. アーカイブディレクトリ作成
mkdir -p .session_archive

# 4. 圧縮データ保存
ARCHIVE_FILE=".session_archive/$(date +%Y%m%d_%H%M%S).json"
echo "$COMPRESSED" > "$ARCHIVE_FILE"

echo "✅ コンテキスト保存完了: $ARCHIVE_FILE"
```

**効果**:
- セッション情報を永続化
- 次回セッションで復元可能
- ブログソースを保持

---

## Phase 0: Social Knowledge (インテリジェント判定)

ユーザーに「記事にしますか？」と聞く前に、**まず自動で「記事にする価値」をスコアリング**する。

### Step 1: 自動スコアリング

// turbo
```bash
# セッションの「記事価値」を数値化
echo "=== Social Knowledge Score ==="
SCORE=0

# 1. git diff 行数(変更量)
# timeout 30s (extended for large repos)
DIFF_LINES=$(perl -e 'alarm 30; exec @ARGV' git diff --stat HEAD~$(git log --oneline --since='6 hours ago' 2>/dev/null | wc -l | tr -d ' ') 2>/dev/null | tail -1 | grep -oE '[0-9]+ insertion|[0-9]+ deletion' | grep -oE '[0-9]+' | paste -sd+ - | bc 2>/dev/null || echo 0)
echo "  変更行数: $DIFF_LINES"
if [ "$DIFF_LINES" -gt 100 ] 2>/dev/null; then SCORE=$((SCORE + 3)); fi
if [ "$DIFF_LINES" -gt 300 ] 2>/dev/null; then SCORE=$((SCORE + 2)); fi

# 2. 新規ファイル数
# timeout 30s (extended for large repos)
NEW_FILES=$(perl -e 'alarm 30; exec @ARGV' git diff --name-status HEAD~$(git log --oneline --since='6 hours ago' 2>/dev/null | wc -l | tr -d ' ') 2>/dev/null | grep '^A' | wc -l | tr -d ' ')
echo "  新規ファイル: $NEW_FILES"
if [ "$NEW_FILES" -gt 3 ] 2>/dev/null; then SCORE=$((SCORE + 3)); fi

# 3. コミット数
# timeout 30s (extended for large repos)
COMMIT_COUNT=$(perl -e 'alarm 30; exec @ARGV' git log --oneline --since='6 hours ago' 2>/dev/null | wc -l | tr -d ' ')
echo "  コミット数: $COMMIT_COUNT"
if [ "$COMMIT_COUNT" -gt 5 ] 2>/dev/null; then SCORE=$((SCORE + 2)); fi

echo ""
echo "  🎯 Social Knowledge Score: $SCORE / 10"
if [ "$SCORE" -ge 5 ]; then
  echo "  ✅ 記事にする価値があります！"
else
  echo "  ℹ️  軽微な変更。Daily Log が適切かも。"
fi
```

### Step 2: 記事化アクション

> [!IMPORTANT]
> **スコア ≥ 5 の場合、記事化をスキップしてはならない。**
> L2/L3モード → 自動で `/checkpoint_to_blog` を実行（スキップ不可）
> L0/L1モード → 「今回の作業を Evergreen Article として Notion に保存しますか？」と確認

- **スコア ≥ 5（記事価値あり）**:
  - L2/L3: `/checkpoint_to_blog` を**自動実行**（ユーザー確認不要）
  - L0/L1: ユーザーに提案し、承認後に実行
- **スコア 1-4**: 「Daily Log として Discord に投稿しますか？」と提案
- **スコア 0**: スキップ

---

## Phase 0.5: Git Save & PR (Confirmed Commit)

1.  **Check for Changes**
    -   Run `git status --porcelain 2>/dev/null`
    -   **⚠️ CRITICAL: Must run SYNCHRONOUSLY. Do not background this command.** (Prevents SSD corruption)
    -   If the output is empty or fails (not a repo), skip to "PR Link Generation" (Assume changes were already committed or not in a repo).

2.  **Review Changes (If changes exist)**
    -   Run `git status --short` and `git diff --stat` to display the changes.
    -   **ユーザーに変更一覧を見せて「この変更をコミットしますか？」と確認する。**
    -   ユーザーが承認した場合のみ、コミットメッセージを質問して以下を実行:
        ```bash
        git add -A && git commit -m "checkout: [User Input]" && git push
        ```
    -   ⚠️ `git add .` は危険なため使用しない。`git add -A` / `git add -p` を使用する。
    -   ⚠️ コミット前に `.gitignore` が適切か確認し、`.env` 等のシークレットが含まれていないことを確認する。

3.  **PR Link Generation**
    -   Get remote URL and branch name.
    -   Display the clickable Pull Request URL: `https://github.com/[owner]/[repo]/compare/[branch]?expand=1`

## Phase 0.6: Antigravity GitHub Auto-Sync
// turbo

Antigravity core の変更を GitHub に自動 push（MacBook 版との同期）:

```bash
ANTIGRAVITY_DIR="$ANTIGRAVITY_DIR"
if [ -d "$ANTIGRAVITY_DIR/.git" ]; then
  cd "$ANTIGRAVITY_DIR"
  if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
    git add -A && git commit -m "auto-sync: $(date +%Y-%m-%d_%H%M) checkout"
  fi
  git push origin main 2>/dev/null && echo "✅ Antigravity core synced to GitHub" || echo "⚠️ GitHub push failed (offline?)"
fi
```

---

## Phase 0.7: Project Unmount Check (重要)

Desktop にマウントされたままのプロジェクトがないか確認し、あれば書き戻しを提案する。

11.5. マウント確認
```bash
MOUNT_ROOT="$HOME/Desktop/AntigravityWork"
if [ -d "$MOUNT_ROOT" ] && [ "$(ls -A $MOUNT_ROOT)" ]; then
    echo "⚠️  There are mounted projects in $MOUNT_ROOT"
    ls -1 "$MOUNT_ROOT"
    
    # ユーザーに確認
    # 「これらをSSDに書き戻してアンマウントしますか？ (Recommended)」
    
    # Yes -> /unmount ワークフローを実行
fi
```

---


## Phase 1: クリーンアップ

// turbo
0. USAGE_TRACKER更新 & GEMINI.md同期チェック
```bash
# Usage tracking
$ANTIGRAVITY_DIR/agent/scripts/update_usage_tracker.sh checkout

# GEMINI.md master diff warning
GEMINI_LOCAL="$HOME/.gemini/GEMINI.md"
GEMINI_MASTER="$ANTIGRAVITY_DIR/agent/rules/GEMINI.md.master"
if [ -f "$GEMINI_MASTER" ]; then
    if ! diff -q "$GEMINI_LOCAL" "$GEMINI_MASTER" > /dev/null 2>&1; then
        echo "⚠️  WARNING: GEMINI.md differs from SSD master!"
        echo "    Run: cp ~/.gemini/GEMINI.md $ANTIGRAVITY_DIR/agent/rules/GEMINI.md.master"
        echo "    Or review diff with: diff ~/.gemini/GEMINI.md $GEMINI_MASTER"
    else
        echo "✅ GEMINI.md is in sync with SSD master"
    fi
else
    echo "📝 GEMINI.md.master not found, creating initial copy..."
    cp "$GEMINI_LOCAL" "$GEMINI_MASTER" 2>/dev/null && echo "✅ Created GEMINI.md.master"
fi
```

// turbo
1. 現在のストレージ確認
```bash
echo "=== Before ===" && df -h / | tail -1
```

2. browser_recordings全削除
```bash
rm -rf ~/.gemini/antigravity/browser_recordings && mkdir -p ~/.gemini/antigravity/browser_recordings && echo "browser_recordings cleared"
```

3. implicit全削除
```bash
rm -rf ~/.gemini/antigravity/implicit && mkdir -p ~/.gemini/antigravity/implicit && echo "implicit cache cleared"
```

4. システムキャッシュ削除
```bash
rm -rf ~/Library/Application\ Support/Google/Chrome/Default/Service\ Worker 2>/dev/null
rm -rf ~/Library/Application\ Support/Adobe/CoreSync 2>/dev/null
rm -rf ~/Library/Application\ Support/Notion/Partitions 2>/dev/null
rm -rf ~/.npm/_npx ~/.npm/_logs ~/.npm/_prebuilds ~/.npm/_cacache 2>/dev/null
echo "system caches cleared"
```


5. ゴミ箱の古いファイルを削除（48時間超のみ）
```bash
find ~/.Trash -mindepth 1 -mtime +2 -delete 2>/dev/null && echo "Trash: files older than 48h deleted (recent files preserved)"
```

// turbo
6. 最終確認（ローカル）
```bash
echo "=== After (Local) ===" && df -h / | tail -1
```

7. 自己進化（学習データ蓄積）
```bash
echo ""
echo "🧠 自己進化プロセスを実行中..."
/evolve

echo "✅ 学習データ蓄積完了"
```

**自動実行内容**:
- セッション中の成功/失敗パターンを分析
- 改善提案を生成
- 学習データを蓄積

**メリット**:
- 全セッションで自動学習
- 継続的な改善
- 次回セッションでの精度向上

---

> [!CAUTION]
> **DEPRECATED**: This phase is no longer needed with GitHub-First architecture.
> Local cleanup is handled automatically. This section will be removed in v3.0.

## Phase 1.5: SSD Dev Cleanup (再生可能ファイル削除)

SSD上のプロジェクトから `node_modules`, `.venv`, `.next` 等の再生可能ファイルを検出・削除する。
**デフォルトは「保護」。`.ssdclean` ファイルがプロジェクトルートにあるプロジェクトのみ削除対象**とする。

> [!IMPORTANT]
> `.ssdkeep` 方式（旧）→ `.ssdclean` 方式（新）に変更。
> 開発中プロジェクトがデフォルトで保護されるため、`node_modules` の事故削除を防止。
> 明示的にクリーンアップしたいプロジェクトにのみ `.ssdclean` を配置する。

// turbo
7. ローカル環境確認
```bash
echo "✅ Local environment: $(df -h . | tail -1)"
```

8. ⚠️ 稼働中プロジェクト検出（干渉警告）

削除前に、**現在アクティブなプロジェクト**を検出して警告する。これらのプロジェクトは削除するとプロセスがクラッシュする可能性がある。

```bash
SSD="/Volumes/PortableSSD"
echo "=== ⚠️ Active Project Detection ==="
echo ""

# 1. SSD上で動作中のプロセスを検出（dev server, node, python等）
echo "🔴 SSD上で実行中のプロセス:"
ACTIVE_PIDS=$(lsof +D "$SSD" 2>/dev/null | grep -v "^COMMAND" | awk '{print $1, $2, $9}' | sort -u)
if [ -n "$ACTIVE_PIDS" ]; then
  echo "$ACTIVE_PIDS" | head -20
  echo ""
  echo "  ⚠️  上記プロセスが使用中のプロジェクトは削除すると停止します！"
else
  echo "  ✅ なし"
fi
echo ""

# 2. 直近1時間以内に変更されたプロジェクト（作業中の可能性）
echo "🟡 直近1時間以内に変更されたプロジェクト:"
find "$SSD/STUDIO/Apps" -maxdepth 2 \( -name "package.json" -o -name "pyproject.toml" \) -not -path "*/node_modules/*" 2>/dev/null | while read manifest; do
  PROJECT_DIR=$(dirname "$manifest")
  # プロジェクト内のソースファイルが直近1時間以内に変更されたか
  RECENT=$(find "$PROJECT_DIR" -maxdepth 3 -name "*.ts" -o -name "*.tsx" -o -name "*.py" -o -name "*.js" -o -name "*.jsx" 2>/dev/null | xargs stat -f "%m %N" 2>/dev/null | awk -v cutoff=$(($(date +%s) - 3600)) '$1 > cutoff {print $2}' | head -1)
  if [ -n "$RECENT" ]; then
    echo "  ⚠️  $(basename $PROJECT_DIR) — 最近編集あり"
  fi
done
echo ""

# 3. ターミナルのCWDがSSD上にあるか
echo "🟠 SSD上で作業中のターミナルセッション:"
lsof -c zsh -c bash 2>/dev/null | grep "$SSD" | awk '{print $1, $9}' | sort -u | head -5
echo ""
echo "==============================="
echo ""
```

**警告が出たプロジェクトがある場合、そのプロジェクトの削除についてユーザーに個別確認する。**

9. ドライラン: 削除候補の検出とサイズ表示

SSD接続時のみ実行。**`.ssdclean` があるプロジェクトのみ**削除候補として表示:

```bash
echo "=== SSD Dev Cleanup: Dry Run ==="
echo "📋 方式: .ssdclean (opt-in削除 / デフォルト保護)"
echo ""

SSD="/Volumes/PortableSSD"
DEV_DIR="$SSD/STUDIO/Apps"

# node_modules 検出（.ssdclean があるプロジェクトのみ削除対象）
echo "📦 node_modules:"
find "$DEV_DIR" -maxdepth 4 -name "node_modules" -type d -not -path "*/.git/*" -not -path "*/.antigravity/*" 2>/dev/null | while read nm; do
  PROJECT_ROOT=$(echo "$nm" | sed 's|/node_modules.*||')
  if [ -f "$PROJECT_ROOT/.ssdclean" ]; then
    SIZE=$(du -sh "$nm" 2>/dev/null | cut -f1)
    echo "  🗑️  $SIZE  $nm"
  else
    echo "  🛡️  PROTECTED (no .ssdclean): $(basename $PROJECT_ROOT)"
  fi
done

echo ""

# .venv / venv 検出
echo "🐍 .venv / venv:"
find "$DEV_DIR" -maxdepth 4 \( -name ".venv" -o -name "venv" \) -type d -not -path "*/.git/*" -not -path "*/.antigravity/*" 2>/dev/null | while read venv; do
  PROJECT_ROOT=$(echo "$venv" | sed "s|/\.venv$||;s|/venv$||")
  if [ -f "$PROJECT_ROOT/.ssdclean" ]; then
    SIZE=$(du -sh "$venv" 2>/dev/null | cut -f1)
    echo "  🗑️  $SIZE  $venv"
  else
    echo "  🛡️  PROTECTED (no .ssdclean): $(basename $PROJECT_ROOT)"
  fi
done

echo ""

# .next, .turbo, __pycache__, __MACOSX 検出（.ssdclean があるプロジェクト配下のみ）
echo "🏗️ Build caches (.next, .turbo, __pycache__, __MACOSX):"
find "$DEV_DIR" -maxdepth 5 \( -name ".next" -o -name ".turbo" -o -name "__pycache__" -o -name "__MACOSX" \) -type d -not -path "*/.git/*" -not -path "*/.antigravity/*" 2>/dev/null | while read cache; do
  SIZE=$(du -sh "$cache" 2>/dev/null | cut -f1)
  echo "  🗑️  $SIZE  $cache"
done

echo ""

# .DS_Store / ._* カウント（STUDIO/Apps 配下のみ）
DS_COUNT=$(find "$DEV_DIR" -name ".DS_Store" -type f 2>/dev/null | wc -l | tr -d ' ')
APPLE_COUNT=$(find "$DEV_DIR" -name "._*" -type f -not -path "*/.git/*" 2>/dev/null | wc -l | tr -d ' ')
echo "🍎 macOS metadata (STUDIO/Apps only): .DS_Store ($DS_COUNT files), ._* ($APPLE_COUNT files)"

echo ""
echo "=== SSD Before ===" && df -h /Volumes/PortableSSD | tail -1
```

10. ユーザー確認後、削除を実行

**上記のドライラン結果をユーザーに見せて「削除してよいか？」と確認する。** 承認後のみ以下を実行:

```bash
SSD="/Volumes/PortableSSD"
DEV_DIR="$SSD/STUDIO/Apps"

# node_modules 削除（.ssdclean ありのプロジェクトのみ）
find "$DEV_DIR" -maxdepth 4 -name "node_modules" -type d -not -path "*/.git/*" -not -path "*/.antigravity/*" -prune 2>/dev/null | while read nm; do
  PROJECT_ROOT=$(echo "$nm" | sed 's|/node_modules.*||')
  [ -f "$PROJECT_ROOT/.ssdclean" ] && rm -rf "$nm" && echo "✅ Deleted: $nm"
done

# .venv / venv 削除（.ssdclean ありのプロジェクトのみ）
find "$DEV_DIR" -maxdepth 4 \( -name ".venv" -o -name "venv" \) -type d -not -path "*/.git/*" -not -path "*/.antigravity/*" 2>/dev/null | while read venv; do
  PROJECT_ROOT=$(echo "$venv" | sed "s|/\.venv$||;s|/venv$||")
  [ -f "$PROJECT_ROOT/.ssdclean" ] && rm -rf "$venv" && echo "✅ Deleted: $venv"
done

# .next, .turbo, __pycache__, __MACOSX 削除（STUDIO/Apps配下のみ、.antigravity除外）
find "$DEV_DIR" -maxdepth 5 \( -name ".next" -o -name ".turbo" -o -name "__pycache__" -o -name "__MACOSX" \) -type d -not -path "*/.git/*" -not -path "*/.antigravity/*" -exec rm -rf {} + 2>/dev/null
echo "✅ Build caches cleared"

# .DS_Store / ._* 削除（STUDIO/Apps配下のみ）
find "$DEV_DIR" -name ".DS_Store" -type f -delete 2>/dev/null
find "$DEV_DIR" -name "._*" -type f -not -path "*/.git/*" -delete 2>/dev/null
echo "✅ macOS metadata cleared (STUDIO/Apps only)"

echo ""
echo "=== SSD After ===" && df -h /Volumes/PortableSSD | tail -1
```

---

## Phase 2: 自己評価フィードバックループ

このセッションでの自分のパフォーマンスを厳しく評価し、改善点を洗い出す。

### 評価項目（5段階）

1. **効率性** (1-5): 無駄なツール呼び出しはなかったか？最短経路で解決できたか？

2. **正確性** (1-5): 初回で正しい解を提示できたか？バックトラックはなかったか？

3. **コミュニケーション** (1-5): ユーザーの意図を正確に理解できたか？不要な確認はなかったか？

4. **自律性** (1-5): 適切な判断を自分で行えたか？過度な依存はなかったか？

5. **品質** (1-5): 出力物の品質は高かったか？ベストプラクティスに従っていたか？

6. **ビジョン乖離** (Vision OSセッションのみ): `/vision-os` で作成した `VISION.md` と最終成果物の乖離度を評価。
   - 乖離度 Low: ビジョン通りの実装
   - 乖離度 Mid: 意図的なピボット（理由を記録）
   - 乖離度 High: 問題あり（次回セッションで修正必要）

### 評価フォーマット

```markdown
## 🔍 セッション自己評価

| 評価項目 | スコア | 問題点 |
|---------|--------|--------|
| 効率性 | X/5 | [具体的な問題] |
| 正確性 | X/5 | [具体的な問題] |
| コミュニケーション | X/5 | [具体的な問題] |
| 自律性 | X/5 | [具体的な問題] |
| 品質 | X/5 | [具体的な問題] |
| ビジョン乖離 | Low/Mid/High | (Vision OSセッションのみ) |
| **総合** | XX/25 | |

### 最大の課題
[このセッションで最も改善が必要だった点]

### 再発防止ソリューション
[具体的な改善策。ワークフロー/スキル/ルールへの反映案]
```

---

> [!CAUTION]
> **Phase 3 は自分で合否を判定するな。**
> 自分の改善を自分でチェックするのは「味見の限界」と同じ構造だ。
> 改善内容はユーザーに見せて、ユーザーが納得して初めて Phase 4 に進める。

## Phase 3: 改善提案と実装 (Mandatory — スキップ不可)

評価で洗い出した課題に対するソリューションを**その場で実装する**。

1. **提案**: 課題解決のためのコード変更やルール更新を提案。
2. **実装**: 即座に実装・適用する。
    - ワークフロー更新
    - スキル更新
    - ルール更新
3. **コミット**: 改善内容を `kaizen: [内容]` プレフィックスでコミット。
4. **ユーザーレビュー**: 変更内容をユーザーに提示し、「この改善で根本原因が解決されるか？」を問う。ユーザーが承認して初めて Phase 4 に進む。

**フィードバックループ:**
```
自己評価 → 課題特定 → 実装 → kaizen コミット → ユーザーレビュー → Phase 4 へ
```

---

## Phase 4: 次回セッション引き継ぎ

次回の自分への引き継ぎメモを生成する。

```markdown
## NEXT_SESSION.md 生成フォーマット

# 次回セッション引き継ぎメモ
Generated: [日時]

## すぐやること
1. [最優先タスク]
2. [次に重要なタスク]

## 未完了のタスク
- [ ] [タスク1]
- [ ] [タスク2]

## 🔄 Deferred Tasks
> SSD I/Oタイムアウト等で完了できなかったタスク。次回 `/checkin` Phase 2.75 で自動リトライされる。

- [ ] `[コマンド]` — timeout [N]s at [日時]

## 注意点
- [今回発生した問題や、次回気をつけること]

## 関連ファイル
- [変更したファイルへのパス]
```

**出力先**: プロジェクトルートに `NEXT_SESSION.md` を生成

### SSD ブレインログ保存

NEXT_SESSION.md を SSD にも保存し、セッション間の知識持続性を担保：

```bash
LOG_DIR="$ANTIGRAVITY_DIR/brain_log"
mkdir -p "$LOG_DIR" 2>/dev/null
DATE=$(date +%Y-%m-%d_%H%M)
cp NEXT_SESSION.md "$LOG_DIR/session_${DATE}.md" 2>/dev/null && echo "✅ SSDブレインログ保存: $LOG_DIR/session_${DATE}.md" || echo "⚠️ SSD未接続、ローカルのみ保存"
```

> [!TIP]
> 次回の `/checkin` Phase 2.7 で `NEXT_SESSION.md` と SSD ブレインログが自動読み込まれる。

---

## Phase 4.5: セッション状態のアーカイブ

// turbo
```bash
# .session_state.json をアーカイブし、アクティブファイルを削除
node $ANTIGRAVITY_DIR/agent/scripts/session_state.js snapshot
```

---

## Phase 5: 完了

✅ チェックアウト完了
- クリーンアップ実行済み
- 自己評価完了
- **改善提案の実装完了 (Kaizen Implemented)**
- **NEXT_SESSION.md 生成済み**
- **`.session_state.json` アーカイブ済み（次回 /go で自動再init）**

Safe to shutdown.

> [!IMPORTANT]
> **Final Action**: Please manually delete this chat session history to keep the environment pristine for the next run.

---

## checkin vs checkout

| コマンド | タイミング | 削除対象 | 特別機能 |
|----------|------------|----------|----------|
| `/checkin` | 開始時 | 全データ + 24h+ conversations | 環境最新化（rsync --update） |
| `/checkout` | 終了時 | キャッシュ + .ssdcleanプロジェクトのみ | 自己評価＋改善提案 |

## 安全メカニズム

| メカニズム | 説明 |
|-----------|------|
| `.ssdclean` | プロジェクトルートに配置 → checkout時に `node_modules`/`.venv` 削除対象 |
| デフォルト | **保護**（`.ssdclean` なし = 削除されない） |
| `// turbo` | 安全な読み取り専用コマンドのみに個別付与 |
| `rsync --update` | ローカルの方が新しいファイルは上書きしない |
