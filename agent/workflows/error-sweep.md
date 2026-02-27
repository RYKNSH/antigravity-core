---
description: どんな小さなエラーも見逃さない徹底的なエラーチェック＆デバッグWF。テスト通過≠品質OKの前提で、コード自体を顕微鏡で調べる唯一のWF。
---

# /error-sweep - World-Class Deep Error Check

> [!IMPORTANT]
> **哲学**: 「テストが通る」「ビルドが通る」は品質の最低条件に過ぎない。
> このWFは、テストでは捕捉できない**実装の食い違い**を顕微鏡レベルで検出し、
> どんな小さなエラーも見逃さず、軽視せず、確実に潰す。
>
> **世界最高基準**: OWASP, WCAG 2.1, Google Engineering Practices, NASA JPL Coding Standards
> から抽出したチェック基準を**毎回の実行で自動更新**する Living Standards Engine を搭載。

## Cross-Reference

```
/verify Phase 2.5 → /error-sweep quick（Phase 0 + 1 + 6 のみ）
/verify --deep Phase 2.5 → /error-sweep（全Phase実行）
/fbl deep Phase 5.5 → /error-sweep
/work "エラーチェック" → /error-sweep（直接呼出し）
/error-sweep Self-Repair 5回失敗 → /debug-deep（自動エスカレーション）
/error-sweep Phase 9 → .sweep_patterns.md に原則を蓄積（Self-Repair 2回以上時）
/error-sweep Phase 9 → .sweep_standards.md にグローバル基準を蓄積
```

---

## バリエーション

| コマンド | 動作 | 用途 |
|---------|------|------|
| `/error-sweep` | フル実行（全Phase 0-9） | 実装完了後の徹底チェック |
| `/error-sweep quick` | Phase 0 + 1 + 8 のみ | `/verify` 通常時の組み込み |
| `/error-sweep --changed-only` | 変更ファイルのみ対象 | 個別修正後の差分チェック |

---

## Sweep チーム（Specialist Personas）

| ペルソナ | 担当Phase | 専門 |
|---------|-----------|------|
| 🌐 **Living Standards** | Phase 0 | 最新基準の動的取得・キャッシュ・淘汰 |
| 🔬 **Static Analyzer** | Phase 1 | 型安全性、未使用コード、strictモード |
| 🕸️ **Dependency Auditor** | Phase 2 | フロント-バック間契約、依存関係 |
| 🛡️ **Security Sentinel** | Phase 3 | OWASP Top 10、脆弱性、秘密情報漏洩 |
| 🔥 **Runtime Sentinel** | Phase 4 | 実行時エラー、console出力、例外処理 |
| 🧩 **Logic Consistency** | Phase 5 | 分岐網羅、エッジケース、null安全性 |
| 📐 **Contract Verifier** | Phase 6 | API型契約、DB-ORM型一致 |
| ⚡ **Performance Prober** | Phase 7 | N+1、メモリリーク、バンドル、ボトルネック |
| 🔗 **Integration & A11y** | Phase 7.5 | API疎通、WCAG準拠、セマンティックHTML |

---

## Severity 分類

全ての発見は以下の3段階で分類する:

| Severity | 定義 | 扱い |
|----------|------|------|
| 🔴 **critical** | 実行時エラー、データ破壊、セキュリティ脆弱性 | **必ず修正**。0件でなければ完了しない |
| 🟡 **warning** | 潜在バグ、型の曖昧さ、非最適なパターン | 修正推奨。3件以上は判断要求 |
| 🔵 **info** | コード品質改善提案、ベストプラクティス逸脱 | 記録のみ。余裕があれば対応 |

---

## 検証フェーズ

### Phase 0: Living Standards Engine 🌐
**担当**: Living Standards
**目的**: 世界最高基準のチェックルールを**毎回の実行で**最新化する

> [!IMPORTANT]
> **Self-Evolving Design**: このPhaseにより `/error-sweep` のチェック基準は
> ハードコードではなく**動的に進化**する。過去の学習 + 外部最新知見 + 淘汰機構。

#### Step 0-0: 過去パターン参照（学習ループの入口）

チェック開始前に、過去の学習データを読み込む:

