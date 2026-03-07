# Portable Studio: Technical Architecture

## 0. Tech Stack (2026-01-29)
- **Frontend**: React 19, TypeScript 5.8, Zustand 5.0, Vite 7.0
- **Backend**: Tauri 2.x (Rust)
- **Package Manager**: pnpm
- **Icons**: Lucide React

Portable Studio のアーキテクチャは、ポータブルな作業環境を維持するために、ネイティブファイル操作とモダンな Web 技術を巧みに統合しています。

## 1. Rust Backend (Tauri Commands)

バックエンドは、Tauri 2.x と Rust で構築されており、OS レベルの権限が必要なファイル操作を担います。

### データ構造
- **AppData**: SSDパスとプロジェクト一覧を保持。
- **Project**: プロジェクトID、名前、メタデータ、チェックリスト、KPI、アーカイブフラグ。

### 主要機能
- **プロジェクト管理 (`scan_projects`)**: SSD の `Projects/` ディレクトリを走査し、`data.json` とマージ。未登録のフォルダは、その中のサブフォルダ名 (`audio`, `video` 等) から `workTypes` を自動判定して取り込む。
- **フォルダ生成 (`create_project`)**: `_master` および指定された `workTypes` に応じたサブディレクトリを自動生成。
- **Zero-Touch UX (`create_symlink` / `remove_symlink`)**: macOS の `unix::fs::symlink` を使用し、SSD 内のプロジェクトフォルダを `~/Desktop` へマウント。作業終了時に確実に解除する。
- **メンテナンス (`cleanup_temp_files`)**: `.tmp`, `.bak`, `.cache`, `~`, `.DS_Store` 等の不要ファイルを再帰的に削除。
- **ファイル追跡 (`get_file_changes`)**: 今日更新されたファイルを抽出し、セッションサマリーの自動生成を支援。
- **Git 同期 (`git_status` / `git_commit`)**: プロジェクトフォルダの Git 状態を確認し、作業終了時に「振り返りメッセージ」とともに自動コミットを実行。
- **バックアップ (`run_backup`)**: `rsync` を実行し、SSD 全体を外部バックアップ先へ同期。

## 2. Zustand State Management

フロントエンドの状態管理は Zustand で中央集権化されています。

### ストアの役割
- **状態保持**: 現在のスクリーン、プロジェクト一覧、選択中のプロジェクト、SSDパス、テーマ設定。
- **ハイブリッド永続化モデル**: 
    - **ドメインデータ (SSD/Rust管理)**: プロジェクト、タスク、KPI等の核心データは `data.json` として SSD に物理保存。これにより、SSD を持ち運ぶだけでどのデバイスでも作業を継続できる完全なポータブル性を確保します。
    - **UI/セッション状態 (Webview/LocalStorage)**: テーマ設定、タスクテンプレート、およびポモドーロタイマーの同期（メインとポップアウト間）のみに `localStorage` を使用。
- **Auto-Save 整合性**: タスクや KPI の変更が発生するたびに、バックエンドの `update_project` を非同期で呼び出し、SSD 内の `data.json` と即座に同期。起動時は SSD 側のデータを最優先の正解として読み込み、不整合を自動修復します。

## 3. UI Component Paradigm

作業フェーズに基づいたスクリーン・パラダイムを採用しています。

- **Setup**: ボリューム検出とパス設定。
- **Check-in**: プロジェクト選択または新規作成。選択時にシンボリックリンクを自動作成。
- **Workspace**: 制作活動のハブ。ポモドーロタイマー（ポップアウト対応）、TODO、KPI 管理を提供。以前は BGM プレイヤーが常駐していましたが、プラットフォーム制限による安定性低下を回避するため 2026-01-30 に削除されました。
- **Check-out**: 作業終了時の「振り返り」モーダル。今日の成果（変更ファイル、完了タスク）の確認、Git コミット、中間ファイル削除、シンボリックリンク解除、およびプロジェクトのアーカイブ/削除を Workspace 内で一括処理。
- **Pomodoro Popout**: ポモドーロタイマーをメインウィンドウから切り離し、透過・常時前面表示する別ウィンドウ (`WebviewWindow`) 機能。

