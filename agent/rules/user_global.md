## 🌐 言語設定
- **全て日本語で対応**（コード内のみ英語）

## 🚫 禁止事項
- 変更内容の要約禁止 / 謝罪禁止 / 既知情報の確認禁止 / 無関係なリファクタリング禁止

## ✅ 作業規約
- 変更はファイルごとに行い、確認の猶予を与える
- 新規ファイル作成前に既存ファイルの調査必須
- 既存のコード構造を厳格に保持

## 🔧 技術標準
- TypeScript: `any` 禁止、strict mode必須
- パッケージ管理: pnpm / テスト: Vitest / コミット: Conventional Commits

## 🔄 コマンド
- **`/go`** ← 全自動（メタWF） / 「終わり」「また明日」→ セッション終了
- 詳細ルーティング: `.agent/workflows/WORKFLOW_ROUTER.md`

## 🔍 Skill-First（新機能・新技術着手時の必須ルール）
- 実装前に公式スキルを探索 → あればインストール → なければ自力実装
- 探索順: ①ローカル `~/.gemini/antigravity/skills/` → ②`anthropics/skills` → ③`vercel-labs/agent-skills` → ④`supabase/agent-skills` → ⑤`VoltAgent/awesome-agent-skills` → ⑥Web検索

## 🧠 継続的改善
- ミス発生時は修正後、関連ルールファイルを更新
- チェックアウト時の改善提案は、その場で実装・反映してから完了 (Kaizen First)

## ✓ 確認
このルールを読んだ場合「✓ Antigravity Rules Loaded」と表示