1. **`.sweep_patterns.md`**（プロジェクト単位）が存在すれば読む
2. **`.debug_learnings.md`**（プロジェクト単位）が存在すれば読む — `/debug-deep` の学習も検出に活かす（**クロスポリネーション**）
3. **`SSD/.antigravity/knowledge/debug_patterns/`**（グローバル）を検索

**Priority Score による重点チェック**:
- `Priority = 発見頻度 × ヒット率`
- **上位10原則のみ重点チェック**。残りは辞書的に保持（検出時に参照）
- `deprecated` ステータスの原則はスキップ

#### Step 0-1: 外部ベストプラクティスの動的取得（最新基準同期）

プロジェクトの技術スタックを検出し、該当する最新基準をロードする:

```markdown
1. **技術スタック自動検出**:
   - package.json → フレームワーク (Next.js, React, Vue, etc.)
   - tsconfig.json → TypeScript 設定
   - prisma/drizzle/supabase → ORM/DB層
   - Dockerfile / railway.toml → インフラ層

2. **キャッシュ確認** (`~/.antigravity/knowledge/global_standards/`):
   - 24h以内のキャッシュ → そのまま使用
   - 24h超過 → 再取得

3. **動的ルール取得**（キャッシュ期限切れ時）:
   - Web検索: "[フレームワーク名] security best practices [年]"
   - Web検索: "[フレームワーク名] common vulnerabilities"
   - Web検索: "OWASP Top 10 [年] checklist"
   - npm/pnpm audit結果を解析
   - 取得結果を `~/.antigravity/knowledge/global_standards/` にキャッシュ

4. **`.sweep_standards.md`** にマージ:
   - 既存ルールと重複→スキップ
   - 新規ルール→追加（`source: [取得元URL]`, `fetched: [日時]`）
   - 陳腐化ルール→`deprecated`
```

#### Step 0-2: ルールセット統合

全ソースからのチェックルールを統合し、優先順位付き実行リストを生成:

```markdown
Execution Rules = (
  .sweep_patterns.md 上位10原則        # プロジェクト学習
  + .debug_learnings.md パターン       # デバッグ学習
  + .sweep_standards.md アクティブルール # 外部基準
  + Built-in Phase 1-7.5 チェックリスト # 内蔵ルール
)
→ 重複排除 → Priority Score順にソート
```

> これが強化学習ループの「入口」。出口は Phase 9。

---

### Phase 1: Static Analysis 🔬
**担当**: Static Analyzer
**目的**: コンパイラ/リンターが見逃す型の穴と未使用コードを検出

#### チェックリスト
```markdown
- [ ] tsconfig.json の `strict: true` が有効か
- [ ] `any` 型の使用箇所を全列挙（正当な理由がないものは排除）
- [ ] `as` 型アサーションの使用箇所を全列挙（不要なキャストを排除）
- [ ] `@ts-ignore` / `@ts-expect-error` の使用箇所を全列挙
- [ ] 未使用の import / 変数 / 関数 / export を検出
- [ ] デッドコード（到達不能コード）を検出
- [ ] `eslint-disable` コメントの使用と正当性を確認
- [ ] 型の `never` 到達パス検証（exhaustive check）
- [ ] Generic 型制約の適切さ（過度な `extends any` 等）
```

#### 実行
```bash
# TypeScript strict チェック
npx tsc --noEmit --strict 2>&1 | head -100

# 未使用import/変数の検出
grep -rn "// @ts-ignore\|// @ts-expect-error\|eslint-disable" --include="*.ts" --include="*.tsx" src/
```

**コード内検索**:
```bash
# any型の使用箇所
grep -rn ": any\|as any\|<any>" --include="*.ts" --include="*.tsx" src/

# 型アサーションの使用箇所
grep -rn " as [A-Z]" --include="*.ts" --include="*.tsx" src/

# never到達チェック（default caseなしのswitch）
grep -rn "switch\s*(" --include="*.ts" --include="*.tsx" src/
```

---

### Phase 2: Dependency Audit 🕸️
**担当**: Dependency Auditor
**目的**: フロントエンド-バックエンド間の型/API契約の一致を検証

