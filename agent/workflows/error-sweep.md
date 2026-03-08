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
3. **`~/.antigravity/knowledge/debug_patterns/`**（グローバル）を検索

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

---

> **詳細チェックリスト**: [error-sweep-checks.md](file:////Users/ryotarokonishi/.antigravity/docs/wf-reference/error-sweep-checks.md)

---

## Toolchain

**Skills**: `code-review`
**Knowledge**: `debug_patterns`
