# Videdit Video Editing Pipeline Overview

## 1. 概要 (Overview)

**Videdit** は、First Principles（第一原理思考）に基づき、映像制作のボトルネック（手動の選別・カット・レイアウト変更等）を解決するために設計された自動化パイプラインです。

## 2. システム構成 (Architecture)

システムは「Python Backend」と「Next.js Frontend」の2層構造で構成されています。

### Key Features
- **Unified React/FFmpeg Rendering Paradigm**: Python/FFmpeg handles the "Heavy Lifting" (Archive and Raw Cuts) while a **Pure React Overlay Engine** handles "Creative Finishing" (9:16 layout, titles, and overlays) with 1:1 visual parity across web and backend.
- **Integrated Template Studio (WYSIWYG)**: `react-moveable` による直接操作と、Instagramスタイルの没入型UIを採用した、9:16ショート特化型エディタ。
- **Seemless Production Hub**: ダッシュボードでの自動解析からエディタでの装飾、最終書き出しまでを、Blueprint スキーマを核に完全に統合。
- **Pure React Previews**: Standard HTML5 video and React overlays for real-time, low-overhead previews without external player dependencies.
- **Adaptive Long-Form Architecture**: 3〜5時間のライブ配信素材を「分割文字起こし（Chunking）」と「ウィンドウ分析（Windowing）」で処理。APIの制限やメモリ消費を回避し、大規模なアーカイブから高精度なショートを抽出。
- **Pydantic-Zod Contract**: Python と TypeScript 間の判別共用体型（Discriminated Unions）による完全なスキーマ同期。
- **SSD-Optimized Monorepo**: `uv` と `pnpm` を活用した、外部 SSD (ExFAT)環境での高度なスタビリティとポータビリティ。
- **Robust Error Recovery**: ジョブリトライ（Retry Endpoint）、多階層資産解決（Multi-tier Asset Resolution）、およびFFmpegフィルタのStream Interleavingによる、エラー耐性に優れたレンダリング基盤。

### バックエンド (Python - Videdit 2.0)
`VideditOrchestrator` による非同期タスク管理と `uv` によるヘルメティックな環境が核。
- **Ingest (WatcherService)**: ポーリングベースの常時監視と安定性チェックによる自動素材検知。
- **Analysis (core/workers.py)**: OpenAI APIを用いたコンテキスト解析。`Vocals` と `BGM` の音源分離（Audio Separation）および `torch` による非言語領域の解析。
- **Blueprint**: 解析結果に基づいた厳格な編集指示書（Pydanticモデル）の生成。
- **Execution**: 
  - **FFmpeg Renderer**: スタティックバイナリを使用した高速なドラフト動画および、Reactレイアウトから生成されたPNGオーバーレイを合成した最終動画の自動生成。
  - **Adobe Orchestrator**: Adobe Premiere Pro 向けスクリプト (JSX) の生成と自動実行によるプロ品質工程への橋渡し。

### ダッシュボード (Next.js)
パイプラインのリアルタイムな進捗監視、成果物のプレビュー、および **Advanced Template Studio** による最終レイアウトの WYSIWYG 編集を担当。

## 3. 開発原則 (Dev Principles)

- **第一原理思考**: 映像編集を「ピクセルと時間の再構成」という物理的最小単位まで分解し、AIによる自動化を最大化。
- **理想系駆動開発**: 「素材を置くだけで完成形が出力される」状態を理想とし、現在の制約（APIコスト、レンダリング時間等）を一つずつ解消。
- **アンチ・バンドエイド**: シェルスクリプトによる一時的な結合ではなく、スキーマ定義された「Blueprint」による宣言的な編集を追求。

## 4. プロダクト・ビジョン (Vision)

Videdit は、ローカルファーストかつ自律的なパイプラインであり、素材をドロップするだけでプロ品質の「編集済みアセット」へと変換することを目指します。
- **Decide once, render anywhere**: 「Blueprint」がすべての編集意思決定の唯一の真実の源。
- **Autonomous Processing**: ユーザーの介入なくファイルをクレームし処理する「Drop & Forget」ワークフロー。

## 5. ロードマップ (Roadmap)
- **Phase 4: Unified Visual Engine (Completed Feb 2026)**: Remotionを削除し、ピュアな React Overlay 戦略へ移行。ビルドの安定性とポータビリティを確保。
- **Phase 5: Feedback Loop & Performance**: 大規模アーカイブの処理効率化、AIによるエネルギーレベルに応じた動的な編集テンポ調整。
- **Phase 6: 120% Quality Calibration (Feb 2026)**: テンプレート選択時の自動デザイン継承、および FFmpeg プレビュー API の堅牢化（NFD/NFC パス問題の解決）を完遂。
- **Phase 7: Full Telop Studio Ecosystem (Completed Feb 2026)**: 
  - **Decision**: ダッシュボード統合型のハイブリッド・アーキテクチャを採用（`/debate deep` にて決定）。
  - **Phase 2A/B**: セマンティック分割エンジン（v2）および PSD テンプレート合成プレビュー実装。
  - **Phase 2C (Final Integration)**: `ReviewModal` における UI 統合と、既存動画への **v2 自動適用（Auto-resplit on Mount）** を実装。さらに、ReviewModal からデザイナーへの **Deep Link（Contextual Jump）** と、FFmpeg を用いた **Template Preview エンジン** を完遂。デザイン適用から承認、最終レンダリングまでの「Short-Form Studio Flow」を確立しました。
