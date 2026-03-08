---
name: react-best-practices
description: React/Next.jsパフォーマンス最適化ガイドライン（Vercel Engineering公式）。コンポーネント作成、データフェッチ、バンドル最適化時に適用。
source: vercel-labs/agent-skills (公式)
version: "1.0.0"
---

# Vercel React Best Practices

40+ルール、8カテゴリのパフォーマンス最適化ガイド。

## 適用タイミング

- 新しいReactコンポーネント/Next.jsページ作成時
- データフェッチ（クライアント/サーバー）実装時
- パフォーマンスレビュー時
- バンドルサイズ・ロード時間の最適化時

## カテゴリ別優先度

| 優先 | カテゴリ | インパクト |
|------|---------|---------|
| 1 | Waterfalls排除 | CRITICAL |
| 2 | バンドルサイズ最適化 | CRITICAL |
| 3 | サーバーサイド性能 | HIGH |
| 4 | クライアントデータフェッチ | MEDIUM-HIGH |
| 5 | 再レンダー最適化 | MEDIUM |
| 6 | レンダリング性能 | MEDIUM |
| 7 | JavaScript性能 | LOW-MEDIUM |
| 8 | 高度なパターン | LOW |

## Quick Reference

### 1. Waterfalls排除 (CRITICAL)
- `async-defer-await` — awaitを使用ブランチ内に移動
- `async-parallel` — 独立操作にPromise.all()
- `async-suspense-boundaries` — Suspenseでコンテンツストリーミング

### 2. バンドルサイズ最適化 (CRITICAL)
- `bundle-barrel-imports` — barrelファイル回避、直接import
- `bundle-dynamic-imports` — 重いコンポーネントにnext/dynamic
- `bundle-defer-third-party` — analytics/loggingはhydration後に読込

### 3. サーバーサイド性能 (HIGH)
- `server-cache-react` — React.cache()でリクエスト毎の重複排除
- `server-serialization` — クライアントコンポーネントに渡すデータを最小化
- `server-parallel-fetching` — コンポーネント構造でフェッチを並列化
- `server-after-nonblocking` — after()で非ブロッキング操作

### 4. クライアントデータフェッチ (MEDIUM-HIGH)
- `client-swr-dedup` — SWRで自動リクエスト重複排除
- `client-passive-event-listeners` — scrollにpassiveリスナー

### 5. 再レンダー最適化 (MEDIUM)
- `rerender-memo` — 高コスト処理をmemoizedコンポーネントに抽出
- `rerender-derived-state` — 派生booleanをサブスクライブ
- `rerender-functional-setstate` — 安定コールバックにfunctional setState
- `rerender-transitions` — 非優先更新にstartTransition

### 6. レンダリング性能 (MEDIUM)
- `rendering-content-visibility` — 長リストにcontent-visibility
- `rendering-hoist-jsx` — 静的JSXをコンポーネント外に抽出
- `rendering-activity` — show/hideにActivityコンポーネント

### 7. JavaScript性能 (LOW-MEDIUM)
- `js-index-maps` — 繰り返し検索にMap構築
- `js-combine-iterations` — 複数filter/mapを1ループに
- `js-set-map-lookups` — O(1)検索にSet/Map

---

## Toolchain

**Scripts**: None
**Knowledge**: None
**Related WF**: None
