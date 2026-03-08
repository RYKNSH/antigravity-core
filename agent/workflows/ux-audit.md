---
description: Lighthouse + axe-core + Core Web Vitals による自動UXパフォーマンス監査。単体でも/fblチェーンからも使用可能。
---

# /ux-audit - UX Performance Audit

> **哲学**: 「見た目が良い」は感覚。「スコアが高い」は事実。
> ユーザー体験を感覚ではなくデータで測定し、グローバル水準の品質を保証する。

---

## 概要

Lighthouse + axe-core + Core Web Vitals で Web アプリの UX 品質を自動的に定量測定する。
フロントエンドプロジェクト専用。APIのみのプロジェクトでは自動スキップ。

## Cross-Reference

```
/fbl Phase 3.5 → /ux-audit quick（auto）
/fbl deep Phase 3.5 → /ux-audit（full, auto）
/verify --deep → /fbl deep → /ux-audit（full）
/work "UXチェック" → /ux-audit（直接呼出し）
/ux-audit Grade C以下 → /fbl Phase 6 Self-Repair 対象
```

---

## バリエーション

| コマンド | 動作 | 用途 |
|---------|------|------|
| `/ux-audit` | フル実行（全Phase） | 実装完了後のUX品質チェック |
| `/ux-audit quick` | Phase 0 + 1 + 4 のみ | 素早いスコア確認（修正なし） |

---

## UX Audit チーム（Specialist Personas）

| ペルソナ | 担当Phase | 専門 |
|---------|-----------|------|
| ⚡ **Performance Engineer** | Phase 1a | Core Web Vitals, Lighthouse Performance |
| ♿ **Accessibility Auditor** | Phase 1b | WCAG 2.2, axe-core violations |
| 📐 **Standards Inspector** | Phase 1c | Best Practices, SEO, レスポンシブ |
| 🔧 **Auto-Fix Engineer** | Phase 3 | 自動修正可能な項目の修正 |

---

## 検証フェーズ

### Phase 0: Pre-Flight Check ⚡
**目的**: 監査対象の特定と環境準備

1. **フロントエンドプロジェクト判定**:
   ```bash
   # package.json に dev script があるか
   grep -q '"dev"' package.json 2>/dev/null && echo "frontend" || echo "skip"
   ```

2. **ローカルサーバー確認**:
   ```bash
   # 一般的なポートで稼働チェック
   curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null || \
   curl -s -o /dev/null -w "%{http_code}" http://localhost:5173 2>/dev/null || \
   curl -s -o /dev/null -w "%{http_code}" http://localhost:4321 2>/dev/null
   ```

3. **サーバー未起動時**: `npm run dev` をバックグラウンドで起動し、準備完了を待機

4. **監査対象URL特定**: ルートページ + 主要ページ（最大5ページ）

---

### Phase 1: Automated Audit 📊

3つの並列監査を実行:

#### Phase 1a: Lighthouse Audit ⚡
**担当**: Performance Engineer

// turbo
```bash
# モバイルプリセット（デフォルト）
npx lighthouse $TARGET_URL \
  --output=json \
  --output-path=./lighthouse-mobile.json \
  --chrome-flags="--headless --no-sandbox" \
  --only-categories=performance,accessibility,best-practices,seo \
  --quiet

# デスクトッププリセット
npx lighthouse $TARGET_URL \
  --output=json \
  --output-path=./lighthouse-desktop.json \
  --preset=desktop \
  --chrome-flags="--headless --no-sandbox" \
  --only-categories=performance,accessibility,best-practices,seo \
  --quiet
```

**抽出するメトリクス**:
- Performance Score (0-100)
- Accessibility Score (0-100)
- Best Practices Score (0-100)
- SEO Score (0-100)
- LCP (秒)
- TBT (ミリ秒) → INPの代替指標
- CLS (スコア)

#### Phase 1b: Accessibility Deep Scan ♿
**担当**: Accessibility Auditor

ブラウザツールで対象ページを開き:

1. axe-core の結果を確認（Lighthouse の Accessibility 詳細から取得可能）
2. 違反をSeverity分類:
   - `critical` / `serious` → 🔴 critical
   - `moderate` → 🟡 warning
   - `minor` → 🔵 info
3. 手動チェック（ブラウザ操作）:
   - Tab キーでのフォーカス移動順序
   - フォーカスインジケータの視認性
   - 動的コンテンツの aria-live 対応

#### Phase 1c: Standards & Responsive Check 📐
**担当**: Standards Inspector

ブラウザツールで3ビューポートをスクリーンショット:

| ビューポート | 幅 | チェック内容 |
|------------|-----|------------|
| Mobile | 375px | タッチターゲット ≥ 44px、横スクロール無し |
| Tablet | 768px | レイアウト崩れ無し |
| Desktop | 1440px | 余白・コンテンツ幅の適切さ |

