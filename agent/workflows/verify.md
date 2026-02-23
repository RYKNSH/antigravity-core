---
description: 実装後の検証を一括実行 — Risk-Based Verify Chain + Always-On Quality Scoring
---

# /verify - Smart Verification Chain

**役割**: タスクサイズに応じた適切な検証レベルを自動選択し、品質を保証する。

> [!NOTE]
> `/go` Phase 4 から自動呼び出しされる。直接呼び出しも可能。
> 旧 `/verify` の固定パイプラインから、規模連動の Smart Chain に進化。

## Cross-Reference

```
/go Phase 4 → /verify（Risk-Based判定）
/verify Quick → Pre-Flight + fbl quick + test-evolve scoring
/verify Standard → + error-sweep + test-evolve quick
/verify Deep → + test-evolve standard + debate quick
/verify 失敗 → /go Phase 5 セルフリペア → /debug-deep
Auto-Escalation: 品質B未満3コミット連続 → 強制Deep
```

---

## 使用方法

```bash
/verify           # 規模自動判定
/verify --quick   # 強制 quick
/verify --deep    # 強制 deep
```

---

## Phase 0: Smart Dedup Check（コンテンツハッシュ方式）

```bash
# Bazel/Turborepo方式: ソースのハッシュが前回成功時と同一ならスキップ
CURRENT_HASH=$(git diff HEAD --name-only 2>/dev/null | sort | xargs cat 2>/dev/null | shasum -a 256 | cut -d' ' -f1)
LAST_HASH=$(cat .last_quality_hash 2>/dev/null || echo "")

if [ "$CURRENT_HASH" = "$LAST_HASH" ] && [ -n "$LAST_HASH" ]; then
    echo "✅ Pre-flight skipped (content hash unchanged: ${CURRENT_HASH:0:8})"
    SKIP_PREFLIGHT=true
fi
```

---

## Phase 1: Pre-Flight（Dedup可能）

// turbo
```bash
if [ "$SKIP_PREFLIGHT" != "true" ]; then
    pnpm lint && pnpm typecheck && pnpm test
    touch .last_quality_check
fi
```

---

## Verify Chain（規模連動）

### Quick（Low Risk）
**対象**: CSS/config/docs修正、typo、1-2ファイル変更

1. Phase 1: Pre-Flight（lint + typecheck + test）
2. `/fbl quick`（Phase 0 + 3 のみ — 視覚確認）
3. `/test-evolve scoring`（Phase 4 のみ — 品質スコア記録。修正なし）
4. 完了レポート

### Standard（Medium Risk）
**対象**: ロジック変更、単一コンポーネント、3-5ファイル変更

1. Phase 1: Pre-Flight
2. `/fbl`（全Phase 0-7）
3. `/error-sweep`（コードレベル不整合検出）
4. `/test-evolve quick`（Phase 0+3+4+6 — カバレッジ+スコア+学習）
5. 完了レポート

### Deep（High Risk）
**対象**: DB schema変更、認証/決済ロジック、新API追加、アーキテクチャ変更、6+ファイル横断、ship前、品質B未満3連続

> 🏥 **Health Check Protocol 適用**

1. Phase 1: Pre-Flight
2. `/fbl deep`（全Phase + Error Sweep + Test Evolution）
3. `/test-evolve standard`（Phase 0+1+3+4+5+6 — ミューテーション含む）
4. `/debate quick`（マルチペルソナ最終レビュー）
5. 完了レポート

---

## Risk-Based 判定ロジック

> [!IMPORTANT]
> **最大値ルール**: 3つの判定因子のうち最もリスクの高い結果を採用する。
> 1ファイルでもDB schema変更ならDeep。10ファイルでもCSS修正ならQuick。

### 判定因子

| # | 因子 | Quick (1) | Standard (2) | Deep (3) |
|---|------|-----------|-------------|----------|
| A | **ファイル数** | ≤2 | 3-5 | 6+ |
| B | **変更種別** | CSS/config/docs/typo | ロジック/UI変更 | DB schema/認証/決済/API新規 |
| C | **コンテキスト** | 通常 | 新API追加 | ship前/MS完了/アーキ変更 |

