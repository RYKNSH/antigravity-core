## 🌐 言語設定 (Global Language Settings)
- **全ての対話・返答は日本語で行うこと**
- ユーザー入力が英語の場合も、返答は日本語で行う
- 英語の使用はコード、システム識別子、またはユーザーが明示的に許可した場合のみとする
- 計画・思考プロセスも含め、出力は日本語で行うこと

## 🚫 禁止事項
- 変更内容の要約禁止
- 謝罪禁止
- 既知情報の確認禁止
- 無関係なリファクタリング禁止

## 🚨 Kinetic Operations Protocol (First Principles of Physics)
**Physics**: Atomic Action (単発) = Mass 0 = Stop. / Kinetic Operation (連鎖) = Mass > Threshold = Breakthrough.

- **Rule**: 全ての操作は **"Diagnosis → Action → Verification"** の3点セット（Kinetic Chain）でなければならない。
- **Why**: 運動量（Momentum）を持たない操作は、システム抵抗（Validator）によって停止させられる。
- **Implementation**:
    - ❌ `kill 1234` (Static/Zero Momentum)
    - ✅ `ps 1234 && kill 1234 && ! ps 1234` (Dynamic/High Momentum)

## 🤝 Transparency (Honest Debugging)
- **原則**: 「プロっぽく振る舞う」ためにエラーを隠蔽しない
- **行動**:
    - 内部エラーは **即座に** ユーザーと共有
    - ユーザーを「顧客」ではなく「共同デバッガー」として扱う
    - 「困っています」「助けてください」と言える勇気を持つ

## ✅ 作業規約
- 変更はファイルごとに行い、確認の猶予を与える
- 新規ファイル作成前に既存ファイルの調査必須
- 既存のコード構造を厳格に保持

## 🔧 技術標準
- TypeScript: `any` 禁止、strict mode必須
- パッケージ管理: pnpm
- テスト: Vitest
- コミットメッセージ: Conventional Commits形式

## 🧠 継続的改善
- ミス発生時は修正後、関連ルールファイルを更新
- 新しいパターンを発見したらナレッジとして蓄積
- **チェックアウト時の改善提案は、必ずその場で実装・反映してからチェックアウト完了とすること (Kaizen First)**

## 🔄 コマンドエイリアス
- **`/go`** ← 究極の1コマンド（セッション開始〜終了まで全自動）
- **`/level [0-3]`** ← Autonomy Level即時切替（L0:手動 / L1:確認付き / L2:自律 / L3:全自動）
- 「終わり」「また明日」→ セッション終了（自然言語トリガー）
- 従来コマンド: `/checkin`, `/work`, `/verify`, `/ship`, `/checkout` （内部で自動呼び出し）

## 🔔 Proactive Triggers（常時アクティブ — 全セッションで適用）

> [!IMPORTANT]
> 以下のトリガー条件に合致した場合、AIは**確認なしで対応するワークフローを提案または実行**すること。
> 詳細ルール: `/Volumes/PortableSSD/.antigravity/AUTO_TRIGGERS.md`

| トリガー | アクション |
|---------|-----------|
| 「おはよう」「始めよう」「作業開始」/ 6時間以上の空白 | `/checkin` 自動実行 |
| 「終わり」「疲れた」「また明日」 | `/checkout` 自動実行 |
| 「バグ」「動かない」「エラーが出る」 | `/bug-fix` 提案 |
| 「新機能」「追加して」「実装して」 | `/spec` → `/new-feature` 提案 |
| 「コードきれい」「整理」「見直し」 | `/refactor` 提案 |
| 実装が一区切りつき、テスト未実施 | `/verify` 自動提案 |
| 「本番反映」「デプロイ」「公開」 | `/ship` 提案 |
| 成果がまとまり、ブログ化の価値あり | `/checkpoint_to_blog` 提案 |
| 「つづけて」「go」「進めて」「やって」 | 全ての明らかな次ステップを自律実行 |

## 🌐 Browser Hygiene
- **Rule**: 新しいタブ/ウィンドウを開く前に、必ず既存の不要なタブ/ウィンドウを閉じること
- **Constraint**: 同時アクティブタブ数は最大 **3** までとする
- **Action**: ブラウザ操作開始時に `check_tabs` → `close_old_tabs` → `open_new_tab` の手順を守る

## 📦 ワークフロー自動同期 (SSD起点)
ワークスペース読み込み時、SSDが接続されている場合:
1. `/Volumes/PortableSSD/.antigravity/agent/workflows/` の存在確認
2. ワークスペースの `.agent/workflows/` に標準ワークフローが不足していれば自動コピー
3. ワークスペースの `.agent/skills/` にグローバルスキルが不足していれば自動コピー
4. 完了時「✓ Workflows synced from SSD」と表示

## 🚀 プロジェクト初期化
- 「プロジェクト初期化」「project init」→ `/project-init` を実行
- 新規プロジェクトには `docs/PRINCIPLES.md` 読み込みを推奨

## ✓ 確認
このルールを読んだ場合「✓ Antigravity Rules Loaded」と表示
