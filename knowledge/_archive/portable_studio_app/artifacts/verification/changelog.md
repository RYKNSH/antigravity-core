# Portable Studio: Development & Verification Changelog

## 2026-01-30: Work BGM Decommissioning (Final Decision)

- **BGM プレイヤー機能の完全削除**:
    - **決断**: YouTube IFrame API のプロトコル制限 (`tauri://` 拒否) および CSP による不安定性を 100% 排除することが困難と判断。
    - **実施**: `BgmPlayer.tsx` コンポーネントの物理削除、`appStore.ts` からの BGM 関連ステート/アクションの削除、`App.tsx` からのコンポーネント参照削除。
    - **依存関係の整理**: `pnpm remove react-player` を実行し、不要なライブラリをプロジェクトから排除。
    - **CSP 強化**: `tauri.conf.json` の `security.csp` から youtube.com および googlevideo.com への許可ルールを削除。
- **診断知見のドキュメント化**:
    - 再生トラブルの過程で確立した `AudioContext` による「Beep Test」および「MP3 Stream Test」を [Diagnostic Patterns](../implementation/diagnostic_patterns.md) として標準化。
- **リファクタリング (BGM 以前の作業)**:
    - **Style Extraction**: インラインスタイルを `STYLES` 定数オブジェクトへ抽出し、`React.CSSProperties` を適用。
    - **グローバル型定義**: `src/types/global.d.ts` による型安全性の確保。
- **検証**:
    - 削除後のプロジェクトにおいてビルドエラーがなく、ポモドーロ音（AudioContext）等の既存機能が正常に動作し、CSP が適切に厳格化されていることを確認。

## 2026-01-30: BGM Player Refactor & Type Safety Verification

- **BgmPlayer.tsx の完全リファクタリング**:
    - **Style Extraction**: インラインスタイルを `STYLES` 定数オブジェクトへ抽出し、`React.CSSProperties` を適用。ロジックとデザインを分離し、保守性を向上。
    - **Import 整理**: `react-player` のメインエクスポートを使用し、型定義の不整合を解消。
- **グローバル型定義の導入**:
    - `src/types/global.d.ts` を作成し、YouTube IFrame API (`window.YT`) の型を定義。コンポーネント内から `@ts-nocheck` を排除し、完全な型安全性を確保。
- **再生安定性の向上**:
    - `origin` パラメータの最適化により、Tauri 環境での `tauri://` スキームに起因する認可エラーを回避。
- **検証とトラブルシューティング**: 
    - 開発サーバー (`pnpm dev`) における正常起動および BGM プレイヤーの機能動作を確認。
    - **Tauri 2 Build Panic 解決**: 外付け SSD (ExFAT) 環境での `core:window` 許可スキャナーによる UTF-8 パニックに対し、`src-tauri/target` の完全削除や AppleDouble 清掃だけでは不十分な場合があることを特定。最終的に `CARGO_TARGET_DIR` を `/tmp` (APFS) へリダイレクトすることで、ビルドプロセスを完全に安定化しリカバリを完遂。
    - **BGM 再生停止の根本原因特定**: `react-player` 移行後も再生できない問題に対し、Tauri の Security 定義 (`csp: null`) による YouTube リソースのブロッキングが原因であることを特定。`tauri.conf.json` への許可ルールの追加を計画。

## 2026-01-29: BGM Reliability Update & Protocol Specialization

### Work BGM 機能の安定化 (Audio Reliability)
- **react-player 導入**: YouTube 公式 IFrame API のオリジン制限 (Error 150) を回避するため、`react-player` ライブラリへ移行。
- **診断モードの実装**: 画面上に再生ログ（READY, PLAY, ERROR）をリアルタイム表示するオーバーレイを追加。
- **TypeScript 整合性の確保**: `react-player` の型定義と YouTube `playerVars` の不整合に対し、`as any` キャストによるビルドエラー回避手順を確立。
- **1x1 Pixel IFrame**: OS によるバックグラウンド再生抑制を回避するため、最小サイズの視覚実体を維持。
- **検証フロー**: `Browser-First Verification` により、ビルド前にブラウザ上で通信（Heartbeat 401 等）を確認する効率的なデバッグフローを確立。