## 4. Multi-Window Strategy
ポモドーロ機能は、Tauri のマルチウィンドウ API を活用しています。
- **Routing**: `?pomodoro=true` という URL パラメータでポモドーロ専用ウィンドウを判別。
- **Sync**: `localStorage` を介して、メインウィンドウとポップアウトウィンドウ間でタイマーの状態（残り時間、作業/休憩状態、完了回数）を同期。
- **Capabilities**: `capabilities/default.json` において、ウィンドウの作成、常時前面設定の権限を明示的に付与。
- **Interactive Resilience**: 操作性を確保するため、ポップアウトウィンドウの `transparent` 設定は `false` を推奨（透過設定はクリックイベントの不正確な透過を招くリスクがあるため）。ドラッグ移動を可能にする `data-tauri-drag-region` は、UI コンポーネントの操作を妨げないように配置を制御する。
- **Single Instance Lock**: `tauri-plugin-single-instance` を採用。複数のアプリケーションインスタンスが同時に立ち上がるのを防ぎ、2回目以降の起動試行時は既存のメインウィンドウにフォーカスを移動させる。これにより、外部 SSD 上の共有データファイルへの多重書き込みと競合を防止する。

## 5. UX & 実装の工夫
- **IME ガード**: 日本語入力中の Enter キーによる誤送信を `isComposing` でガード。
- **テーマレジリエンス**: ライト/ダークモードを CSS 変数と `data-theme` 属性で制御し、`localStorage` で永続化。
- **Effect Separation Pattern (状態安定化)**: アプリの初期化ロジック (`initialize()`) と、見た目の同期ロジック (テーマ変更等) を同一の `useEffect` にまとめない。これらを分離することで、テーマ変更などの頻繁なプロパティ更新が、アプリ全体の「初期化中（Loading）」状態を再発動させ、コンポーネントをアンマウントしてしまうリスクを回避する。
- **データ不整合への耐性**: 物理フォルダが手動で移動・削除されても、バックエンドのスキャン機能により `data.json` を動的に修復します。
- **ビルドパニックへの対抗策**: 外付け SSD (macOS) 特有の `._*` ファイル (リソースフォーク) が Rust/Tauri ビルド時に UTF-8 パニックを引き起こす問題に対し、以下の多層防御を確立。
    - **Hygiene**: `find . -name "._*" -delete` によるリソースフォークの徹底排除。
    - **Cache Reset**: `cargo clean` がメタデータ干渉で失敗する場合は `rm -rf target` によりビルド環境を強制初期化。
    - **Local Build (推奨)**: `CARGO_TARGET_DIR` をローカルの一時ディレクトリ (/tmp等) に設定し、不安定な外部メディアでの書き込みを最小化。

## 6. Development Workflow & Initialization

「外部からの引き継ぎプロジェクト」や作業再開時に環境の整合性を確保するための標準ステップ。

### 6.1 Initialization Pattern
1. **Config Audit**:
   - `package.json`: 依存関係と `pnpm` スクリプトの確認。
   - `tauri.conf.json`: `devUrl` (1420), `frontendDist` (../dist), `beforeDevCommand` の整合性。
   - `vite.config.ts`: Tauri 専用設定（ポート、ストリクトモード、無視パス）の確認。
   - `tsconfig.json`: `strict: true` の維持。
2. **Session Context Recovery**:
   - `brain/task.md`: セッション内のマイルストーン管理用。
   - `brain/implementation_plan.md`: 実装方針の合意形成用。
3. **Artifact Alignment**: プロジェクト固有の `KIs` と `.agent/workflows/` (checkin/checkout) の同期確認。

## 7. Architecture V2: The Great Refactor (Planned)

2026-01-29 の BGM 再生トラブル（Error 150/39）と Type System の崩壊を受け、アプリの堅牢性を抜本的に向上させるための大規模リファクタリングを策定。

### 7.1 State Management Decomposition
巨大化した `useAppStore` (God Class) を、ドメインごとに独立したストア（Slices）へ分割する。
- **`useProjectStore`**: プロジェクト CRUD、ファイル I/O、Git 連携、SSD パス管理。
- **`useTimerStore`**: ポモドーロタイマーのロジック、通知音、ポップアウトウィンドウとの同期。

### 7.2 Component Modularization
1200行を超える巨大コンポーネント `Workspace.tsx` を、責務に基づいたアトミックなコンポーネントへ解体。
- `src/components/workspace/PomodoroTimer.tsx`
- `src/components/workspace/TaskBoard.tsx`
- `src/components/workspace/KpiTracker.tsx`
- `src/components/workspace/ProjectHeader.tsx`

### 7.3 Tauri Platform Bridge (TauriAdapter)
`invoke` やプロトコル依存（`origin`）などの Tauri 固有ロジックを UI から完全に隠蔽する Adapter 層を導入。
- **Environment Agnostic**: ブラウザ（Mock Mode）とネイティブ（Tauri）の差異を Adapter が吸収し、開発効率とテスト容易性を向上。
- **Policy Centralization**: CSP 引っかかりやオリジン不整合を一箇所で管理し、`as any` 等の場当たり的なハックを廃止。
