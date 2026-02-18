# Portable Studio App: Overview

## 概要

**Portable Studio** は、クリエイターや開発者が外付けSSD一本で「どこでも、すぐに」作業を開始できる環境を構築・管理するためのデスクトップアプリケーションです。

Tauri 2.x (Rust) と React をベースに構築されており、マシンのデスクトップ環境と SSD 内のプロジェクト領域をシームレスに統合します。

## 主要なドキュメント

### 1. アーキテクチャと実装 (Architecture & Implementation)
- [システムアーキテクチャ](./architecture/system_architecture.md): Rust (Tauri), Zustand, UI コンポーネントの統合設計。
- [主要機能実装ガイド](./implementation/features.md): ライフサイクル管理、ポモドーロ透過ウィンドウ、エージェント・プロトコル。
- [トラブルシューティング](./implementation/troubleshooting.md): 外付け SSD でのビルドエラーやチェックアウトエラーへの対処。

### 3. 検証と履歴 (Verification & History)
- [開発・変更ログ](./verification/changelog.md): セッションごとの実装履歴と技術的決定事項。

## 基本機能

- **Check-in**: プロジェクト選択と同時にシンボリックリンク作成を自動化。
- **Auto-Sync**: `Projects/` ディレクトリの自動スキャンにより、物理フォルダと `data.json` を常に同期。
- **Workspace**: ポモドーロタイマー（ポップアウト対応）、タスクテンプレート、およびプロジェクト作業領域の統合。 (BGM ウィジェットは安定性向上のため v0.2.1 で削除)
- **KPI Countdown**: 定量目標の設定、残り回数のカウントダウン表示、進捗率の視覚化。
- **Reordering (DnD)**: `@dnd-kit` を用いた安定したタスク・KPI の並べ替え。
- **Check-out (Integrated Modal)**: 作業継続性を保つためのモーダル統合。サマリー確認、Git 自動コミット、一時離脱・完了（アーカイブ）・削除（Terminate）の 3 モードをサポート。
- **Portable Reliability**: 外付け SSD 起因のビルドエラーを回避するため、ローカルディスク (`/tmp`) を活用した最適化ビルドプロセスを確立。
- **Self-Hosting**: アプリ自体のソースコードも SSD 内で管理する自立的運用。