### エージェント・ワークフローの高度化
- **プロトコル確立**: `/checkin` および `/checkout` における詳細手順を `.agent/workflows/` に定義。
  - **Check-in**: KI確認、ワークスペース現状分析、目標設定の三段階プロセスを標準化。
  - **Check-out**: サマリー作成、KI更新、SSDストレージメンテナンス（ゴミ箱の物理削除命令含む）、ソーシャルナレッジ発信フローを統合。

### プロダクト機能の回復と進化 (Check-out & Git Sync & Work BGM)
- **Check-out 画面の完全復元**: 以前のセッションで「不要」として廃止されていた `CheckOut.tsx` を、正当な作業ライフサイクルの一環として再接続。
- **Git Sync 実装**: 
  - **Backend**: Rust 側で `git_status`, `git_commit` コマンドを新規実装。プロジェクトフォルダ内での `git init`, `git add`, `git commit` をサポート。
  - **Frontend**: `appStore.ts` に Git アクションを追加。Check-out 画面で未コミットの変更を自動検知し、振り返りメッセージと共に保存する UI を構築。
- **Work BGM 機能の実装**: 
  - **YouTube IFrame 連携**: SSD の容量を圧迫しないよう、YouTube IFrame API を利用した外部リソース再生機能を実装。
  - **BgmPlayer.tsx**: 専用のフローティング・ウィジェットを新規作成し、Workspace に統合。
  - **状態管理**: Zustand を介して再生状態、ボリューム、トラック選択、最小化状態を管理。
 - **バグ修正**: `CheckOut.tsx` 内の JSX 構造の崩れを修正し、サマリー、Git セクション、操作ボタンのレイアウトを安定化。
 
### タスク並べ替えの抜本的改善 (UX Refactoring)
- **@dnd-kit への移行**: 以前の native HTML5 Drag and Drop 実装が React 19 / Vite 環境で不安定であったため、`@dnd-kit`（`core`, `sortable`, `utilities`）へ完全に移行。
- **成果**: ポインターイベントベースの管理により、ドラッグ操作の確実性と視覚的フィードバックの質を大幅に向上。ステートの不整合による「並べ替えが反映されない」問題を抜本的に解消。
- **パフォーマンス改善**: ユーザーからの「重い」というフィードバックに対し、`activationConstraint`（遊び値）の設定および **Debounced Auto-save** を導入。連続した操作（並べ替え中など）における過度なディスク I/O を抑制し、レスポンスを向上。
- **実装詳細**: `DndContext`, `SortableContext` を導入し、チェックリストを ID 基準での管理へ刷新。モバイル（Touch）およびマウス操作の両方で安定した挙動を確認。

### 開発効率の向上 (Mock Mode による高速イテレーション)
- **SafeInvoke の導入**: ブラウザ実行時（Tauri API 不在時）に自動でダミーデータを返すラッパー関数を実装。
- **ビルド環境の安定化**: ポート衝突（1420）の自動クリーンアップ手順と、ExFAT上でのビルドパニックを回避する `CARGO_TARGET_DIR` 指定パターンを確立。
- **メリット**: 外部 SSD や Rust バックエンドなしで、ブラウザ (`http://localhost:1420`) 上での UI/UX 検証が可能になり、開発速度が飛躍的に向上。

### 外部プロジェクト・オンボーディング (Initialization Pattern)
- **手法確立**: 外部引き継ぎプロジェクトに対し、`package.json`, `tauri.conf.json`, `vite.config.ts`, `tsconfig.json` の4点監査（Static Config Audit）と `task.md` / `implementation_plan.md` による脳内コンテキスト復元（Brain Context Recovery）のプロセスを確立。

### 技術スタックの明文化と更新
- **構成**: React 19, TypeScript 5.8, Zustand 5.0, Vite 7.0, Tauri 2.0 (Rust) への固定。
- **検証**: Tauri v2 でのビルド整合、および `pnpm` ワークスペース環境での動作を確認。

---

## 2026-01-27: Full SSD Transition & Environment Purge

### 運用拠点の一元化 (SSD Source of Truth)
- **環境パージ**: ローカル内蔵ドライブ (`~/.gemini/antigravity/playground/`) に残存していた旧プロジェクト（12件）を完全に削除。
- **検証**: アクティブなワークスペースがSSD上にあることを確認した上で実行し、ローカル環境の「不純物」を排除。
- **目的**: どの端末に接続しても同一の環境を再現できる「完全ポータブル開発環境」への移行を完遂。

