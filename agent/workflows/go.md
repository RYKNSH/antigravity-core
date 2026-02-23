---
description: 計画されたタスクを実装するモード。ルーティング・品質チェック・Knowledge Preloadを統合。
---

# /go - Builder Mode（統合版）

**役割**: タスクのルーティング → 実装 → 品質保証を一気通貫で実行するコアコマンド。
旧 `/work` のルーティングロジックを統合。

> [!NOTE]
> `/work` はこのWFの内部Phase（Phase 1）として統合されました。
> 後方互換のため `/work "タスク"` は `/go "タスク"` にリダイレクトされます。

## Cross-Reference

```
/l0-l3 → /level + /go "タスク"
/go "タスク" → Phase 0-5（本WF）
/xx-dev → Context Recovery → /go "タスク"
失敗時: /go → /debug-deep → /go（エスカレーション）
```

---

## 使用方法

```bash
/go "タスク"             # タスク指定で実行
/go                     # 現在ブランチで続行
/work "タスク"           # → /go にリダイレクト（後方互換）
```

---

## Phase 0: Pre-Flight（品質ファースト）

### 0-1. THINK Gate Check

タスクサイズを自動判定し、該当する THINK Gate を実行:

| サイズ | 判定条件 | 必須GATE |
|--------|---------|----------|
| **Small** | CSS修正、typo、設定変更 | K（既知の解法確認） |
| **Medium** | 単一コンポーネント、API追加 | T（技術調査）+ N（副作用確認）+ K |
| **Large** | 複数ファイル横断、アーキテクチャ変更 | H（仮説）+ T + I（影響範囲）+ N + K |

```markdown
🧠 THINK Gate [Size]
- [ ] [該当するGate項目]
```

### 0-2. Knowledge Preload

過去の学習データをタスク計画に反映:

```bash
# 直近のエラーパターン
[ -f ".debug_learnings.md" ] && echo "📚 Debug Learnings:" && head -20 .debug_learnings.md

# テスト盲点パターン  
[ -f ".test_evolution_patterns.md" ] && echo "🧬 Test Patterns:" && head -20 .test_evolution_patterns.md

# コード品質パターン
[ -f ".sweep_patterns.md" ] && echo "🔬 Sweep Patterns:" && head -20 .sweep_patterns.md
```

> [!TIP]
> 過去の失敗パターンに該当するタスクの場合、計画段階で対策を織り込む。

### 0-3. Context Recovery（WHITEPAPER存在時）

WHITEPAPER.md が存在するプロジェクトでは自動でコンテキスト回帰:

```markdown
# WHITEPAPER.md 存在 → ビジョン・設計原則を把握
# ROADMAP.md 存在 → 現在MSと進捗を把握
# MILESTONE.md 存在 → タスクリストと依存関係を把握
```

ROADMAP.md / MILESTONE.md があれば、タスクのMS内での位置づけを `.session_state` に記録。

---

## Phase 1: ルーティング（旧 /work）

タスクを分析し、適切な子WFを自動選択:

| キーワード | 子WF |
|-----------|------|
| 実装、追加、新機能 | `/new-feature` |
| バグ、修正、直して | `/bug-fix` |
| リファクタ、整理、改善 | `/refactor` |
| テスト、検証 | `/test` + `/fbl` |
| エラーチェック、スイープ | `/error-sweep` |
| デプロイ、リリース | `/deploy` |
| レビュー、確認 | `/debate` |
| マイグレーション | `/db-migrate` |

### 透明性の確保

```markdown
# L0-L1: 確認あり
📋 タスク分析結果
**入力**: "[タスク]"
**判定**: [カテゴリ]
🔧 実行予定: /[子WF]
続行しますか？ (Y/n)

# L2-L3: 自動実行
📋 タスク分析 → /[子WF] 実行中...
```

---

## Phase 2: Branch Management

```bash
ANTIGRAVITY_DIR="${ANTIGRAVITY_DIR:-$HOME/.antigravity}"

# Fuzzy Match（クエリ指定時）
if [ -n "$QUERY" ]; then
    RESULT=$(node "$ANTIGRAVITY_DIR/agent/scripts/fuzzymatch.js" "$QUERY" 2>/dev/null)
    FOUND=$(echo "$RESULT" | grep -o '"found":true')
    
    if [ "$FOUND" ]; then
        BRANCH=$(echo "$RESULT" | grep -o '"branch":"[^"]*"' | cut -d'"' -f4)
        git checkout "$BRANCH" 2>/dev/null || git checkout -b "$BRANCH"
    fi
fi

# Session State
node "$ANTIGRAVITY_DIR/agent/scripts/session_state.js" set-workflow "/go" "implementation"
```

---

## Phase 3: 子WF実行

ルーティング結果に基づき子WFを実行。
子WFの実装・テストフェーズはそのまま継承。

---

## Phase 4: Smart Verify（規模連動 + Smart Dedup）

子WF完了後、タスクサイズに応じた品質チェックを実行。
**Smart Dedup**（Bazel/Turborepo方式）: ソースファイルのハッシュが前回成功時と同一ならスキップ。

### Verify Chain（Risk-Based 判定）

| Risk Level | チェック内容 | 目安時間 |
|------------|------------|---------|
| **Quick** (Low Risk) | lint + typecheck + test + fbl quick + **test-evolve scoring** | ~2分 |
| **Standard** (Medium Risk) | quick + error-sweep + **test-evolve quick** | ~8分 |
| **Deep** (High Risk) | standard + **test-evolve standard**(ミューテーション含む) + debate quick | ~20分 |