#### チェックリスト
```markdown
- [ ] APIエンドポイント定義（バック） vs API呼び出し（フロント）のパス一致
- [ ] リクエストbody型（バック期待） vs リクエストbody型（フロント送信）の一致
- [ ] レスポンス型（バック送信） vs レスポンス型（フロント期待）の一致
- [ ] 環境変数の参照（コード内） vs 定義（.env / .env.example）の一致
- [ ] package.json の dependencies vs 実際の import の一致
- [ ] import循環の検出
- [ ] peerDependencies の互換性確認
- [ ] ロックファイル (pnpm-lock.yaml / package-lock.json) とpackage.jsonの整合性
```

#### 実行
```bash
# 環境変数の参照 vs 定義
grep -rn "process.env\.\|import.meta.env\." --include="*.ts" --include="*.tsx" --include="*.js" src/ | \
  sed 's/.*\(process\.env\.[A-Z_]*\|import\.meta\.env\.[A-Z_]*\).*/\1/' | sort -u

# .env と .env.example の差分
diff <(grep -v '^#' .env | grep '=' | cut -d= -f1 | sort) \
     <(grep -v '^#' .env.example | grep '=' | cut -d= -f1 | sort) 2>/dev/null || echo "(.env or .env.example not found)"

# 依存パッケージの脆弱性チェック
pnpm audit 2>/dev/null || npm audit 2>/dev/null || echo "(audit not available)"
```

**コード分析（手動）**:
- APIルート定義ファイルを読み、全エンドポイントのパスとリクエスト/レスポンス型を列挙
- フロントのAPI呼び出しコードと照合
- 不一致があれば `critical` として記録

---

### Phase 3: Security Deep Scan 🛡️
**担当**: Security Sentinel
**目的**: OWASP Top 10 + CWE 準拠のセキュリティ脆弱性を網羅的に検出

> [!CAUTION]
> セキュリティissueは全て `critical` として扱う。例外なし。

#### OWASP Top 10 チェックリスト
```markdown
- [ ] **A01:2021 – Broken Access Control**
  - 認可チェックの欠落（エンドポイント単位で確認）
  - CORS設定の過度な許可（`*` 使用）
  - ディレクトリトラバーサルの可能性
  - IDORリスク（ユーザーIDの直接参照）

- [ ] **A02:2021 – Cryptographic Failures**
  - 平文での機密データ送信（HTTP強制リダイレクトの有無）
  - 弱いハッシュアルゴリズム（MD5, SHA1）の使用
  - ハードコードされた暗号鍵

- [ ] **A03:2021 – Injection**
  - SQLインジェクション（パラメータ化されていないクエリ）
  - XSS（ユーザー入力の未エスケープ出力）
  - コマンドインジェクション（`exec`, `spawn` への未サニタイズ入力）
  - `eval()` / `Function()` の使用

- [ ] **A04:2021 – Insecure Design**
  - レート制限の不在（認証エンドポイント）
  - ブルートフォース対策の不在
  - 設計レベルの脅威モデリング不足

- [ ] **A05:2021 – Security Misconfiguration**
  - デバッグモードが本番で有効
  - デフォルトクレデンシャルの残存
  - 不要なHTTPメソッドの許可
  - セキュリティヘッダーの欠如（CSP, X-Frame-Options, etc.）

- [ ] **A07:2021 – Identification and Authentication Failures**
  - セッション固定攻撃の可能性
  - JWTの不適切な検証（alg: none, 弱い秘密鍵）
  - パスワードポリシーの不在

- [ ] **A08:2021 – Software and Data Integrity Failures**
  - 依存パッケージの整合性検証（lockfile）
  - CI/CDパイプラインの改ざんリスク

- [ ] **A09:2021 – Security Logging and Monitoring Failures**
  - 認証失敗のログ記録不在
  - 機密データのログ出力（パスワード、トークン）
```

#### 秘密情報スキャン
```bash
# ハードコードされた秘密情報の検出
grep -rn "sk_live\|sk_test\|AKIA\|password\s*=\s*['\"]" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.env*" .
grep -rn "Bearer [a-zA-Z0-9_-]\{20,\}" --include="*.ts" --include="*.tsx" --include="*.js" .
grep -rn "-----BEGIN.*PRIVATE KEY-----" --include="*.ts" --include="*.js" --include="*.pem" .

# .gitignore に .env が含まれているか
grep -q "\.env" .gitignore 2>/dev/null || echo "⚠️ .env not in .gitignore"

# セキュリティヘッダーの設定確認
grep -rn "helmet\|Content-Security-Policy\|X-Frame-Options\|Strict-Transport-Security" --include="*.ts" --include="*.tsx" --include="*.js" .
```

