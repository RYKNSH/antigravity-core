---
name: ux-performance-audit
description: Lighthouse + axe-core + Core Web Vitals による自動UXパフォーマンス監査。/ux-audit WFの技術基盤。
source: Google Lighthouse + Deque axe-core + Nielsen Norman Group + WCAG 2.2
---

# UX Performance Audit

Web アプリのユーザー体験を自動で定量測定するスキル。

## アプローチ決定ツリー

```
UXテスト対象 → フロントエンドプロジェクト?
    ├─ No → スキップ（APIのみのプロジェクト等）
    └─ Yes → ローカルサーバー起動済み?
        ├─ No → with_server.py で起動 → 監査実行
        └─ Yes → 直接監査実行
```

---

## 4つの監査レイヤー

### Layer 1: Core Web Vitals（パフォーマンス体感）

| メトリクス | 計測対象 | Good | Needs Improvement | Poor |
|-----------|---------|------|-------------------|------|
| **LCP** | 最大コンテンツ描画 | ≤ 2.5s | 2.5-4.0s | > 4.0s |
| **INP** | インタラクション応答 | ≤ 200ms | 200-500ms | > 500ms |
| **CLS** | レイアウト安定性 | ≤ 0.1 | 0.1-0.25 | > 0.25 |

### Layer 2: Accessibility（WCAG 2.2 Level AA）

axe-core で自動検出可能な主要チェック:

```markdown
- [ ] 画像に alt 属性があるか
- [ ] カラーコントラスト比 ≥ 4.5:1（通常テキスト）/ ≥ 3:1（大テキスト）
- [ ] フォーム要素に label が紐づいているか
- [ ] 見出し階層が正しいか（h1→h2→h3 の順序）
- [ ] ボタン/リンクにアクセシブル名があるか
- [ ] ARIA属性が正しく使用されているか
- [ ] キーボードフォーカスが視覚的に確認できるか
- [ ] lang 属性がhtml要素にあるか
```

### Layer 3: Lighthouse Categories

| カテゴリ | 対象 |
|---------|------|
| Performance | LCP, TBT, CLS, Speed Index, FCP |
| Accessibility | WCAG自動チェック（axe-coreベース） |
| Best Practices | HTTPS, Console errors, Deprecated APIs |
| SEO | meta, heading structure, crawlability |

### Layer 4: レスポンシブ検証

| ビューポート | 幅 | 用途 |
|------------|-----|------|
| Mobile | 375px | iPhone SE/標準 |
| Tablet | 768px | iPad |
| Desktop | 1440px | 標準デスクトップ |

---

## スコアリング

### Lighthouse スコア → グレード変換

| Grade | Performance | Accessibility | Best Practices | SEO |
|-------|------------|---------------|---------------|-----|
| **S** | ≥ 95 | 100 | ≥ 95 | ≥ 95 |
| **A** | ≥ 85 | ≥ 95 | ≥ 85 | ≥ 85 |
| **B** | ≥ 70 | ≥ 85 | ≥ 70 | ≥ 70 |
| **C** | ≥ 50 | ≥ 70 | ≥ 50 | ≥ 50 |
| **D** | < 50 | < 70 | < 50 | < 50 |

**総合グレード** = 最も低いカテゴリのグレード（ボトルネック方式）

### axe-core 違反 → Severity マッピング

| axe impact | Sweep Severity | 扱い |
|-----------|---------------|------|
| critical | 🔴 critical | 必ず修正 |
| serious | 🔴 critical | 必ず修正 |
| moderate | 🟡 warning | 修正推奨 |
| minor | 🔵 info | 記録のみ |

---

## 実行パターン

### Lighthouse CLI（ヘッドレス）

```bash
# インストール確認
npx lighthouse --version 2>/dev/null || npm install -g lighthouse

# モバイルプリセット
npx lighthouse http://localhost:3000 \
  --output=json \
  --output-path=./lighthouse-mobile.json \
  --preset=perf \
  --chrome-flags="--headless --no-sandbox" \
  --only-categories=performance,accessibility,best-practices,seo

# デスクトッププリセット
npx lighthouse http://localhost:3000 \
  --output=json \
  --output-path=./lighthouse-desktop.json \
  --preset=desktop \
  --chrome-flags="--headless --no-sandbox" \
  --only-categories=performance,accessibility,best-practices,seo
```

### axe-core（Playwright統合）

```python
from playwright.sync_api import sync_playwright
import json, subprocess

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto('http://localhost:3000')
    page.wait_for_load_state('networkidle')

    # axe-core を inject して実行
    axe_script = subprocess.run(
        ['node', '-e', 'console.log(require("axe-core").source)'],
        capture_output=True, text=True
    ).stdout
    page.evaluate(axe_script)
    results = page.evaluate('axe.run()')

    violations = results.get('violations', [])
    for v in violations:
        print(f"[{v['impact']}] {v['id']}: {v['description']} ({len(v['nodes'])} nodes)")

    browser.close()
```

---

## 出力フォーマット

```markdown
# 📊 UX Performance Audit Score Card

**Project**: [プロジェクト名]
**URL**: [テスト対象URL]
**Date**: [日時]
**Grade**: [S/A/B/C/D]

## Lighthouse Scores
| Category | Score | Grade |
|----------|-------|-------|
| Performance | 87 | A |
| Accessibility | 92 | A |
| Best Practices | 95 | S |
| SEO | 89 | A |

## Core Web Vitals
| Metric | Value | Status |
|--------|-------|--------|
| LCP | 1.8s | 🟢 Good |
| INP | 150ms | 🟢 Good |
| CLS | 0.05 | 🟢 Good |

## Accessibility Violations (axe-core)
| Severity | Count | Details |
|----------|-------|---------|
| 🔴 critical | 0 | — |
| 🟡 warning | 2 | color-contrast (1), label (1) |
| 🔵 info | 1 | heading-order |

## Improvement Priorities
1. 🔴 [最もインパクトの大きい改善] (impact: +X)
2. 🟡 [次に重要な改善] (impact: +X)

## Responsive Check
| Viewport | Status |
|----------|--------|
| Mobile (375px) | ✅ |
| Tablet (768px) | ✅ |
| Desktop (1440px) | ✅ |
```

---

## ベストプラクティス

- **モバイルファースト**: Lighthouse のデフォルトはモバイルプリセット。まずモバイルで合格を目指す
- **ボトルネック方式**: 4カテゴリのうち最低の1つが総合グレードを決定する。全体の底上げが必要
- **Accessibility は妥協しない**: Grade B (85) 以上を必須ラインとする
- Performance の数値は初回ロードで測定。キャッシュ済みでのスコアに騙されない
- axe-core の `critical` + `serious` は FBL の Self-Repair 対象に含める

---

## Toolchain

**Scripts**: None
**Knowledge**: None
**Related WF**: None