> [!IMPORTANT]
> **AI-Driven前提**: リソース制約なし。全コミットで品質スコア計測（scoring）。
> Risk Score = max(ファイル数, 変更種別, コンテキスト)。
> DB/認証/決済/新API → 自動Deep。ship前 → 強制Deep。品質B未満3連続 → Auto-Escalation。
> 詳細は `/verify` の Risk-Based 判定ロジックを参照。

```markdown
# ユーザーが明示的に指定した場合はそちらを優先
/verify --quick    # 強制quick
/verify --deep     # 強制deep
```

### Smart Dedup ロジック（コンテンツハッシュ方式）

```bash
# ソースファイルのハッシュを計算（Bazel/Turborepo方式）
CURRENT_HASH=$(git diff HEAD --name-only 2>/dev/null | sort | xargs cat 2>/dev/null | shasum -a 256 | cut -d' ' -f1)
LAST_HASH=$(cat .last_quality_hash 2>/dev/null || echo "")

if [ "$CURRENT_HASH" = "$LAST_HASH" ] && [ -n "$LAST_HASH" ]; then
    echo "✅ Quality check skipped (content hash unchanged: ${CURRENT_HASH:0:8})"
else
    # チェック実行
    pnpm lint && pnpm typecheck && pnpm test
    echo "$CURRENT_HASH" > .last_quality_hash
fi
```

> [!TIP]
> 時間ベース（5分）ではなくコンテンツハッシュベース。
> 「1秒前に変更した」→ 再実行。「1時間前だけど何も変わっていない」→ スキップ。

---

## Phase 5: Completion + Semantic Commit

### 5-1. 自動品質保証
Phase 4 の検証結果に基づき:
- **Pass** → 5-2 へ
- **Fail** → セルフリペア → プログレッシブ拡張（3回→/debug-deep→5回→First Principles→5回 = 最大13回）

### 5-2. セマンティックコミット＋プッシュ

> [!IMPORTANT]
> **NON-NEGOTIABLE**: このフェーズは**絶対にスキップしてはならない**。
> Phase 4 が Pass した時点で、以下のコミット＋プッシュを**必ず実行する**。
> ユーザーに「コミットしますか？」と聞く必要はない。L0-L3 全レベルで自動実行。

**目的**: 将来AIがgit履歴を読んで開発日誌を書けるよう、セマンティックな境界で意味のあるコミットを作る。

#### コミットタイミング（3境界）

| 境界 | タイミング | コミットメッセージ | プッシュ |
|------|-----------|-----------------|---------|
| **タスク完了** | 子WF + verify Pass 後 | `impl:` / `fix:` / `refactor:` + what + why | ✅ 即push |
| **MS完了** | /test-evolve full Pass 後 | `milestone: MS[N.M] [名前] 完了` | ✅ 即push |
| **セッション終了** | /checkout 時 | `session: [日付] [サマリー]` | ✅ 即push（既存） |

#### コミットメッセージのルール

AIが後から読んで文脈を理解できるコミットメッセージ:

```bash
# ❌ 悪い例（文脈がない）
git commit -m "fix bug"

# ✅ 良い例（what + why + impact）
git commit -m "fix: トークン検証でexpiry未チェックだったため期限切れトークンでもログイン可能だった

- auth/verifyToken.ts: expiryチェック追加
- 影響: セキュリティ修正（全ユーザー）
- テスト: 3ケース追加（期限切れ, 改竄, 正常）"
```

#### 自動実行

// turbo
```bash
# タスク完了時（Phase 4 Pass 後に自動実行 — スキップ禁止）
COMMIT_TYPE=$(echo "$CHILD_WF" | sed 's/new-feature/impl/;s/bug-fix/fix/;s/refactor/refactor/')
git add -A
git commit -m "${COMMIT_TYPE}: [タスク名]

- 変更: [主要ファイル]
- 理由: [why]
- テスト: [追加/修正テスト概要]"
git push origin HEAD
```

> [!CAUTION]
> `git push` 失敗時（認証エラー等）はユーザーに報告する。
> コミット自体は成功している場合、プッシュのリトライは1回のみ。

### 5-3. MS進捗チェック（ROADMAP存在時）

ROADMAP.md / MILESTONE.md が存在する場合:
```markdown
✅ タスク完了 → MILESTONE.md の該当タスクに ✅
→ MS完了条件を確認
→ 全条件満たした → /test-evolve full（MS品質ゲート）
→ milestone コミット＋プッシュ
→ 次タスクの提案（Phase 1 に戻る）
```

### 5-4. 完了レポート

```markdown
📋 /go 完了レポート

**タスク**: [タスク名]
**子WF**: /[実行したWF]
**検証**: [quick/standard/deep] — Pass
**コミット**: `[type]: [メッセージ]` → pushed ✅
**MS進捗**: MS[N.M] [X/Y]タスク完了（該当する場合）
```

---

## エスカレーション

| 状況 | 対応 |
|------|------|
| セルフリペア3回失敗 | → `/debug-deep` |
| `/debug-deep` 3回失敗 | → ⛔ PAUSE（ユーザー介入） |
| 子WFが不明 | → ユーザーに確認 |

---

## `/spec` → `/go` 自動遷移

`/spec` でSPEC.md生成完了後:
- **L0-L1**: 「/go で実装を開始しますか？」と提案
- **L2-L3**: 自動で `/go` を実行