#### 認証フロー検証（手動）
- 全認証エンドポイントのフローを追跡
- セッション管理の一貫性を確認
- ミドルウェアの適用範囲を確認（保護漏れがないか）

---

### Phase 4: Runtime Sentinel 🔥
**担当**: Runtime Sentinel
**目的**: テストで捕捉されない実行時エラーを事前検出

#### チェックリスト
```markdown
- [ ] try/catch で握り潰されているエラー（空catch）を検出
- [ ] Promiseの `.catch()` 漏れ / unhandled rejection パターンを検出
- [ ] async関数で await 漏れ（fire-and-forget）を検出
- [ ] console.error / console.warn の意図的使用 vs 忘れ残しを判定
- [ ] throw されうるがcatchされない例外パスを特定
- [ ] setTimeout/setInterval のクリーンアップ漏れを検出
- [ ] グローバルエラーハンドラの存在確認（process.on('uncaughtException') 等）
- [ ] Graceful Shutdown の実装確認（SIGTERM/SIGINT ハンドリング）
```

#### 実行
```bash
# 空catchの検出
grep -rn "catch.*{" --include="*.ts" --include="*.tsx" -A1 src/ | grep -B1 "^--$\|^\s*}$"

# console残留の検出
grep -rn "console\.\(log\|error\|warn\|debug\)" --include="*.ts" --include="*.tsx" src/

# fire-and-forget asyncの検出
grep -rn "^\s*[a-zA-Z]*(" --include="*.ts" --include="*.tsx" src/ | grep -v "await\|return\|const\|let\|var"

# グローバルエラーハンドラの確認
grep -rn "uncaughtException\|unhandledRejection\|process\.on\|window\.onerror\|addEventListener.*error" --include="*.ts" --include="*.tsx" --include="*.js" .
```

**ブラウザ検証**（フロントエンドプロジェクト時）:
- ブラウザでページを開き、DevToolsのConsoleタブを確認
- 赤/黄色のコンソール出力を全て記録
- Network タブで 4xx/5xx レスポンスを確認

---

### Phase 5: Logic Consistency 🧩
**担当**: Logic Consistency
**目的**: 分岐ロジックの網羅性とエッジケースのカバーを検証

#### チェックリスト
```markdown
- [ ] if/else if チェーンに else（デフォルトケース）があるか
- [ ] switch文に default ケースがあるか
- [ ] null/undefinedチェック: オプショナルチェーン(`?.`)の一貫性
- [ ] 配列アクセス: 空配列への `[0]` アクセスがないか
- [ ] オブジェクトアクセス: 存在しないプロパティへのアクセスがないか
- [ ] 数値演算: ゼロ除算、NaN 伝播のリスクがないか
- [ ] 文字列処理: 空文字列の扱いが正しいか
- [ ] Date処理: タイムゾーン考慮が必要な箇所で正しく処理しているか
- [ ] 非同期処理: レースコンディションのリスクがないか
- [ ] 境界値: 配列の最初/最後、数値の最大/最小、文字列の空/最大長
- [ ] 状態遷移: 複数のstate変更が競合しないか（特にReact useState）
```

**コード分析（手動）**:
- 変更されたファイルの全関数を読み、上記チェックリストに照らす
- **1関数ずつ丁寧に読む。スキップ禁止。**
- 発見した問題は severity を付けて記録

---

### Phase 6: Contract Verification 📐
**担当**: Contract Verifier
**目的**: データ層の型契約が全層で一貫していることを検証

#### チェックリスト
```markdown
- [ ] DB schema（マイグレーション/SQL）の各カラム型 vs ORM型定義の一致
- [ ] ORM型定義 vs APIレスポンス型の一致
- [ ] APIレスポンス型 vs フロントState型の一致
- [ ] フロントState型 vs UIコンポーネントProps型の一致
- [ ] enum/union型が全層で同じ値セットか
- [ ] 日付型の扱い: string vs Date vs timestamp が層間で統一されているか
- [ ] nullable/optional の扱い: 全層で一貫しているか
- [ ] マイグレーション順序の整合性（依存関係のあるテーブルの作成順）
- [ ] インデックス設計の妥当性（クエリパターンに対するインデックス）
```