- **Phase 8: High-Fidelity Refinement (DEEP FBL AUDIT - Feb 2026)**:
  - **Goal**: 100項目の徹底的な品質改善（120% Quality）の実施。
  - **Milestone 1 (40/100)**: 16方向シャドウによる放送品質の縁取り、高精度な Undo/Redo、および Typography プロパティの実装。
  - **Milestone 2 (80/100)**: ズーム操作（Fit/Reset）、12種類の高品質プリセット、UI表示制限の解除、および背景・グラデーションの競合解消を完遂。FBL 検証により全機能の安定動作を確認。

- **Phase 9: Multi-Type Content Extraction (Feb 2026)**:
  - **Goal**: 対話・思索型コンテンツ（ポッドキャスト、雑談アーカイブ等）から価値ある瞬間を取りこぼさずに抽出するアルゴリズムの刷新。
  - **Milestone**: **Completed**. 3タイプ別スコアリング（COMPLETE, TEASER, QUOTE）の実装。完結性のみならず「名言性（Quotability）」や「引き（Curiosity Gap）」を個別に評価することで、0件になりやすかった抽象的な議論からのショート生成を成功させた（10件生成成功を確認）。さらに、ユーザーフィードバックに基づき、プラットフォーム最適化のための **30秒最小尺制限（Duration Optimization）** を導入。単なる抽出から、市場価値の高い尺構成への自動補正アルゴリズムへと進化した。
- **Phase 10: User-Driven Functional Blocker Sweep (Feb 2026)**:
  - **Goal**: V2.2 リリース後の実運用による「サイレント・フェイラー（無反応バグ）」と「UX の不連続性」を 100% 排除する。
  - **Current Status**: **Completed**. `REJECT` ボタンのハイドレーション不全を特定・解消し、テロップ編集の整合性を確保。
  - **Context Inheritance**: テンプレート適用時にユーザー入力テキストが消失する問題を、「Context Inheritance（文脈継承）プロトコル」の実装により解決。デザイナーへの Deep Link からテンプレート選択まで、一貫したテキスト保持を実証した。
  - **Personal Style Templates**: Zustand 永続化をベースとした「マイスタイル（My Styles）」保存機能を完遂。ユーザー独自の装飾設定を名前を付けて保存し、プロジェクトを跨いで再利用できるプロフェッショナルなエディタ環境を確立（2026-02-04）。

- **Phase 11: Real-time Layered Preview (Pattern 90/93) (Feb 2026)**:
  - **Goal**: 動画・PSDレイヤー・テロップを合成した「書き出し結果と 1:1 のプレビュー」をリアルタイムに提供する。
  - **Achievement**: **Completed**. `LayeredPreviewPlayer` の新規実装と整合性を 100% 保証。8文字制限オートラッピング（Pattern 93）を含む可読性管理を統合。

- **Phase 12: Short Reviewer & Integrated Workbench (Feb 2026)**:
  - **Goal**: 「制作・確認・評価・承認」が分断された現状のUXを抜本的に解決する。
  - **Achievement**: **Completed**. `/app/short-reviewer` として統合ワークベンチを実装。動画選択、テンプレート適用、レイヤードプレビュー、評価、一括エクスポートを 1 画面に集約し、ワークフローを 8 ステップから 4 ステップへ 50% 削減。FBL (Feedback Loop) により、実デバイス（ブラウザ）規模での動作安定性と、プレビュー不整合の解消を確認済み（2026-02-04）。

- **Phase 13: Temporal Unity & Absolute-Relative Alignment (Feb 2026)**:
  - **Goal**: ショート動画プレイヤー（0:00開始）とバックエンドデータ（絶対時間保持）の不一致を解消し、完璧な字幕同期を実現する。
  - **Achievement**: **Completed**. **Pattern 118 (Absolute-Relative Duality)** を導入し、表示直前に相対時間に正規化する React 派生ステートロジックを確立。さらに、再分割時の **Pattern 119 (Character-Proportional Distribution)** および最終的な **Pattern 120 (Ground-Truth Word-Level Re-anchoring)** により、音声認識データに基づいた 100% 精密な字幕同期を完遂。これにより、手動調整を一切必要とせず、音声とテロップがミリ秒単位で一致するプロ仕様のクリエイティブ・ワークフローを完成させた（2026-02-05）。

