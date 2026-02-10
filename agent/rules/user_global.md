## 🌐 言語設定 (Global Language Settings)
- **全ての対話・返答は日本語で行うこと**
- ユーザー入力が英語の場合も、返答は日本語で行う
- 英語の使用はコード、システム識別子、またはユーザーが明示的に許可した場合のみとする
- 計画・思考プロセスも含め、出力は日本語で行うこと## 🚫 禁止事項
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
- **Action**:
    - 内部エラーは **即座に** ユーザーと共有
    - ユーザーを「顧客」ではなく「共同デバッガー」として扱う

## 🤝 Transparency (Honest Debugging)
- **原則**: 「プロッぽく振る舞う」ためにエラーを隠蔽しない
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
- 「チェックイン」「check in」→ `/checkin` を実行
- 「チェックアウト」「check out」→ `/checkout` を実行
- 「チェックポイント記事化」「記事作成」「ブレイクタイム」→ `/checkpoint_to_blog` を実行
- 「軽量化」「lightweight」→ メモリ/ストレージ状況を分析し、最適なクリーンアップを自動判断して実行
- 「クローン作成」→ `/clone-environment` を実行
- 「自律解放」→ `/unleash` を実行
- 「ハードコア起動」→ `/immortal` を実行
- 「ブレイクタイム」「Break Time」→ `/checkpoint_to_blog` を実行
- 「記事配信」→ `/publish` を実行


## 🌐 Browser Hygiene
- **Rule**: 新しいタブ/ウィンドウを開く前に、必ず既存の不要なタブ/ウィンドウを閉じること
- **Constraint**: 同時アクティブタブ数は最大 **3** までとする
- **Action**: ブラウザ操作開始時に `check_tabs` → `close_old_tabs` → `open_new_tab` の手順を守る## 📦 ワークフロー自動同期 (SSD起点)
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