**実行手順**:
1. DB schema ファイルを読み、全テーブルのカラム名と型を列挙
2. ORM/モデル定義を読み、DB schemaとの一致を確認
3. API Handler を読み、レスポンス型を確認
4. フロントのfetch/API呼び出しを読み、期待型を確認
5. 不一致を `critical` として記録

---

### Phase 7: Performance Deep Scan ⚡
**担当**: Performance Prober
**目的**: パフォーマンスボトルネックとリソースリークを網羅的に検出

#### チェックリスト
```markdown
- [ ] **N+1クエリ検出**: ループ内でのDB呼び出し、`Promise.all` 未使用の直列await
- [ ] **メモリリーク**:
  - イベントリスナーの未解除（addEventListener without removeEventListener）
  - setInterval/setTimeout のクリアなし
  - 大量キャッシュの無制限蓄積（Map/Object の無制限grow）
  - クロージャによる不要な参照保持
- [ ] **バンドルサイズ影響**:
  - 巨大ライブラリの全量import（tree-shaking不可の形式）
  - 動的importの未使用（大きなコンポーネントの即時ロード）
  - 画像/フォントの未最適化アセット
- [ ] **非同期ボトルネック**:
  - 並列化可能だが直列実行されている await
  - 不要な `await` （同期処理の冗長await）
  - データベース接続プールの設定確認
- [ ] **レンダリングパフォーマンス**（フロントエンド時）:
  - 不要な再レンダリング（React: useMemo/useCallback の欠如）
  - リスト描画でのkey未指定
  - 仮想スクロール未使用の大量リスト
```

#### 実行
```bash
# N+1パターンの検出（ループ内await）
grep -rn "for.*{" --include="*.ts" --include="*.tsx" -A5 src/ | grep "await"

# メモリリークパターン
grep -rn "addEventListener\|setInterval\|setTimeout" --include="*.ts" --include="*.tsx" src/

# 巨大依存の検出
grep -rn "import .* from ['\"]lodash['\"]" --include="*.ts" --include="*.tsx" src/
grep -rn "import .* from ['\"]moment['\"]" --include="*.ts" --include="*.tsx" src/

# React再レンダリングリスク
grep -rn "useEffect\s*(" --include="*.tsx" src/ | grep -v "\[\]"
```

---

### Phase 7.5: Integration & Accessibility 🔗♿
**担当**: Integration & A11y
**目的**: 実際のAPI疎通 + WCAG 2.1 AA準拠を検証

> [!NOTE]
> API疎通: 開発サーバーが稼働中の場合のみ実行。稼働していない場合はスキップし、Phase 8 で「未検証」として記録。
> A11y: フロントエンドプロジェクトの場合のみ実行。

#### Integration チェック
```bash
# ヘルスチェック
curl -s http://localhost:3000/api/health 2>/dev/null | head -50

# 主要エンドポイントのレスポンス構造確認
# (プロジェクトに応じてエンドポイントを変更)
curl -s http://localhost:3000/api/[endpoint] | python3 -m json.tool 2>/dev/null | head -30
```

**ブラウザ検証**:
- ブラウザで主要画面を開き、Network タブで全リクエストを確認
- レスポンスJSON のキー名・型が期待と一致するか確認
- CORSエラー、Mixed Content警告がないか確認

#### Accessibility チェックリスト (WCAG 2.1 AA)
```markdown
- [ ] **セマンティックHTML**: 適切な `<header>`, `<nav>`, `<main>`, `<footer>`, `<section>`, `<article>` 使用
- [ ] **見出し階層**: h1→h2→h3 の正しい順序（h1ジャンプなし）
- [ ] **画像alt属性**: 全 `<img>` に意味のある `alt` テキスト
- [ ] **フォームラベル**: 全入力要素に `<label>` or `aria-label`
- [ ] **キーボードナビゲーション**: Tab/Enter/Escで全操作可能か
- [ ] **フォーカス管理**: フォーカスインジケータの可視性
- [ ] **カラーコントラスト**: テキスト 4.5:1以上、大テキスト 3:1以上
- [ ] **aria属性**: 動的コンテンツに適切な `aria-live`, `role` 設定
- [ ] **レスポンシブ**: 200%ズームでコンテンツ切れなし
- [ ] **動的コンテンツ**: モーダル/ドロワーのフォーカストラップ
```

