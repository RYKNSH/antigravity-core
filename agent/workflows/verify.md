---
description: 実装後の検証を一括実行 — 規模連動 Verify Chain + Smart Dedup
---

# /verify - Smart Verification Chain

**役割**: タスクサイズに応じた適切な検証レベルを自動選択し、品質を保証する。

> [!NOTE]
> `/go` Phase 4 から自動呼び出しされる。直接呼び出しも可能。
> 旧 `/verify` の固定パイプラインから、規模連動の Smart Chain に進化。

## Cross-Reference

```
/go Phase 4 → /verify（規模自動判定）
/verify --deep → /fbl deep + /error-sweep + /test-evolve quick + /debate quick
/verify 失敗 → /go Phase 5 セルフリペア → /debug-deep
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

### Quick（Small タスク向け）
**対象**: CSS修正、typo、設定変更、1ファイル変更

1. Phase 1: Pre-Flight（lint + typecheck + test）
2. `/fbl quick`（Phase 0 + 3 のみ — 視覚確認）
3. 完了レポート

### Standard（Medium タスク向け）
**対象**: 単一コンポーネント、API追加、2-5ファイル変更

1. Phase 1: Pre-Flight
2. `/fbl`（全Phase 0-7）
3. `/error-sweep`（コードレベル不整合検出）
4. `/test-evolve quick`（テスト品質検証）
5. 完了レポート

### Deep（Large タスク向け）
**対象**: 複数ファイル横断、アーキテクチャ変更、リリース前

> 🏥 **Health Check Protocol 適用**

1. Phase 1: Pre-Flight
2. `/fbl deep`（全Phase + Error Sweep + Test Evolution）
3. `/test-evolve quick`（テスト品質検証）
4. `/debate quick`（マルチペルソナ最終レビュー）
5. 完了レポート

---

## 規模自動判定ロジック

```bash
# 変更ファイル数で自動判定
FILE_COUNT=$(git diff --name-only HEAD~1 2>/dev/null | wc -l)

if [ "$FILE_COUNT" -le 2 ]; then
    SIZE="quick"
elif [ "$FILE_COUNT" -le 10 ]; then
    SIZE="standard"
else
    SIZE="deep"
fi

# コマンドライン引数で上書き
[ "$1" = "--quick" ] && SIZE="quick"
[ "$1" = "--deep" ] && SIZE="deep"

echo "🔍 Verify Chain: $SIZE (${FILE_COUNT} files changed)"
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
| Quick | Pre-Flight Pass + FBL quick Pass |
| Standard | Quick + Error Sweep critical = 0 |
| Deep | Standard + Test Quality ≥ B + UX Audit ≥ B + Debate 合意 |

## エラー時

| 状況 | 対応 |
|------|------|
| Pre-Flight 失敗 | → セルフリペア（最大3回） |
| FBL 修正ループ上限 | → `/debug-deep` |
| Error Sweep critical | → 即修正 → 再検証 |
| Test Quality < B | → `/test-evolve` Phase 5 で改善 |
