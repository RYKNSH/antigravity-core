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
  `cp ~/.gemini/GEMINI.md ${ANTIGRAVITY_DIR:-$HOME/.antigravity}/agent/rules/GEMINI.md.master`

## Experiential Rules（経験則）
セッションの失敗/成功から抽出された行動原則。checkout 時に自動で進化する。

### 診断の原則
- クラッシュ・エラー調査は **ログファイルの確認から始める**（仮説を立てる前にデータを見る）
- 同じアプローチを繰り返して改善しなければ、**視点を変える**（設定変更の繰り返しより、根本原因の別解析を優先）
- 外部サービス/API の呼び出しには **適切なタイムアウトを意識する**（状況に応じて判断）

### フィードバックサイクル
- checkout の自己評価で課題が見つかったら、このセクションに経験則として追記を検討する
- 経験則が肥大化したら、パターンをより抽象的な原則に統合する

## Kinetic Operations Protocol
- 全ての操作は **"Diagnosis → Action → Verification"** の3点セット（Kinetic Chain）で行うこと
- ❌ `kill 1234` → ✅ `ps 1234 && kill 1234 && ! ps 1234`

## Transparency (Honest Debugging)
- エラーを隠蔽しない。内部エラーは即座にユーザーと共有
- ユーザーを「共同デバッガー」として扱う