#### 実行
```bash
# セマンティックHTML検証
grep -rn "<div" --include="*.tsx" --include="*.html" src/ | wc -l
grep -rn "<main\|<nav\|<header\|<footer\|<section\|<article" --include="*.tsx" --include="*.html" src/ | wc -l

# alt属性の欠如
grep -rn "<img" --include="*.tsx" --include="*.html" src/ | grep -v "alt="

# ラベルの欠如
grep -rn "<input\|<select\|<textarea" --include="*.tsx" --include="*.html" src/ | grep -v "aria-label\|<label"
```

---

### Phase 8: World-Class Score Card 📋
**担当**: Moderator（AI自身）
**目的**: 全発見事項を集約し、10カテゴリの定量スコアで世界最高基準を測定

#### 10-Category World-Class Score Card

| # | カテゴリ | 担当Phase | 基準 | スコア (0-10) |
|---|---------|-----------|------|--------------|
| 1 | **型安全性** | Phase 1 | any/assertion/ignore = 0, strict全有効 | __/10 |
| 2 | **依存関係整合性** | Phase 2 | API契約一致, 環境変数一致, 循環なし | __/10 |
| 3 | **セキュリティ** | Phase 3 | OWASP Top 10 準拠, 秘密情報漏洩0 | __/10 |
| 4 | **実行時安全性** | Phase 4 | 空catch0, await漏れ0, ハンドラ完備 | __/10 |
| 5 | **ロジック網羅性** | Phase 5 | 全分岐デフォルトあり, エッジケース処理 | __/10 |
| 6 | **契約一貫性** | Phase 6 | DB→ORM→API→State→Props 全層一致 | __/10 |
| 7 | **パフォーマンス** | Phase 7 | N+1=0, メモリリーク0, 最適import | __/10 |
| 8 | **アクセシビリティ** | Phase 7.5 | WCAG 2.1 AA準拠, a11yエラー0 | __/10 |
| 9 | **統合正当性** | Phase 7.5 | API疎通OK, CORS/Mixed Content 0 | __/10 |
| 10 | **学習蓄積度** | Phase 0,9 | パターン蓄積あり, ヒット率高, 淘汰実施 | __/10 |

#### 合計スコアとグレード

| Grade | スコア | 意味 |
|-------|-------|------|
| 🏆 **S** | 95-100 | World-Class — 世界最高水準 |
| 🟢 **A** | 85-94 | Excellent — 高品質 |
| 🔵 **B** | 70-84 | Good — 実用品質 |
| 🟡 **C** | 50-69 | Acceptable — 改善余地あり |
| 🔴 **D** | 0-49 | Poor — 要大幅改善 |

#### 出力フォーマット
```markdown
# 🔬 World-Class Error Sweep Report

## Score Card
| # | カテゴリ | スコア | 主要Issue |
|---|---------|-------|----------|
| 1 | 型安全性 | 9/10 | as アサーション2件 |
| 2 | 依存関係整合性 | 10/10 | — |
| ... | ... | ... | ... |
| **Total** | | **87/100** | **Grade: A** |

## Summary
| Severity | Count | Auto-Fixed | Remaining |
|----------|-------|------------|-----------|
| 🔴 critical | X | Y | Z |
| 🟡 warning | X | Y | Z |
| 🔵 info | X | Y | Z |

## 🔴 Critical Issues
1. [ファイル:行] 問題の説明 → 修正内容
2. ...

## 🟡 Warnings
1. [ファイル:行] 問題の説明 → 修正内容 or 保留理由
2. ...

## 🔵 Info
1. [改善提案]
2. ...

## Auto-Fix Log
- [修正1]: ファイル → 変更内容
- [修正2]: ファイル → 変更内容

## Verdict
- [🏆 WORLD-CLASS / 🟢 CLEAN / 🟡 CONDITIONAL PASS / 🔴 BLOCKED]
```

#### 判定基準

| Verdict | 条件 |
|---------|------|
| 🏆 **WORLD-CLASS** | critical = 0, warning = 0, Score ≥ 95 |
| 🟢 **CLEAN** | critical = 0, warning ≤ 2, Score ≥ 70 |
| 🟡 **CONDITIONAL PASS** | critical = 0, warning ≥ 3（手動判断要求） |
| 🔴 **BLOCKED** | critical ≥ 1（修正必須） |

