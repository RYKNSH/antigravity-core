# Antigravity 技術標準

## コーディング規約
- TypeScript: `any` 禁止、strict mode必須
- パッケージ管理: pnpm
- テスト: Vitest
- コミットメッセージ: Conventional Commits形式

## 作業規約
- 変更はファイルごとに行い、確認の猶予を与える
- 新規ファイル作成前に既存ファイルの調査必須
- 既存のコード構造を厳格に保持

## 継続的改善
- ミス発生時は修正後、関連ルールファイルを更新
- 新しいパターンを発見したらナレッジとして蓄積
- GEMINI.md更新時は必ずSSDマスターにも同期:
  `cp ~/.gemini/GEMINI.md /Volumes/PortableSSD/.antigravity/agent/rules/GEMINI.md.master`
