# Portable Studio: Feature Implementation Guide

## 1. プロジェクト・ライフサイクル (Project Lifecycle)

プロジェクトの状態管理とフォルダ操作の同期ロジック。

### プロジェクト識別子 (Project ID)
- **仕様**: 2026-01-26 以降、フォルダ名から日付プレフィックス（`YYYY-MM_`）を排除し、プロジェクト名をそのまま ID として使用。
- **目的**: ユーザーによる直感的なファイル管理と、パスの短縮。

### ライフサイクルフェーズ (Workspace 統合)
- **Check-in**: プロジェクト選択時、シンボリックリンクを自動作成する。
  - **ワークタイプ自動判別**: `scan_projects` 実行時、プロジェクトフォルダ内に `audio`, `video`, `graphics`, `code`, `streaming` と同名のディレクトリが存在する場合、それらを自動的に作業タイプとして登録する。
  - **UX 改善**: 以前は Finder でフォルダを自動的に開いていたが、ユーザーの意図しない挙動を避けるため、画面内の「フォルダを開く」ボタンによる手動起動に統一された。
- **モーダル統合 (CheckOutModal)**: 以前は独立した `CheckOut.tsx` 画面として復元していたが、ユーザーの作業継続性を重視するため、Workspace 内で開く「チェックアウト・モーダル」へと再統合された。
  - **3つの離脱モード**: 
    1. **一時離脱 (Leave)**: 状態を保存し、プロジェクト一覧に残す。
    2. **完了 (Complete)**: 状態を保存し、プロジェクトをアーカイブへ移動する。
    3. **削除 (Terminate)**: シンボリックリンクを解除し、プロジェクトデータを物理削除する（復元不可）。
  - **ダブル確認フロー**: 画面遷移を伴わずに、Git 状態のスキャン、中間ファイル削除、シンボリックリンク解除を一括で行う。
  - **トランザクション的処理**: クリーンアップ ➔ リンク解除 ➔ Git コミット ➔ アーカイブ/保存 という一連の不揮発性操作を、非同期ローディング状態 (`isProcessing`) で視覚的に保護。
  - **日本語化 (Localization)**: 2026-01-29 のアップデートにより、モーダル内のメッセージおよび Workspace 内の KPI ラベル等がすべて日本語化され、視認性が向上。
  - **ヘッダー UI 統合**: 「一時離脱」「完了」に加え、危険な操作である「削除」ボタンもヘッダーの右側に配置。誤操作防止のため、削除ボタンのみアウトライン・デザインおよび赤色配色を採用。
    - **デザイン・トークン**:
      - `secondary` (一時離脱): `var(--card-bg)` 背景、`var(--text-muted)` 文字色。控えめな補助アクション。
      - `primary` (完了): `var(--success)` 背景。不透明度 1.1 の輝度調整と `translateY(-1px)` による浮き上がり、`box-shadow` を用いたポジティブなフィードバック。
      - `danger` (削除): `transparent` 背景、`var(--danger)` 境界線と文字。破壊的アクションであることを視覚的に警告。
  - **フッターアクション・パターン (Footer Actions)**: 大規模な Workspace コンポーネントの視認性を高めるため、主要な離脱アクションをメインコンテンツ下部の専用コンテナに配置。
    - **実装**: `marginTop: '3rem'`, `borderTop: '1px solid #2a2a30'`, `display: 'flex'`, `gap: '1rem'` を用いて、作業領域と操作ボタンを明確に分離。
  - **SSD ルート配備プロトコル (SSD Artifact Deployment)**: 外付け SSD 環境での利便性を最大化するため、ビルド成果物（`.app`, `.dmg`）を内蔵ドライブの一時ディレクトリから SSD の第 1 階層（`/Volumes/PortableSSD/`）へ自動コピーして配備する。

---

## 2. ポモドーロ透過・常時前面ウィンドウ (Pomodoro Popout)

制作中の集中力を維持するため、タイマーをメインウィンドウから独立させる機能。

### 技術実装
- **マルチウィンドウ**: Tauri の `WebviewWindow` API を使用し、識別子 `pomodoro` のウィンドウを動的に生成。
- **ウィンドウプロパティ**: 
  - `transparent: false` (操作性重視。透過設定はクリックイベントの不正確な透過を招くため無効化)
  - `alwaysOnTop: true` (常時前面)
  - `decorations: false` (枠なし)
- **UI 構造**: ドラッグ領域 (`data-tauri-drag-region`) をヘッダー部分に限定し、ボタンのクリック感度を確保。
- **ルーティング**: メインアプリのエントリーポイント (`App.tsx`) において、URLパラメータ `?pomodoro=true` を判別して `PomodoroWindow` コンポーネントを表示。
- **オーディオ**: ブラウザの自動再生ポリシーに対応するため、ユーザーが開始ボタンをクリックした際に `AudioContext` を初期化/再開する。
- **状態同期**: `localStorage` を介して、メインウィンドウとポップアウトウィンドウ間で残り時間、作業/休憩フラグ、完了回数を共有。

---

## 3. Git 自動コミット連携 (Git Integration)

「変更を SSD に保存して持ち運ぶ」という体験を補強するため、作業終了時の Git 操作を自動化。

### 技術実装
- **Backend (Rust)**: `std::process::Command` を使用してシステム全体の `git` バイナリと対話。
  - **`git_status`**: `--porcelain` フラグを用いて、未コミットの変更を機械可読な形式でスキャン。
  - **`git_commit`**: `git add .` および `git commit -m` を順次実行。ディレクトリがリポジトリでない場合は自動的に `git init` を試行（Auto-Init）。