---

## Self-Repair Loop

Phase 8 で `BLOCKED` 判定の場合、以下のループを実行:

```
発見 → 分析 → 修正 → Phase 1-7.5 再実行 → 再判定
```

**セーフティ機構**:
- ループ: **プログレッシブ拡張**（3回→/debug-deep→5回→First Principles→5回 = 最大13回）
- タイムアウト: **進捗なし10分 → /debug-deep エスカレーション**（進捗あれば無制限）
- **各修正前に git checkpoint を作成**:
  ```bash
  git add -A && git commit -m "error-sweep: checkpoint before fix N"
  ```
- 5回失敗 → **`/debug-deep` に自動エスカレーション**（checkpointからロールバック可能）

**監査ログ**:
```bash
echo "[$(date)] Sweep Fix: $ISSUE → $FIX" >> error_sweep_audit.log
```

---

### Phase 9: Reinforcement Learning + Standards Evolution 🧠

**発動条件**: Self-Repair が **2回以上**発動した場合のみ
**目的**: 具体的な失敗を**抽象的な原則**に昇華し、次回以降の検出精度を向上させる。
同時に、世界最高基準のチェックルール自体を進化させる。

> [!IMPORTANT]
> 失敗の具象記録は audit log に残す。ここでやるのは**抽象化** + **基準進化**。

### 9-1. 具象→抽象の昇華プロセス

修正した全issueを振り返り、以下の3問で抽象化:

```markdown
1. **パターン化**: この失敗は他のどんな場面でも起き得るか？
   → Yes → 原則として記録
   → No → Evidence（事例）としてのみ記録

2. **根因分類**: なぜこのパターンが見逃されたか？
   - [ ] 型システムの限界（TSが検出できない）
   - [ ] 規約の不在（ルールがなかった）
   - [ ] 人的見落とし（知っていたが忘れた）
   - [ ] 設計の不整合（そもそも構造が矛盾）
   - [ ] セキュリティ知識の不足（OWASP等を知らなかった）
   - [ ] パフォーマンス知識の不足（ボトルネック検出パターン未知）

3. **原則化**: 一文で防止ルールを書けるか？
   → 書けたら Principle として記録
```

### 9-2. プロジェクト単位: `.sweep_patterns.md`

プロジェクトルートに追記（2層構造）:

```markdown
## Principles（抽象化された原則）

### P-001: async データ操作は常に await を強制する
- **根因**: 型システムの限界（Promise<void> 返却関数の呼び捨て検出不可）
- **適用スコープ**: TypeScript, async/await
- **発見頻度**: 3回
- **ヒット率**: 2/3 (67%)
- **ステータス**: active
- **初出**: 2026-02-11 /error-sweep
- **Evidence**: jobs.py:42, api/users.ts:89, hooks/useData.ts:15
```

#### Principle フィールド定義

| フィールド | 必須 | 説明 |
|---------|------|------|
| **根因** | ○ | 型システムの限界 / 規約の不在 / 人的見落とし / 設計の不整合 / セキュリティ知識不足 / パフォーマンス知識不足 |
| **適用スコープ** | ○ | どの言語/フレームワーク/技術に適用されるか |
| **発見頻度** | ○ | このPrincipleに該当するエラーが検出された総回数 |
| **ヒット率** | ○ | Phase 0でチェック対象にした回数中、実際に検出に貢献した回数 |
| **ステータス** | ○ | `active` / `deprecated` / `merged` |
| **初出** | ○ | 初めて発見された日付とWF |
| **Evidence** | ○ | 具体的なファイル:行 |

#### 淘汰メカニズム

原則は**無限に蓄積しない**。以下の条件で淘汰:

| 条件 | アクション |
|------|----------|
| `ヒット率 < 20%` かつ `参照回数 > 5` | → `deprecated` 候補としてマーク |
| `deprecated` かつ `発見頻度 = 0`（その後の発見なし） | → アーカイブセクションに移動 |
| 2つの Principle が実質同じ | → `merged`（統合） |

**ルール**:
- 同じパターンが既存 Principle に該当 → **Evidence 追記** + **発見頻度++**
- Phase 0 で参照したが検出 0 → **ヒット率の分母のみ++**
- Phase 0 で参照し検出あり → **ヒット率の分子も++**
- 新パターン → **新規 Principle 追加**（`P-XXX` 連番）

