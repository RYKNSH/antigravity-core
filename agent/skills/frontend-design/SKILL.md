---
name: frontend-design
description: 汎用的で高品質なフロントエンドUIを設計・実装するスキル。Webコンポーネント、ページ、ダッシュボード等に適用。
source: anthropics/skills (公式)
---

# Frontend Design

独創的でプロダクション品質のフロントエンドを作る。「AIっぽい」ジェネリックな美学を避ける。

## デザイン思考プロセス

コーディング前に:
1. **Purpose**: この UIが解決する問題は？誰が使う？
2. **Tone**: 極端な方向性を1つ選ぶ — ブルータリスト、ミニマル、レトロフューチャリスト、ラグジュアリー、エディトリアル等
3. **Constraints**: フレームワーク、パフォーマンス、アクセシビリティ
4. **Differentiation**: 何がこのUIを「忘れられない」ものにするか？

## 美学ガイドライン

### Typography
- Inter, Roboto, Arial等のジェネリックフォント禁止
- 個性的なディスプレイフォント + 洗練されたボディフォントの組み合わせ

### Color & Theme
- CSS変数で一貫性を保つ
- 支配的な色 + シャープなアクセント > 均等配分された弱い配色

### Motion
- CSS-only優先。Reactの場合はMotionライブラリ
- ページロード時のstaggered reveals（animation-delay）が最もインパクト大

### Spatial Composition
- 非対称レイアウト、オーバーラップ、対角線フロー
- 大胆なネガティブスペース OR コントロールされた密度

### 背景 & ビジュアル
- ソリッドカラーをデフォルトにしない
- グラデーションメッシュ、ノイズテクスチャ、幾何学パターン、グレインオーバーレイ

## アンチパターン（AI Slop）

❌ 使い古されたフォント（Inter, Roboto, Arial, system fonts）
❌ ありがちな配色（白背景に紫グラデーション）
❌ 予測可能なレイアウト＆コンポーネントパターン
❌ コンテキストに特化しない無個性なデザイン

---

## Toolchain

**Scripts**: None
**Knowledge**: None
**Related WF**: None