- **Frontend (CheckOutModal)**: チェックアウト・モーダルの確定フロー (`handleConfirm`) に統合。
  - 変更が検知されている場合、コミットメッセージ入力欄を表示。
  - デフォルトメッセージ (`wip: yyyy/mm/dd update`) を提供し、摩擦を最小限に抑制。
  - 非同期処理として実行され、進行状況を UI でフィードバック。

---

## 4. 並べ替え (Drag & Drop Reordering)

Native HTML5 Drag and Drop (DnD) は React 19 / Vite HMR 環境において不安定であったため、`@dnd-kit` による堅牢なポインターベースの管理へ移行。

### 技術実装
- **Library**: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`.
- **Sensors**: マウス/タッチ/キーボードの各センサーを統合。
  - **activationConstraint**: `PointerSensor` に `distance: 8` の制約を設定。タイピング中や微小なマウス移動による誤操作を防止。
- **IDベース管理**: インデックスではなくユニークな `id` による追跡 (`active.id`, `over.id`)。再レンダリング時のインデックスずれを排除。
- **パフォーマンス最適化**:
  - **メモ化**: リストアイテム (`SortableChecklistItem`) を `React.memo` 化し、ドラッグ中の不要な再描画を抑制。
  - **Debounced Auto-save**: 並べ替え結果を即座にディスク I/O せず、1秒程度のデバウンスを設けて `update_project` コマンドを実行。メインスレッドのブロックを回避。

## 5. Agent Workspace Protocol (AIアシスタント向け指針)

AIアシスタントがポータブル環境で効率的かつ継続的に作業を行うための標準プロトコル。プロジェクトルートの `.agent/workflows/` に定義されたファイルに基づき実行される。

### 3.1 Check-in (`/checkin`)
セッション開始時に実行し、文脈の同期と目標設定を行う。
1. **KI (Knowledge Items) の確認**: 過去の作業内容、設計判断、トラブルシューティング記録を把握。
2. **ワークスペースの現状確認**: 最新のファイル変更（`git status` 等）、未完了タスクの有無を確認。
3. **目標の確定**: 今回のセッションで達成すべき具体的なマイルストーンを確認し、ユーザーと合意。

### 3.2 Check-out (`/checkout`)
作業終了時に実行し、成果の永続化とクリーンアップを行う。
1. **作業サマリーの作成**: 実施した変更、解決した課題、残された懸案事項を記録。
2. **ナレッジベース (KI) の更新**: 新たな技術的発見、パターン、バグ修正、設計変更を反映。
3. **ストレージメンテナンス**: システムゴミ箱の物理削除 (`find ~/.Trash -mindepth 1 -delete`) を含む SSD 容量の確保。
4. **ソーシャルナレッジの発信**: 成果を「社会的気づき」へ翻訳し、ブログ等へ出力。
5. **未完了タスクの記録**: 次回セッションへ引き継ぐ内容を明示。

- **ハイブリッド永続化モデル**:
  - **SSD `data.json` (Rust管理)**: プロジェクトごとの核心データ（KPI、チェックリストの状態、メタデータ）を物理的に保存。SSD があればどの PC でも状態を復元可能。
  - **`localStorage` (Webview管理)**: UI の設定（テーマ）、タスクテンプレート、およびポモドーロタイマーのセッション状態（ウィンドウ間の同期用）を保持。
 - **同期ロジック**: Zustand Store のアクションを通じて、タスクや KPI の変更は即座に Rust 側の `update_project` コマンドを呼び出し、SSD へ Auto-Save される。
  - **並べ替え (Reordering)**: 以前の native HTML5 DnD ではなく、`@dnd-kit` を採用。`DndContext` および `SortableContext` を用いたポインターベースの管理により、React 19 環境下での高いレスポンス性と、SSD 環境特有の遅延に左右されない確実なステート更新（`reorderChecklist` / `reorderKpis`）を保証。詳細は [dnd_kit_migration.md](./dnd_kit_migration.md) を参照。

## 6. 作業用 BGM 機能 (Work BGM) [DECOMMISSIONED / 削除済み]

**※ 2026-01-30 にこの機能は完全に削除されました。**

### 経緯と教訓
YouTube IFrame API と Tauri のプロトコル制限（`tauri://` 拒否）との戦いにおいて、`tauri-plugin-localhost` の導入、CSP の緩和、`AudioContext` による診断などの多層防御を試みましたが、外部サービスの仕様変更や WebView の暗黙的な制限により、オーディオ再生の安定性を 100% 保証することが困難でした。

本来のプロダクト価値である「ポータブルな作業環境」のメンテナンス性を優先し、技術的負債となる可能性が高い外部 IFrame 依存のオーディオ機能を削除するという決定を下しました。詳細は [Feature Decommissioning Pattern](./feature_decommissioning.md) を参照してください。

### 過去の技術実装（参考）
- **Manual Iframe to ReactPlayer Migration**: YouTube 公式 SDK (`YT.Player`) やシンプルな `<iframe>` 手動制御から `react-player` への移行。
- **Audio Isolation Test**: `AudioContext` を用いたハードウェアレベルの検証。
- **Localhost Plugin Pattern**: `tauri://localhost` を `http://localhost:1421` へ変換し、YouTube のオリジンチェックを回避。

今後の診断手法については、[Tauri & WebView Audio Diagnostic Patterns](./diagnostic_patterns.md) を参照してください。

