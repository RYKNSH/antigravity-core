---
description: 実装後の検証を一括実行（test/fbl/debate統合）
---

# /verify - 統合検証ワークフロー

実装作業（`/work`）完了後に実行する検証フェーズ。

## Cross-Reference

```
/work → /new-feature|/bug-fix|/refactor → /verify
/vision-os Phase 4完了後 → /verify
/verify → /test + /fbl + /debate quick
/verify 成功後 → /ship
```
テスト、FBL（フィードバックループ）、クイックレビューを連鎖実行。

---

## 使用方法

```
/verify
/verify --quick    # テストのみ
/verify --deep     # 全検証 + debate deep
```

---

## 自動連鎖プロセス

### Phase 1: テスト実行
// turbo
```bash
pnpm test
```

テスト失敗時 → 即座に報告、Phase 2 をスキップ

---

### Phase 2: FBL（フィードバックループ）
// turbo

変更ファイルに対して自動検証:

```bash
pnpm lint && pnpm typecheck
```

- Lint エラー → 自動修正を提案
- Type エラー → 該当箇所を表示

---

### Phase 3: クイックレビュー

`/debate quick` 相当の簡易レビュー:

- Skeptic: 「この変更は本当に必要か？」
- Security: 「セキュリティリスクはないか？」

問題なければスキップ可能。

---

## 出力

```markdown
## ✅ /verify 完了

| 検証項目 | 結果 |
|----------|------|
| テスト | ✅ 全パス (12/12) |
| Lint | ✅ エラーなし |
| Typecheck | ✅ エラーなし |
| クイックレビュー | ✅ 問題なし |

**判定**: 🚀 ship 可能です
```

---

## オプション

| オプション | 効果 |
|-----------|------|
| `--quick` | テストのみ（高速） |
| `--deep` | 全検証 + `/debate deep` |
| `--fix` | Lint エラーを自動修正 |

---

> [!TIP]
> `/verify` が成功したら `/ship` でリリースできます
