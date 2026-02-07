# 品質ゲート（Quality Gate）

> **すべての変更はこのゲートを通過すること。**
> 品質を犠牲にしたスピードは、最終的にスピードを殺す。

---

## 🚦 ゲート定義

### Gate 1: コミット前チェック（Pre-Commit）

```bash
# 以下がすべてパスすること
npm run lint          # リンターチェック
npm run typecheck     # 型チェック
npm run test:unit     # ユニットテスト
```

#### チェックリスト
- [ ] コードがリンターに通る
- [ ] TypeScriptの型エラーがない
- [ ] ユニットテストが全てパスする
- [ ] コミットメッセージが Conventional Commits に準拠

---

### Gate 2: プルリクエスト前チェック（Pre-PR）

```bash
npm run test              # 全テスト実行
npm run build             # 本番ビルド
```

#### チェックリスト
- [ ] Gate 1 をクリア
- [ ] 統合テストがパスする
- [ ] ビルドが成功する
- [ ] 新しい警告が増えていない
- [ ] ドキュメントが更新されている（必要な場合）

---

### Gate 3: マージ前チェック（Pre-Merge）

#### チェックリスト
- [ ] Gate 2 をクリア
- [ ] コードレビューが完了
- [ ] レビュアーの承認を取得
- [ ] CIパイプラインがすべてグリーン
- [ ] コンフリクトが解決済み

---

### Gate 4: デプロイ前チェック（Pre-Deploy）

```bash
npm run test:e2e          # E2Eテスト
npm run build:production  # 本番用ビルド
```

#### チェックリスト
- [ ] Gate 3 をクリア
- [ ] E2Eテストがパスする
- [ ] 本番用ビルドが成功する
- [ ] 環境変数が正しく設定されている
- [ ] ロールバック手順が準備されている

---

## 📏 品質基準

### コードカバレッジ

| レベル | カバレッジ | ステータス |
|--------|-----------|-----------|
| 最低限 | 60%       | ❌ ブロック |
| 推奨   | 80%       | ⚠️ 警告    |
| 理想   | 90%+      | ✅ 推奨    |

### パフォーマンス基準

| メトリクス | 基準値 | 計測方法 |
|-----------|--------|---------|
| First Contentful Paint | < 1.5s | Lighthouse |
| Time to Interactive | < 3.0s | Lighthouse |
| API Response Time (p95) | < 200ms | APM |

### アクセシビリティ基準

- Lighthouse Accessibility Score: 90+
- WCAG 2.1 AA準拠

---

## 🔧 自動化設定

### Pre-commit Hook（推奨設定）

```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged",
      "commit-msg": "commitlint -E HUSKY_GIT_PARAMS"
    }
  },
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md}": ["prettier --write"]
  }
}
```

### CI/CD パイプライン（GitHub Actions）

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  quality-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test
      - run: npm run build
```

---

## 📋 例外プロセス

時として品質ゲートを通過できない緊急修正が必要になることがあります。

### 例外を認める条件

1. **セキュリティ脆弱性の緊急パッチ**
2. **本番障害の復旧**
3. **法的要件への対応**

### 例外時の手順

1. 例外理由を `#exceptions` チャンネルに投稿
2. 2名以上の承認を取得
3. 修正をマージ
4. **72時間以内**に品質ゲートを満たすフォローアップPRを作成

> [!CAUTION]
> 例外は最後の手段です。例外が常態化している場合、
> プロセス自体を見直す必要があります。