- **Phase 14: Self-Improving Telop Engine V3 (Feb 2026)**:
  - **Goal**: ルールベースの限界を超え、プロの感性を学習する「自律進化型テロップエンジン」への昇華。
  - **Achievement**: **Completed**. **Hybrid Semantic Splitter v3** を完全実装。タイムスタンプの「間」の動的解析（WPS連動型）、終助詞（ね・よ・わ等）の言語的認識、および3軸マルチスコア最適化（Timestamp, Balance, Semantic）により、人間レベルの意味的改行を実現。
  - **Self-Improvement**: ユーザーの手動編集を「正解（Ground Truth）」として捕捉する **Pattern 140 (Recursive Learning Loop)** を導入。`EditLogger` による差分抽出と、統計的な `PatternDetector` により、ユーザー特有の嗜好や新ルールを自動提案する「AIと人間の共進化チャネル」を確立した（2026-02-05）。

- **Phase 15: Interaction Integrity & Evaluation Stability (Feb 2026)**:
  - **Goal**: AIエンジン（V3）の高い出力精度を阻害しない、100% 信頼できる編集・評価インターフェースの確立。
  - **Achievement**: **Completed**. 評価ボタン（Good/NG）による自動遷移を廃止し、「評価 → 微調整 → 承認」のワークフローへ移行。**Pattern 145 (State-Safe Evaluation Funnel)** により、メタデータ更新時のローカル編集消失を完全に排除。さらに、リトライ時のセグメント欠損バグを、 Unique ID ベースのステート管理への移行により解消した（2026-02-05）。
- **Phase 16: Dashboard UX Consolidation & Next.js 16 Solidarity (2026-02-05)**:
  - **Goal**: 不要なモーダル・オーバーヘッドを排除し、専用ワークステーションへの直接遷移（Focused Workspace Transition）を実現する。
  - **Achievement**: **Completed**. `ReviewModal` および関連コンポーネントを完全に廃止。完了プロジェクトをクリックすると直接 `/short-reviewer?job_id=XXX` へ遷移するUXへ刷新。
  - **Stability**: `useSearchParams` に伴う Next.js 16 のビルドエラーを、**Pattern 155 (Suspense-Wrapped URL Context)** の適用により解決。サイト全体のビルド安定性を確保した。

- **Phase 17: Asynchronous Production Lifecycle & Render Queue (2026-02-05)**:
  - **Goal**: 高負荷な動画合成処理による UI のブロック（フリーズ）を完全に排除し、プロフェッショナルな非同期制作環境を構築する。
  - **Achievement**: **Completed**. **Pattern 161 (Async Action Acknowledgement)** を導入し、承認から書き出しまでのフローを非同期化。`RenderQueue` バックエンドサービスにより、レンダリングをバックグラウンドへ逃がすことで、Approve ボタンの即時応答（ミリ秒単位）を実現しました。さらに、フローティングパネル形式の **Rendering Queue UI** を実装し、リアルタイムな進捗可視化を完遂。これにより、複数のショート動画を並行して承認・書き出し可能な、高スルーアウトなプロダクション・ワークステーションへと進化しました。

- **Phase 18: Visual Integrity & UX Continuity (Feb 2026)**:
  - **Goal**: プレビュー精度 100% の保証と、プロダクション工程における操作の連続性を確立する。
  - **Achievement**: **Completed**. `LayeredPreviewPlayer` におけるクリッピングバグ（Pattern 109）の解消により、絶対座標指定のテロップ表示を完全保証。さらに、承認後のプレビュー動画切り替えによる視覚的断絶を解決する **Pattern 110 (Draft Continuity Protocol)** を導入。
  - **Data Integrity**: バックグラウンドレンダラーへの動的データ伝達を確実にする **Pattern 172 (Pydantic Bypass)** を実装し、設計意図が最終出力に 100% 反映されるエンジニアリング基準を確立しました（2026-02-06）。

- **Phase 19: Export Delivery & Download Experience (Feb 2026)**:
  - **Goal**: レンダリング後の最終成果物を効率的に取得可能な配信フローを実装する。
  - **Achievement**: **Completed**. 個別ダウンロードボタンの実装、およびエクスポート完了後の通知とアクションの統合。

- **Phase 20: Professional Productivity & Style Governance (Feb 2026)**:
  - **Goal**: ハードコードを排除し、ユーザーが自由かつ安全にデザインを管理・再現できるプロフェッショナルな編集環境を確立する。
  - **Achievement**: **Completed**. 
    - **Font Governance**: 共有フォント設定 (`fonts.json`) と Discovery API (`GET /fonts`) により不整合を排除（Pattern 254）。
    - **Editable Templates**: `updateTemplate` 実装と、/debate によるコンテキスト認識型 UI 設計の確立（Pattern 253, 258）。
    - **Review Workflow**: リトライ時の `approvedShorts` 自動クリアによる再承認フローの円滑化（Pattern 256）。
    - **Export Management**: FileSystem Access API による「保存先指定ダウンロード」と「一括（フォルダ）ダウンロード」を完遂（Pattern 257）。
