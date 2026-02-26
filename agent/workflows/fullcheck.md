---
description: 全30レイヤー × 130+チェックポイントの完全品質チェック。Tier 1-6 全稼働。
---

# /fullcheck - 世界最高水準フルチェック

> [!IMPORTANT]
> Tier 1-6 **全30レイヤー**を網羅する最も厳格なチェック。
> `QUALITY_SCOPE_CHECKLIST.md` の全項目を実行する唯一のコマンド。

## Cross-Reference

```
/fullcheck → /verify --deep + Tier 4-6 追加チェック
/ship --fullcheck → /fullcheck を ship 前に実行
「フルチェック」「完全チェック」「全スコープ」 → /fullcheck（自動トリガー）
```

---

## 使用方法

```bash
/fullcheck              # 全30レイヤー実行
/fullcheck --tier 1-4   # Tier 1-4 のみ
```

---

## 実行フロー

### Phase 1: Tier 1-3（/verify --deep 相当）

`/verify --deep` を内部実行。これにより以下が自動実行される:
- Pre-Flight（lint + typecheck + test）
- `/fbl deep`
- `/error-sweep`（全Phase）
- `/test-evolve standard`
- `/debate quick`

---

### Phase 2: Tier 4 — 耐障害性スキャン

チェックリスト参照: `QUALITY_SCOPE_CHECKLIST.md` Layer 11-14

```bash
# L11: レジリエンス
rg 'fetch\(' --glob '*.ts' --glob '*.tsx' -l src/  # AbortController 有無確認
rg 'retry|backoff' --glob '*.ts' -l src/            # リトライロジック確認

# L12: 並行性
rg 'setInterval|setTimeout' --glob '*.tsx' -l       # cleanup 漏れ
rg 'useEffect' --glob '*.tsx' -l                     # cleanup return 確認

# L13: エッジケース — 手動コードレビュー
# null/空配列/超長文/絵文字/0件の処理を全コンポーネントで確認

# L14: 冪等性
rg 'upsert|ON CONFLICT' --glob '*.ts' --glob '*.sql' -l  # 二重実行防止
```

**コード分析**:
- 各fetch呼び出しにタイムアウト設定があるか
- useEffectにcleanup returnがあるか
- 全コンポーネントで空配列・null表示を確認
- トークン付与APIの二重実行防止を確認

---

### Phase 3: Tier 5 — 運用品質スキャン

チェックリスト参照: `QUALITY_SCOPE_CHECKLIST.md` Layer 15-20

```bash
# L15: レート制限
rg '429|rate.limit|too.many' --glob '*.ts' -l          # 429ハンドリング

# L16: タイムゾーン
rg 'new Date\(\)|Date\.now\(\)' --glob '*.ts' --glob '*.tsx' -l  # TZ安全性

# L17: パフォーマンス
rg 'for.*await|forEach.*await' --glob '*.ts' -l         # N+1クエリ候補

# L18: 可観測性
rg 'console\.(log|error|warn)' --glob '*.ts' -l src/    # ログ構造化確認

# L20: 依存関係
npm audit --production                                    # 脆弱性
npx depcheck 2>/dev/null | head -20                      # 未使用依存
```

---

### Phase 4: Tier 6 — 世界最高水準チェック

> [!NOTE]
> 自動化できる部分は自動化、残りは手動コードレビュー + 記録。

#### L21: カオスエンジニアリング（シミュレーション）
- [ ] 外部API（Discord/OpenAI）が返さない場合の振る舞いをコードで確認
- [ ] DB接続エラー時のフォールバックパスを確認
- [ ] 各fetchにタイムアウトが設定されているか

#### L22: コントラクトテスト
- [ ] bot → web API呼び出しのリクエスト/レスポンス型を照合
- [ ] DBスキーマとコード内の型定義を全カラム照合
- [ ] 環境変数の一覧を作成し、設定漏れを確認

#### L23: ミューテーションテスト
```bash
# Stryker が使える場合
npx stryker run 2>/dev/null || echo "Stryker not configured — manual review"
```
- [ ] テストがないロジックの列挙と記録

#### L24: プロパティベーステスト
- [ ] 主要な入力バリデーション関数にランダム入力でクラッシュしないか確認

#### L25: ビジュアルリグレッション
- [ ] 主要ページのスクリーンショットを取得（browser_subagent使用）
- [ ] 前回のスクリーンショットとの差分確認

#### L26: SRE
- [ ] SLO定義が存在するか確認
- [ ] インシデント対応手順（Runbook）が存在するか確認

#### L27: コスト監視
- [ ] OpenAI API の呼び出し頻度とコスト試算
- [ ] Supabase の行数・ストレージ使用量確認

#### L28: データライフサイクル
- [ ] ユーザーデータの保持ポリシー確認
- [ ] バックアップの存在確認

#### L29: ドキュメント
- [ ] README が最新か
- [ ] 複雑なロジックにコメントがあるか
- [ ] 環境構築手順が機能するか

#### L30: テスト戦略
- [ ] テストカバレッジの現状確認
- [ ] テストの独立性確認

---

## 出力フォーマット

```markdown
# 🏆 Full Check Report

## Summary
| Tier | Pass | Fail | Skip |
|------|------|------|------|
| 🔴 Tier 1: MUST | X/Y | Z | - |
| 🟡 Tier 2: SHOULD | X/Y | Z | - |
| 🟢 Tier 3: BETTER | X/Y | Z | - |
| 🔵 Tier 4: ROBUST | X/Y | Z | - |
| 🟣 Tier 5: PRODUCTION | X/Y | Z | - |
| ⚫ Tier 6: WORLD-CLASS | X/Y | Z | W |

## Verdict
[🏆 WORLD-CLASS / 🟢 PRODUCTION-READY / 🟡 NEEDS-WORK / 🔴 BLOCKED]

## Detailed Findings
[各Tier/Layerの詳細結果]

## Action Items
[優先度順の修正項目]
```

---

## Verdict 判定

| Verdict | 条件 |
|---------|------|
| 🏆 **WORLD-CLASS** | Tier 1-5 全 PASS + Tier 6 ≥ 80% |
| 🟢 **PRODUCTION-READY** | Tier 1-5 全 PASS |
| 🟡 **NEEDS-WORK** | Tier 1-3 PASS, Tier 4-5 に failure あり |
| 🔴 **BLOCKED** | Tier 1-3 に failure あり |

---

## 発動条件

| トリガー | 発動 |
|---------|------|
| `/fullcheck` | 手動 |
| `フルチェック` / `完全チェック` / `全スコープ` | 自動（Proactive Trigger） |
| `/ship --fullcheck` | ship前統合 |