### 判定フロー

```markdown
1. ファイル数スコア（A）を算出
2. 変更種別スコア（B）を算出 — 変更ファイルの内容を分析:
   - DB migration ファイル検出 → Deep
   - auth/ 配下の変更 → Deep
   - schema 定義ファイルの変更 → Deep
   - API route/endpoint の新規追加 → Standard以上
3. コンテキストスコア（C）を算出:
   - /ship から呼ばれた → Deep
   - MS完了条件を満たした → Deep
   - アーキテクチャ変更を含む → Deep
4. Risk Score = max(A, B, C)
5. コマンドライン引数 --quick / --deep で上書き可能
```

### 変更種別の自動検出

```bash
# 変更ファイル一覧を取得
CHANGED_FILES=$(git diff --name-only HEAD~1 2>/dev/null)
FILE_COUNT=$(echo "$CHANGED_FILES" | wc -l)

# 因子A: ファイル数
if [ "$FILE_COUNT" -le 2 ]; then SCORE_A=1
elif [ "$FILE_COUNT" -le 5 ]; then SCORE_A=2
else SCORE_A=3; fi

# 因子B: 変更種別（パターンマッチ）
SCORE_B=1
echo "$CHANGED_FILES" | grep -qiE 'migrate|schema|prisma\.schema|drizzle' && SCORE_B=3
echo "$CHANGED_FILES" | grep -qiE 'auth|session|token|password|credential' && SCORE_B=3
echo "$CHANGED_FILES" | grep -qiE 'payment|billing|stripe|subscription' && SCORE_B=3
echo "$CHANGED_FILES" | grep -qiE 'route|endpoint|api/' && [ "$SCORE_B" -lt 2 ] && SCORE_B=2
# CSS/config/docs のみなら 1 のまま

# 因子C: コンテキスト（呼出元による上書き）
SCORE_C=${CONTEXT_SCORE:-1}  # /ship からの呼出時は 3 がセットされる

# Auto-Escalation: 品質B未満3コミット連続 → 強制Deep
if [ -f ".test_quality_history.md" ]; then
    LOW_COUNT=$(tail -3 .test_quality_history.md | grep -cE '\| [CD] \|' 2>/dev/null || echo 0)
    [ "$LOW_COUNT" -ge 3 ] && SCORE_C=3 && echo "⚠️ Auto-Escalation: 品質B未満3コミット連続 → 強制Deep"
fi

# Risk Score = max(A, B, C)
RISK_SCORE=$(echo -e "$SCORE_A\n$SCORE_B\n$SCORE_C" | sort -rn | head -1)

case $RISK_SCORE in
  1) SIZE="quick" ;;
  2) SIZE="standard" ;;
  3) SIZE="deep" ;;
esac

# コマンドライン引数で上書き
[ "$1" = "--quick" ] && SIZE="quick"
[ "$1" = "--deep" ] && SIZE="deep"

echo "🔍 Verify Chain: $SIZE (Risk Score: $RISK_SCORE — Files: $SCORE_A, Type: $SCORE_B, Context: $SCORE_C)"
```

---

## 120% Quality Gate（全レベル共通）

```markdown
- [ ] ユーザーが「おっ」と思う演出があるか
- [ ] エラーメッセージは親切か
- [ ] ローディング状態は美しいか
- [ ] アクセシビリティは考慮されているか
```

---

## 完了条件

| レベル | 合格条件 |
|--------|---------|
| Quick | Pre-Flight Pass + FBL quick Pass + test-evolve scoring記録 |
| Standard | Quick + Error Sweep critical = 0 + test-evolve quick Pass |
| Deep | Standard + test-evolve standard Pass (Test Quality ≥ B) + Debate 合意 |

## エラー時

| 状況 | 対応 |
|------|------|
| Pre-Flight 失敗 | → セルフリペア（プログレッシブ拡張: 3回→/debug-deep→5回→First Principles→5回） |
| FBL 修正ループ上限 | → `/debug-deep` |
| Error Sweep critical | → 即修正 → 再検証 |
| Test Quality < B | → `/test-evolve` Phase 5 で改善 |
