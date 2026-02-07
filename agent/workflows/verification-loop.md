---
description: 全ての実装に検証フィードバックループを適用
---

# Verification Loop

> 実装 → 検証 → 修正 → 再検証のサイクルを回す

---

## 概要

全ての実装に対して自動検証を適用し、品質を担保する。
FBLの軽量版として、より頻繁に適用可能。

---

## ステップ

### 1. 基本検証
// turbo
```bash
pnpm lint && pnpm typecheck
```

### 2. テスト実行
// turbo
```bash
pnpm test
```

### 3. ビルド検証
// turbo
```bash
pnpm build
```

### 4. 問題対応

問題が見つかった場合：
1. エラーメッセージを分析
2. 修正を実施
3. ステップ1から再実行

**ループ上限**: 3回まで

### 5. 完了

全てのチェックがパスしたら完了。

---

## クイックリファレンス

| 検証項目 | コマンド |
|---------|---------|
| Lint | `pnpm lint` |
| 型チェック | `pnpm typecheck` |
| テスト | `pnpm test` |
| ビルド | `pnpm build` |
| 全部 | `pnpm lint && pnpm typecheck && pnpm test && pnpm build` |