追加チェック:
```markdown
- [ ] meta viewport が設定されているか
- [ ] title タグが適切か
- [ ] meta description があるか
- [ ] OGP タグが設定されているか
- [ ] favicon が存在するか
```

---

### Phase 2: Score Card 📋
**目的**: 結果を集約しグレード判定

#### グレード判定

| Grade | Performance | Accessibility | Best Practices | SEO |
|-------|------------|---------------|---------------|-----|
| **S** | ≥ 95 | 100 | ≥ 95 | ≥ 95 |
| **A** | ≥ 85 | ≥ 95 | ≥ 85 | ≥ 85 |
| **B** | ≥ 70 | ≥ 85 | ≥ 70 | ≥ 70 |
| **C** | ≥ 50 | ≥ 70 | ≥ 50 | ≥ 50 |
| **D** | < 50 | < 70 | < 50 | < 50 |

**総合グレード** = 4カテゴリの最低グレード（ボトルネック方式）

#### 改善優先順位

Lighthouse の `opportunities` と `diagnostics` を解析し、インパクト順にソート:
1. 推定節約時間が大きい順
2. axe-core の critical/serious 違反
3. CWV の Poor 判定メトリクス

---

### Phase 3: Auto-Fix 🔧
**担当**: Auto-Fix Engineer
**目的**: 自動修正可能な項目を修正

> `/ux-audit quick` ではこのフェーズをスキップ。

#### 自動修正可能な項目

| 問題 | 自動修正内容 |
|-----|------------|
| 画像に alt 属性がない | ファイル名から自動生成、またはデコラティブなら `alt=""` 追加 |
| html に lang 属性がない | `lang="ja"` 追加 |
| meta viewport 不在 | `<meta name="viewport" content="width=device-width, initial-scale=1">` 追加 |
| meta description 不在 | プロジェクト名からテンプレート生成 |
| フォーム label 不在 | 近接テキストから aria-label を推定付与 |
| color-contrast 不足 | HSL調整で最小コントラスト比に自動修正 |

**安全ルール**:
- 自動修正は `🔵 info` と `🟡 warning` レベルの明確なパターンのみ
- `🔴 critical` の自動修正は行わない（手動判断が必要）
- 修正前に git checkpoint を作成

```bash
git add -A && git commit -m "ux-audit: checkpoint before auto-fix"
```

---

### Phase 4: Audit Report 📋
**目的**: 最終レポートを出力

スキル `ux-performance-audit` の出力フォーマットに従ってスコアカードを生成。

**Verdict 判定**:

| Verdict | 条件 |
|---------|------|
| 🟢 **PASS** | 総合 Grade B 以上、axe-core critical = 0 |
| 🟡 **CONDITIONAL** | 総合 Grade C、または axe-core warning ≥ 3 |
| 🔴 **BLOCKED** | 総合 Grade D、または axe-core critical ≥ 1 |

**`/fbl` からの呼び出し時**:
- `BLOCKED` → Phase 6 Self-Repair 対象に含める
- `CONDITIONAL` → レポートに記録、Phase 5 UX Advocate が判断
- `PASS` → 続行

---

## `/ux-audit quick` フロー

高速版。スコア確認のみ。

1. **Phase 0**: Pre-Flight Check
2. **Phase 1**: Automated Audit（Lighthouse + axe summary のみ）
3. **Phase 4**: Audit Report（スコアカード出力）

所要時間目安: 2-3分

---

## 発動条件まとめ

| トリガー | 発動元 | モード |
|---------|--------|--------|
| `/fbl` Phase 3.5 | 自動（通常時） | `quick` |
| `/fbl deep` Phase 3.5 | 自動 | `full` |
| `/work "UXチェック"` | 手動 | `full` |
| 直接呼出し `/ux-audit` | 手動 | `full` |
| 直接呼出し `/ux-audit quick` | 手動 | `quick` |

---

## 前提条件

> [!NOTE]
> Lighthouse CLI は `npx` 経由で実行するため、事前インストール不要。
> axe-core の結果は Lighthouse Accessibility 詳細から取得できるため、別途インストール不要。

---

## 注意事項

> [!IMPORTANT]
> このWFは**フロントエンドプロジェクト専用**。
> `package.json` に `dev` スクリプトが存在しないプロジェクトでは自動スキップする。

> [!CAUTION]
> **自動実行禁止の操作**:
> - 本番URLへのLighthouse実行（ローカルのみ）
> - CSSの大幅な色変更（color-contrast修正はHSL微調整のみ）
> - HTML構造の大幅変更（セマンティクス修正は属性追加のみ）

---

## Toolchain

**Skills**: `ux-performance-audit`
**Knowledge**: `high_fidelity_ux_audit_patterns`
