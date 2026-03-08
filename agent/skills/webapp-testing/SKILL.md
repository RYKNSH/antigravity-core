---
name: webapp-testing
description: Playwrightを使用したWebアプリのテスト・デバッグ・スクリーンショットキャプチャのツールキット
source: anthropics/skills (公式)
---

# Web Application Testing

Playwrightでローカルwebアプリをテスト。

## アプローチ決定ツリー

```
ユーザータスク → 静的HTML?
    ├─ Yes → HTMLを直接読んでセレクタ特定 → Playwrightスクリプト
    └─ No (動的アプリ) → サーバー起動済み?
        ├─ No → with_server.py を使用
        └─ Yes → Reconnaissance-then-action:
            1. networkidle待機
            2. スクリーンショット or DOM検査
            3. セレクタ特定
            4. アクション実行
```

## パターン

**サーバー管理付き:**
```bash
python scripts/with_server.py --server "npm run dev" --port 5173 -- python your_automation.py
```

**Playwrightスクリプト:**
```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto('http://localhost:5173')
    page.wait_for_load_state('networkidle')  # CRITICAL
    # ... automation logic
    browser.close()
```

## ベストプラクティス

- `sync_playwright()` を使用
- 必ずブラウザをcloseする
- セレクタ: `text=`, `role=`, CSS, ID
- 動的アプリでは `networkidle` 待機必須

---

## Toolchain

**Scripts**: None
**Knowledge**: None
**Related WF**: None