### 9-3. Standards Evolution: `.sweep_standards.md`

Phase 0 で取得した外部基準をプロジェクトに永続化:

```markdown
## Standards（外部基準ルール）

### S-001: CSP header must be set in production
- **ソース**: OWASP Security Headers Guide 2025
- **カテゴリ**: Security
- **取得日**: 2026-02-27
- **ステータス**: active
- **TTL**: 90日（90日後に再検証）
- **適用結果**: 3回検出、2回auto-fix
```

#### Standards 淘汰メカニズム

| 条件 | アクション |
|------|----------|
| TTL超過 + 再Web検索で該当基準が廃止 | → `deprecated` |
| 新しいバージョンの基準が公開 | → 旧バージョンを `deprecated` + 新規追加 |
| 技術スタック変更で不適用に | → `inactive` |

### 9-4. グローバル: `knowledge/debug_patterns/`

Principle が**プロジェクト固有でない場合**（言語/フレームワーク共通のパターン）、グローバルにも保存:

```
SSD/.antigravity/knowledge/debug_patterns/
├── typescript_async_await_enforcement.md
├── fullstack_date_type_unification.md
├── owasp_csp_header_requirement.md
└── INDEX.md
```

> `/debug-deep` Step 6-2 と同じ保存先。`/error-sweep` と `/debug-deep` の学習が**同じナレッジプールに蓄積**される。

### 9-5. 即時反映

学習記録は保存と同時にエージェントの知識として即時反映される:
- **同一セッション内**: Phase 9 で記録した原則は即座にコンテキストに残る。`.session_state` にも反映
- **次回セッション**: `/checkin` で `.sweep_patterns.md` + `.sweep_standards.md` を自動読み込み
- **他プロジェクト**: グローバル `debug_patterns/` を Phase 0 で自動検索

### 9-6. 学習ループの完成

```
Phase 0 (入口): .sweep_patterns.md + .debug_learnings.md + .sweep_standards.md + Web検索
     │            Priority Score で上位10原則を重点チェック + 最新外部基準を動的ロード
     ↓
Phase 1-7.5: 検出（重点原則 + 外部基準に従って精度向上）
     ↓
Phase 8: World-Class Score Card + 修正 + Self-Repair
     ↓
Phase 9 (出口): 具象→抽象 → .sweep_patterns.md 追記
     │            + .sweep_standards.md 更新 + ヒット率更新 + 淘汰判定
     ↓
次回 Phase 0 で自動参照 → 検出精度向上 + 不要原則/陳腐化基準の淘汰
```

**これにより「失敗が原則になり、原則が検出を強化し、不要な原則が自然淘汰される」
+ 「外部基準が自動取得され、進化し続ける」ダブル進化学習ループが成立する。**

---

## `/error-sweep quick` フロー

高速版。`/verify` 通常時に組み込む。

1. **Phase 0**: Living Standards Engine（Step 0-0 過去パターン参照 のみ。Web検索スキップ）
2. **Phase 1**: Static Analysis（any/ts-ignore/eslint-disable検出。tsc再実行はスキップ）
3. **Phase 8**: Score Card（軽量版 — Phase 1 スコアのみ記録）

> Phase 9（学習）は quick では実行しない（Self-Repair 非発動のため）。

所要時間目安: 3-5分

---

## 発動条件まとめ

| トリガー | 発動元 | モード |
|---------|--------|--------|
| `/verify` Phase 2.5 | 自動（通常時） | `quick` |
| `/verify --deep` Phase 2.5 | 自動 | `full` |
| `/fbl deep` Phase 5.5 | 自動 | `full` |
| `/work "エラーチェック"` | 手動 | `full` |
| 直接呼出し `/error-sweep` | 手動 | `full` |

---

## 注意事項

> [!IMPORTANT]
> **Zero Tolerance**: このWFは「まあ大丈夫でしょう」を許さない。
> `warning` であっても記録し、3件以上蓄積したら対処を要求する。
> 小さなエラーの蓄積が致命的バグの温床であるという前提で動く。

> [!CAUTION]
> **自動実行禁止の操作**:
> - データベースマイグレーション
> - package.json の依存変更
> - tsconfig.json の設定変更（ユーザー確認必須）
> - .env ファイルの変更
