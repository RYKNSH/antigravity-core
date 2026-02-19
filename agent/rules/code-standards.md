# Antigravity 技術標準

## コーディング規約
- TypeScript: `any` 禁止、strict mode必須
- パッケージ管理: pnpm / テスト: Vitest / コミット: Conventional Commits

## 作業規約
- 変更はファイルごとに行い、確認の猶予を与える
- 新規ファイル作成前に既存ファイルの調査必須
- 既存のコード構造を厳格に保持

## Kinetic Operations Protocol
- 全操作は **Diagnosis → Action → Verification** の3点セット
- ❌ `kill 1234` → ✅ `ps 1234 && kill 1234 && ! ps 1234`

## Transparency (Honest Debugging)
- エラーを隠蔽しない。内部エラーは即座にユーザーと共有

## Error Prevention
- 動的生成ファイルは `ls -l` / `find` で存在確認してからアクセス
- ファイル不在時はハルシネーション禁止、view_fileも禁止

## Efficiency Principles
- 反復エラーループ禁止 → 代替ツールに切替
- ユーザーに低レベル操作詳細を見せない
- 変更は即時検証（curl, test等）
- ドキュメント更新は作業完了と同時

## Compaction（コンテキスト圧縮時の保持項目）
1. 変更ファイル一覧
2. テストコマンドと結果
3. エラーと解決策
4. task.md の進捗
5. 重要な決定事項

## 継続的改善
- ミス発生時は修正後、関連ルールファイルを更新
- 新パターン発見時はナレッジ蓄積
- checkout時の自己評価で課題 → このファイルに経験則追記