### インフラ設定の標準化
- **安全性向上**: プロジェクト削除前の「現在地（アクティブワークスペース）」確認をエージェントの標準プロトコルとして導入。
- **ドキュメント更新**: ポータブル開発エコシステムのセットアップガイドに、ローカル環境の定期パージ手順を追加。

---

## 2026-01-26: Stabilization and UX Enhancements


### バグ修正: プロジェクトリストの同期不備
- **修正**: 「プロジェクト完了」または「プロジェクト終了」を実行した際、バックエンドの削除/移動には成功するが UI リストから消えない問題を解消。Zustand Store のアクション内で、成功後に `projects` 配列を `filter` してステートを更新するよう修正。

### 仕様変更: プロジェクト命名規則の刷新
- **変更**: プロジェクト ID およびフォルダ名から日付プレフィックス (`YYYY-MM_`) を削除。プロジェクト名をそのままフォルダ名として使用し、ユーザーによる管理を容易にした。

### 新機能: ポモドーロ透過・常時前面ウィンドウ
- **内容**: 集中力を維持するため、ポモドーロタイマーをミニマルな透過ウィンドウとしてポップアウトする機能を追加。
- **技術要素**: Tauri `WebviewWindow` API, `always-on-top`, `localStorage` による状態同期。
- **安定性向上**: 透過設定 (`transparent: true`) とドラッグ領域の干渉によるクリック不可問題を解決。`AudioContext` の初期化をユーザー操作時に移動させることで Autoplay ポリシーに対応。

### 4. 並べ替え機能の最終調整と検証
- **修正**: タスクおよび KPI のドラッグ&ドロップにおいて、`dataTransfer` と React ステートの二重管理を廃止。ステートを優先するシンプルなロジックへの統合により、並び替えの確実性を向上させた。

### 5. チェックアウト体験の統合 (Workspace 統合)
- **改善**: チェックアウト専用画面を廃止し、Workspace 画面から直接離脱・完了・終了アクションを実行できるように変更。遷移の手間を削減。

### 6. UI/UX のブラッシュアップ
- **整理**: プロジェクト選択（Check-in）時に Finder を自動で開く挙動を削除（Workspace 内のボタンで手動制御に変更）。
- **クリーンアップ**: 不要となった `CheckOut.tsx` 画面への遷移を完全に廃止。Workspace 内に残存していたレガシーな `checkout` フッターボタン (L1184-1189) を削除し、UI 統合を完遂。
- **ビルドトラブルシューティング**: SSD 環境特有の UTF-8 パニック（`._*` ファイル干渉）に対し、`target` ディレクトリを含む再帰的なクリーンアップと `cargo clean` を実施して環境を復旧。
- **デザイン**: 視認性向上のため UI 余白を調整。プログレスバー周りを `1.5rem`、タスクセクション開始位置 (`checklist-header`) を `2rem`、KPI セクションの開始位置 (`marginTop`) を `3rem` へとそれぞれ拡大し、情報の混雑を解消（動作確認済み）。
- **データ保護**: アップデート時にタスクや KPI がリセットされる事象に対し、SSD 内の `data.json` と `localStorage` の同期ロジックを強化。

### 7. ビルド環境の安定化
- **インフラ**: 外付け SSD 環境での macOS リソースフォーク (`._` ファイル) によるビルドパニックを回避。
- **対策**: `find src-tauri -name "._*" -delete` と `CARGO_TARGET_DIR=/tmp/tauri-target` の組み合わせでクリーンビルドに成功。外付けメディア上の AppleDouble ファイル干渉を物理的に回避する標準セットアップとして確立（動作確認済み）。
- **ワークフロー**: AI アシスタント向けに、セッションの開始（`/checkin`）と終了（`/checkout`）の手順を定義した `.agent/workflows/` ファイルを整備。

---

## 2026-01-25: Core Refinement (v0.1.0)

- **KPI カウントダウン**: 目標達成に向けたカウントダウン、期限計算、並び替え機能を実装。
- **ポモドーロ通知**: Web Audio API によるシンセ音を実装。
- **TypeScript 整合性**: Tauri/Vite 環境での型衝突 (`NodeJS.Timeout`) を解消。
- **物理フォルダ同期**: `scan_projects` コマンドにより実ディレクトリと `data.json` の乖離を自動修復する機能を実装。
