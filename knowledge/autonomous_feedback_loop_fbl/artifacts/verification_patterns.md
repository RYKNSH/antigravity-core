# Layer-Based Verification Patterns

To ensure "120% Quality," verification is structured in layers to prevent lower-level bugs from masking upper-level regressions.

## Phase 0: Pre-Flight Check (Code Health)
Execution of `pnpm lint`, `pnpm typecheck`, and `pnpm test`. The **Bug Hunter** analyzes results and attempts immediate repairs.

## Phase 1 & 2: Structural Integrity (DB & API)
- **DB Layer**: Verification of migrations (manual guard) and schema consistency.
- **API Layer**: Contract testing (Input/Output schemas) and error boundary coordination.

## Phase 3: Visual & UX Layer
- **Visual Audit**: Screenshot comparison using `browser_subagent`.
- **Sub-pixel Precision Audit**: API から返される JSON 座標（x, y, w, h）を DOM の `getBoundingClientRect()` または `computedStyle` と 1px 単位で比較し、ズレの正体が「レンダリングの問題」か「デザインデータ（PSD等）自体の非対称性」かを特定する。
- **Deep Parameter Sweep**: 100課題チェックリストに基づき、全可変パラメーター（サイズ、透明度、縁取り幅等）を最小・最大値でスイープし、境界値でのレイアウト崩れやレンダリング劣化（16方向シャドウが必要な微細なトゲ、グラデーションのバンディング等）を視覚的に網羅検証する。
- **Responsive Guard**: Verification across Mobile, Tablet, and Desktop breakpoints.

## Phase 4: E2E Data Flow
Verification that a "User Action" correctly updates the DB and reflects back in the UI (Single Source of Truth).

## Phase 5: 120% Quality Gate
Final qualitative check against the "Delight" list:
- [ ] Does it have a "Wow" factor?
- [ ] Are error messages helpful/kind?
- [ ] Is the loading state beautiful?
- [ ] Is the accessibility considered?

## Phase 6: Autonomous Continuous Improvement (Deep FBL Audit)
Beyond simple bug hunting, this phase aims at perfection by iterating through a 100-point checklist:
1.  **Categorization & Extraction**: Sweeping all parameters to create a comprehensive list of micro-issues (Layout, Edge, Sync, UX).
2.  **Critical Alignment**: Manual/Guided resolution of fundamental architectural issues (e.g., 16-dir shadow, coordinate system refactoring).
3.  **Autonomous Sweep**: Instructing the system to "fix all remaining issues autonomously," leveraging the Browser Inspector and code analysis tools to resolve Medium/Low priority items across the codebase.

## Safety & Autonomy Guards
- **Time Limit**: Mandatory 30-minute timeout to prevent runaway resource consumption.
- **Loop Limit**: Maximum 3 self-repair attempts per session.
- **Goal Limit**: A session can target either "Fixed items count" or "Time spent" depending on user preference.
- **Destructive Action Protection**: Automated loops are prohibited from executing migrations, production deploys, or secret modifications without explicit human approval.
- **Audit Logging**: All automated repairs are recorded in `fbl_audit.log`.

## Phase 7: Environment Satisfiability Pattern (Synthetic Context Injection)

統合テストにおいて、複雑な依存関係（ジョブ実行、データ生成など）が原因で「検証したい機能」の前提条件が整わない場合に、エージェントが自律的にバックエンドの期待される状態を「合成」して検証するパターン。

- **Scenario**: デザイナーの「適用」ボタンをテストしたいが、対象の `jobId` に紐付くプロジェクトファイルがまだ存在しない（または 404 になる）。
- **Implementation**:
    1. **Context Discovery**: バックエンドコードを調査し、API が要求するファイルパスとデータ構造（Pydantic schema 等）を特定。
    2. **Synthetic Injection**: `write_to_file` を使用して、期待されるディレクトリ構造（`backend/projects/test/`）と JSON（`test_project.json`）を強制作成。
    3. **Action Verification**: 合成されたコンテキスト上で実際の E2E テストを実行。
- **Benefit**: 「前提条件が整わないからテストできない」という停滞を打破し、機能のコアロジック（データの同期・整合性）をピンポイントで 120% 保証できる。

## Phase 8: Observer Paradox Resolution (Deep Interception)

「技術的には成功しているが、ユーザーが『反応がない』と感じる」という、主観的なフィードバックと客観的なシステム状態の乖離（観測者パラドックス）を解消するためのデバッグ手法。

### Implementation: The "Truth Mirror" Script
エージェントがブラウザ側で実行する、ランタイム環境の「全層監視」プロトコル。

1.  **Event Mirroring**: ボタンの `click` イベントに、アプリケーション側の処理を邪魔しない `isTrusted` 検証用のリスナーを付与。また、`async/await` のハンドリング不全を特定するためのコード計装（Code Instrumentation）を実施。
2.  **Fetch Mirroring**: `window.fetch` をモンキーパッチし、ネットワークリクエストの成否だけでなく、送信された Pydantic 契約データの正確性をコンソールに鏡像出力（Echo）する。
3.  **Alert Mirroring**: ブラウザのダイアログ機能がブロックされていても内容を捕捉できるよう、`window.alert` | `window.confirm` をラップし、メッセージを内部配列に収集する。

### Purpose
「UI が死んでいる」のか「ブラウザ設定が邪魔している」のか「フィードバックが不十分」なのかを瞬時に切り分け、単なるバグ修正を超えた **UX 的な改善案（Pattern 87: Success Visibility）** への昇華を可能にする。

## Phase 9: Temporal Fidelity Audit (Time-Shift Verification)

タイムラインベースの動的要素（テロップ、エフェクト、オーディオ等）が、メディアの再生時間に正確に同期して変化することを検証するパターン。

- **The Problem**: シークバーを操作した際、映像（背景動画）は切り替わるが、その上に重なる UI 状態が更新されない「Frozen UI」問題は、静的なスクリーンショット検証では検知が困難である。
- **Implementation (Step 726)**:
    1. **Multi-Point Seek**: `browser_subagent` を用い、ランダムまたは重要地点（セグメントの境界付近）で複数の `seek` 操作を実行。
    2. **State Sampling**: 各地点 (`currentTime = n`) で一時停止し、スクリーンショットと DOM の状態（テキスト内容等）をサンプリング。
    3. **Consistency Check**: 各タイムサンプルの内容を、ソースとなるタイムラインデータ（JSON）の期待値とマッチング。
- **Benefit**: 再生時間という 4 次元的な軸における実装の「整合性」を保証し、編集ツールとしての実効的な信頼性を 120% に高める。

## Phase 10: Cognitive Load & Modal Separation (Duality Audit)

高度なクリエイティブツールにおいて、「デザイン（静止画的属性）」と「ペース/構築（動画的属性）」の操作が混在することで発生する、ユーザーの認知負荷と誤操作（意図しないデータ上書き）を検証・解消するパターン。

- **The Problem**: ユーザーの設定変更（例：テロップの最大文字数）が、現在進行中の編集作業（タイムラインの調整）を破壊的に自動更新してしまうと、ユーザーは「制御不能」という恐怖を感じ、ツールの信頼性が損なわれる。
- **Implementation (/debate deep integration)**:
    1. **Role Identification**: UI 上の各操作が「Design (Visuals)」か「Pacing (Structure/Timeline)」かを分類。
    2. **Explicit Boundary Audit**: 設定変更が即座に同期されるべきか（Design）、あるいは明示的な反映ボタン（Duality Gate）を介すべきか（Pacing）をディベート。
    3. **Hint Propagation**: デザイン側で変更があった際に、編集側の UI で「再構成が必要」であることを示す視覚的ヒント（Pattern 114）が存在するか確認。
- **Benefit**: 「便利な自動化」が「破壊的な驚き」に変わるのを防ぎ、ユーザーが複雑なシステムを 100% 制御できているという確信（Creator Confidence）を醸成する。

## Phase 11: Interface Contract Validation (Schema Drift Audit)

フロントエンドのステート更新ロジックが、バックエンド API の最新のレスポンス形式と一致しているかを検証するパターン。

- **The Problem**: バックエンドが返すフィールド名（例：`lines`）とフロントエンドが参照するプロパティ名（例：`timeline`）が不一致（Naming Mismatch）であっても、型定義上の不整合が実行環境の動的データで顕在化するまで「サイレントな機能不全」として潜伏しやすい。
- **Implementation (Step 275 Integration)**:
    1. **Dynamic Mapping Audit**: API 呼び出し箇所の `data` オブジェクトの構造を、実際の API レスポンスの `.json()` 解釈結果と照合。
    2. **State Propagation Trace**: 受信したデータがどのようにステート（Zustand 等）に格納され、最終的な UI コンポーネントに反映されるかのパスを追跡。
    3. **Fail-Fast Logging**: 通信成功後のステート更新において、期待されるフィールドが存在しない場合に警告（Warning/Error）を出すガードレールが存在するか確認。
    4. **Reactive Mapping Check (Case Study: Step 283)**: API レスポンスの `lines` 配列内の `start_time` プロパティを、フロントエンドの `timeline` ステート内の `start` プロパティに正しく変換しているか。単なるフィールドの存在確認だけでなく数値の「意味」が型定義を超えて一致しているか。
- **Benefit**: 「通信は成功しているのに動かない」という難解なデバッグコストを削減し、システムの各レイヤー間における確実なデータ結合（Grip）を保証する。

## Phase 12: Syntactic Integrity Gate (Fast-Refactor Catch)

大規模なコンポーネントのレイアウト変更や UI の再配置（例：3カラム化へのリファクタリング）において、JSX のネスト構造が崩れることで発生する「ビルドは通るが構文的に不正なランタイムエラー」や、「エディタ上での閉じタグ欠落」を迅速に検知するパターン。

- **The Problem**: 複雑な条件分岐（Ternary Operators）や入れ子の DIV が多い中での切り貼り（Copy-Paste）は、一瞬の不注意で `</div>` が欠落し、開発サーバーがパニック（Compile Error）を引き起こす。
- **Implementation (Step 318 Integration)**:
    1. **Pre-Commit Linting**: ファイル保存時にエディタレベルで JSX の整合性をチェック。
    2. **Immediate Fail-Fast**: 構文エラーが発生した際、他のロジックを追う前に「まずは全てのネストを閉じたか」を確認するプロトコル。
    3. **Structural Verification**: 大幅なレイアウト変更後は、`view_file` 等で全体の開始タグ/終了タグの対応を再スキャンする。
- **Benefit**: 高速リファクタリングにおけるダウンタイムを最小化し、開発リズム（Velocity）を維持する。

---
*Updated: 2026-02-05*

## Phase 13: Temporal Fidelity Audit (Lip-Sync/Voice Match)

映像とテキスト（テロップ）が密結合しているシステムにおいて、論理的なデータ構造（ start/end タイムスタンプ）が、実際の視聴体験（音声の波形や発話のタイミング）と物理的に一致しているかを検証するパターン。

- **The Problem**: タイムスタンプの計算式が「リニア（線形）な文字数比例」に依存しすぎると、人間の発話の「タメ」や「間」を無視した、機械的な表示のズレ（Drift）が発生する。
- **Verification Logic**:
    1. **Audio Peak Alignment**: ブラウザ環境でテロップが表示される瞬間と、音声トラックの立ち上がりが同期しているかを確認。
    2. **End-to-End Duration Check**: 基となる音声の全尺と、生成された全テロップセグメントの合計尺が一致しているか。
    3. **Drift Threshold**: 0.2秒以上のズレを「品質劣化」とみなし、時間按分の再計算を要求する。
- **Benefit**: 「ただ文字が出ている」状態から、「心地よく読みやすい（ナラティブと同期した）」映像体験へと引き上げる。

---
*Updated: 2026-02-05 (Round 2)*

## Phase 14: Reference Frame Consistency Audit (Absolute vs. Relative)

データの保持形式（絶対座標/時間）と、コンシューマー（UI プレイヤー/ビューポート）の期待形式が一致しているかを検証するパターン。

- **The Problem**: タイムラインデータ自体が論理的に正しくても、それが「10:00:00」という絶対時刻を基準にしている場合、0:00 起点のプレイヤーでは「未来のデータ」として無視される。これは典型的な「サイレント・フェイラー」であり、静的なバリデーションを通過してしまう。
- **Verification Logic**:
    1. **Consumer Origin Check**: UI コンポーネント（特に `<video>` ）の 0:00 が、データのどの地点に対応するかを特定。
    2. **Data Offset Audit**: 表示対象のデータの最小値がプレイヤーの再生可能範囲（0 〜 duration）に収まっているかを確認。
    3. **Normalization Pass**: データが 0 以外から始まっている場合、明示的な「オフセット減算」ロジックがレンダリング直前に存在するかをソースコードおよびランタイムログで検証。
- **Benefit**: サブクリップ編集やストリーミングデータなど、多様な「時間の基準点」が混在するシステムにおいて、常にデータが視覚的にリンクされる状態を保証する。

---
*Updated: 2026-02-05 (Round 3)*

## Phase 15: Store Hydration & Visual Sanitization Audit

システムデフォルト値の「汚染」や、コンポーネント間のデータ欠落によるサイレント・フェイラーを防ぐための検証パターン。

- **The Problem**: 
    1. **Placeholder Leak (Pattern 123/124)**: プログラムのデフォルト値（例：「新しいテロップ」）が、実際のユーザーデータとして予期せず永続化されたり、プレビューに表示されたりする。
    2. **Store Emptiness (Pattern 126)**: デフォルトのテンプレート・ストア等は空の状態で初期化されることが多く、ロード漏れ等により UI が「選択肢なし」の状態（Stalled state）になり機能不全に陥る。
    3. **Zero-Dimension Layout**: コンポーネントの入れ子や CSS 継承のミスにより、DOM 上には存在するが高さ 0px で「不可視」になる UI（Invisible Render）が発生し、バグ調査を困難にする。

- **Verification Logic**:
    1. **Magic-String Audit**: 実際の実行環境（ブラウザ）の DOM やステートをクエリし、システム定義のプレースホルダー（"新しいテロップ" 等）がユーザーのコンテンツとして露出していないかを確認。
    2. **Store Readiness Probe**: 主要なビジネスロジックを実行する前に、依存する全ストア（Style, Template, Config）に最低限のデータがロードされているかをアサーション。
    3. **Viewport Clipping & Visibility Check**: `browser_subagent` の `getBoundingClientRect` 等を用いて、主要なオーバーレイ要素（LayeredPreviewPlayer 等）の幅・高さが > 0 であり、かつ透明度が 0 でないことを検証。
    4. **Strict Decoupling Audit (Pattern 124)**: デザイン（スタイル）の変更が、テキスト内容（コンテンツ）に破壊的な影響を及ぼさないことを「スタイル変更プロトコル」の実機テストで確認。
    5. **Visual Reaction Audit (Pattern 125)**: スタイル選択肢（ドロップダウン等）を操作した際、プレビュー上の要素が即座に視覚的に変化（色、グロー、位置等）し、かつ「テキストが消えない」ことを検証。

- **Benefit**: 「壊れてはいないが機能していない」という、開発者が最も見落としやすい「不毛な UI 状態」を排除し、ツールの堅牢性を 120% に高める。

---
*Updated: 2026-02-05 (Phase 2 Refactoring)*

## Phase 16: Atomic Decoupling Guard (Workbench Isolation Verification)

大機能が密集するコンポーネントにおいて、ステートの肥大化による「リアクティビティのパニック」や「保守不能なコード（God Component）」を解消・防止するための検証パターン。

- **The Problem**: 500行を超える単一 React コンポーネント（例：`ReviewModal`）は、10以上の変数が複雑に絡み合い、一つの修正が予期せぬ場所で再レンダリングやステート消失を引き起こす。
- **Verification Logic**:
    1. **Structural Entropy Audit**: ファイル行数が 300行 を超えた時点でアラート。ロジック（hooks）と UI（components）が分離されているかを確認。
    2. **State Surface Mapping**: 全ての `useState` 宣言をリストアップし、それらが「特定のエンティティ（例：1つのショート動画カード）」に限定されているか、グローバルなモーダル全体を揺らしているかを特定。
    3. **Action Atomicity Check**: `Approve` や `Feedback` などのアクションが、専用の API クライアント（`api-client.ts`）を介して行われ、成功時に最小限の範囲でステートが更新（Optimistic Update）されているか。
    4. **Hook-Component Contract Verification**: カスタムフック（`useReviewShorts` 等）が返すインターフェースが、子コンポーネント（`ShortCard` 等）が必要とする最小限の PropSet と一致しているか。
- **Benefit**: 基盤のシンプルさを維持し、機能追加（高度なテロップ編集など）を「周辺（Leaf）」の小コンポーネントの追加だけで完遂可能な、120% 拡張性の高いアーキテクチャを保証する。

---
*Updated: 2026-02-06*

## Phase 17: Reactive State Sync Audit (Polling & Callback Verification)

非同期のバックグラウンド処理（レンダリング等）の完了が、ポーリングループとコールバックを介して UI に即座に反映されることを検証するパターン。

- **The Problem**: サーバー側で処理が完了しても、クライアント側のステートが古いまま（Stale State）だと、ユーザーは完了に気づかず手動リロードを強いられる。また、ポーリングが冗長なネットワーク負荷（Over-fetching）や、意図しない無限ループを引き起こすリスクがある。
- **Verification Logic**:
    1. **Polling Cycle Trace**: 開発者ツールの Network タブまたは `browser_subagent` の監視により、期待される間隔（例：5秒毎）でステート取得 API（`/projects/{id}/queue` 等）が呼ばれているかを確認。
    2. **State Shift Capture (The "Wait-and-Check" Pattern)**:
        - 処理を開始（例：Approve ボタン押下）。
        - 進行状況（0% -> 50% -> 100%）の遷移を監視。
        - 100% 完了の瞬間に **「手動リロードなし」** で関連 UI（DLボタンの出現、件数表示のカウントアップ）が更新されるかを実機でアサーション。
    3. **Fire-Once Guard Verification**: タスク完了ごとのコールバック（`onTaskCompleted`）が、同一の完了タスクに対して複数回実行されず、かつ「新規完了」のタイミングで確実に一度だけ実行されているか（`completedIds` 等の Set による重複排除ロジック）をログまたは挙動で確認。
    4. **Context Access Audit**: コールバックが親コンポーネントの再取得関数（`refetch`）に確実にアクセスできているか（`Suspense` 境界や階層構造の妥当性）を検証。
- **Benefit**: バックグラウンド処理とフロントエンドの「時間的断絶」を解消し、手動リロードという摩擦のない、シームレスな制作体験（Pattern 112: Reactive Asset Refresh）を保証する。

---
*Updated: 2026-02-06*

## Phase 18: Deliverable Parity Audit (Draft vs Final Verification)

開発・プレビュー環境（Draft）では正常に見える機能が、本番書き出し（Final Deliverable）において消失または破損する現象を検知・防止するための検証パターン。

- **The Problem**: プレビュー用の軽量レンダリングと配布用の高品質レンダリングでロジックや実行環境（プロセス分離、フォント解決ルール等）が異なると、「プレビューでは完璧だったのに、ダウンロードしたらテロップが消えている」といった致命的な不具合が発生する。
- **Verification Logic**:
    1. **Visual Parity Comparison**: ドラフト動画（`_draft.mp4`）で確認された視覚要素（テロップ、レイヤー）が、ダウンロードした最終成果物においても、同一の座標・タイミング・スタイルで保持されているかを実機でアサーションする。
    2. **Isolated Process Environment Audit**: レンダリングが独立したプロセス（`subprocess` 等）で実行される場合、そのプロセスが親プロセスと同一の外部依存関係（フォントパス、ライブラリ、シークレット）にアクセスできているかを確認。特に `fontfamily` ではなく `fontfile` による絶対パス指定など、環境に依存しない解決策が採用されているかをチェック。
    3. **Silent Failure Detection**: FFmpeg 等の外部コマンドがエラーコードを返さず、標準エラー出力にのみ警告（例：`Font not found, using default`）を出すケースがあるため、ワーカープロセスのログレベルを上げ、描画失敗の兆候を積極的にスキャンする。
- **Benefit**: 制作フローの最終出口における「期待値の裏切り」をゼロにし、プロフェッショナルな映像制作プラットフォームとしての信頼性を 120% 担保する。
 
---
*Updated: 2026-02-06 (Round 2)*
 
## Phase 19: Cross-Process Data Integrity Audit
 
複数の独立したプロセス（API, Worker, Subprocess）が同一のデータソース（JSONファイル等）を参照する場合、各プロセスが「その機能に必要な全てのフィールド」を確実に読み込めているかを検証するパターン。
 
- **The Problem**: 
    1. **Partial Hydration**: 一方のプロセスが ORM/Repository を介してデータをロードし、もう一方が生の JSON をパースする場合、フィールドの欠損や名称の不一致（例: `text` が `telop_text` になっている等）が発生し、一見正常に動作しているように見えて特定の機能（テロップ描画等）だけがサイレントに失敗する。
    2. **State Lag**: UI 側の変更がディスクに書き込まれる前にワーカースクリプトが起動されると、古い状態（Stale State）でレンダリングが実行されてしまう。
- **Verification Logic**:
    1. **Shadow Context Logging**: ワーカープロセス側で、レンダリング直前の「生のデータコンテキスト（使用される全パラメータ）」をログ出力させ、API 側が保持している最新の状態と比較する。
    2. **Field Presence Assertion**: レンダラーなどの重要コンポーネントにおいて、必須フィールド（例: `timeline[i].text`）が空の場合、単にスキップするのではなく「データ不足」として早期にエラーまたは警告を発報するガードレールを設ける。
    3. **Write-to-Launch Sequencing**: 保存（Save）アクションと実行（Trigger）アクションの間に、ファイルシステムのリフレッシュ（または適切な待機/フラッシュ）が介在しているかをコード監査する。
- **Benefit**: 分散システムにおけるデータの「情報の非対称性」を排除し、全プロセスが同一の意図（Intent）を共有して動作することを保証する。

### **Case Study: The Missing Telop Mystery (Pattern 177 Verification)**
2026-02-06に発生した「プレビューでは出るが、DL動画ではテロップが消える」現象の特定と解決。
1. **Root Cause A: Guard Clause Mismatch**: API（Dashboard）側ではテロップ情報が `timeline` フィールドに保持されていたが、レンダリングワーカーが期待していた `telop_config` フィールドが一部のプロジェクトで欠落（Null）していた。描画コードが `if telop_config:` を全体の入口としていたため、実データ（テキスト）があるにも関わらずスキップされた。
2. **Root Cause B: Temporal Data Incompleteness (Pattern 184)**: 一部のタイムラインセグメントにおいて `duration` フィールドが `null` であった。Pydantic モデルの `@property` が JSON シリアライズ時に失われる特性に起因し、`current_time + None` という計算不能な状態に陥り、持続時間 0 秒のテロップが生成されていた。
3. **Root Cause C: Intermittent Deliverable Parity (Pattern 185 Diagnostics)**: `short_1` では成功し `short_2` では失敗するという不規則な現象を、FFmpeg フィルタスクリプトの末尾にある `[outv_pre_telop]null[outv];` という「ラベルのバイパス」シグナルから特定。
4. **Root Cause D: The "Shadow Success" Log Truncation (Pattern 202 Expansion)**: FFmpeg の `stderr` をログに記録する際、バッファサイズの制限（1000文字等）により、後半に出力される「アセット読み込み失敗（No such file or directory）」メッセージが切り捨てられ、config情報のみが記録されていたことが判明。
5. **Definitive Error Identified**: `subprocess.run` を介さず同じバイナリを直接実行した結果、`[Parsed_movie_5 @ ...] Failed to avformat_open_input ... Error : No such file or directory` というエラーが特定された。
6. **The Lesson**: データの「存在証明（Has Content?）」、「装飾属性（Style Config?）」、「演算属性（Temporal Metrics）」、および「シリアライズ特性（Property Loss）」をそれぞれ独立したガードまたはフォールバックで管理しなければならない。
7. **Resolution (The Final Piece - Pattern 204)**: ソース動画が 1920x1080 (16:9) で、出力が 606x1080 (9:16 Crop) の場合、PNG生成を 1080x1920 で行うとテキスト (Y=1500) が画面外になる。`ffprobe` でソースの `src_height` を取得し、それをベースにクロップ計算を行い、1080x1920 ではなく **606x1080** で PNG を生成することで、座標の整合性を回復し問題を解決した。
8. **Diagnostic Persistence Pattern**: 調査中、一時ファイル（PNG）の `p.unlink()` を一時的に無効化し、FFmpeg 実行コマンドを `/tmp` 等に書き出して独立して再現テストを行うことで、非同期実行時のタイミング問題（レースコンディション）を確実にあぶり出す手法を確立。

### **Phase 20: Environmental Stability Audit (Pattern 180)**
長時間の非同期処理や外部バイナリ（FFmpeg）依存のワークフローにおいて、リソース競合やデッドロックが発生しないかを多角的に検証する。
- **Pipe Saturation Check**: `subprocess` 呼び出しにおいて `stderr=PIPE` などが原因でバッファが溢れ、処理がハング（タイムアウト）しないかを確認。
- **Zombie Process Audit**: レンダリング中断時やワーカー異常終了時に、子プロセス（ffmpeg）が孤立して残り、ポートやメモリを占有し続けないかを確認。
- **I/O Resilience**: SSD 外部ドライブなど、OS レベルの I/O 遅延が発生しやすい環境においても、`nohup` やバックグラウンド分離が機能し、セッション切断によって処理が中断されないかを検証。
- **Benefit**: コードが数学的に正しくても、実行環境の特性によって発生する「100%未満の不確実性」を排除し、24時間365日の安定稼働を実現する。

---
*Updated: 2026-02-06 (Round 3)*

## Phase 21: Runtime Path & Bytecode Integrity Audit (Pattern 198/200)
デタッチされたバックグラウンドプロセスにおいて、コード変更が反映されない「シャドウイング（Shadowing）」や、実行時の物理パスが意図と異なる問題を排除するパターン。

- **Verification Logic**:
    1. **Absolute Path Probe**: `os.path.abspath(path)` をログに出力し、期待される一時ディレクトリ（`TEMP_DIR` 等）と物理的な書き込み先が一致しているかを確認。
    2. **Bytecode Purge Audit**: コード変更後にレンダリング結果が変わらない場合、`__pycache__` の削除とゾンビプロセスの `kill -9` を強制。
    3. **Artifact Freshness**: 生成された中間ファイル（`filter.txt` 等）のタイムスタンプが、現在のジョブ開始時刻より後（Newer-than-Job）であることを確認。

## Phase 22: Deliverable-Agnostic Verification (Pattern 199)
UI 上のプレビュー（HTML/JS 表現）と、最終的な成果物（MP4/Binary 表現）の不整合を排除するための検証パターン。

- **Verification Logic**:
    1. **Direct File Inspection**: フロントエンドの UI を通さず、成果物を直接 URL（`http://.../*.mp4`）で開き、シークバーでの目視確認（ブラウザサブエージェント等）を実施。
    2. **Burn-in Audit**: テロップが HTML 要素（オーバーレイ）ではなく、動画のピクセルデータそのもの（焼き込み）として存在するかをアサーションする。
    3. **External Asset Integrity Audit (Pattern 201)**: FFmpeg のフィルタグラフで使用される外部アセット（PNGオーバーレイ等）が、実行時点でディスク上に物理的に存在し、かつそれらが「古いレンダリングの残骸」でないことをタイムスタンプおよびパスの UUID 照合で確認。

    3. **The "Shadow Success" Guard**: レンダリング完了後に一時ファイルを削除する前に、その一時ファイル（PNG等）が FFmpeg インスタンスによって「実際にオープン/使用された」ことをタイムスタンプや inode レベルで検証する。

## Phase 24: The Dimensional Parity Gate (Pattern 204)
複数のアセット（動画、透過PNG等）を合成する際、生成されるアセットのキャンバスサイズが、合成対象の動画ストリームの物理解像度と一致しているかを検証するパターン。

- **The Problem**: 
    1. **Off-Screen Projection**: テロップ用 PNG が 1080x1920 (9:16) で生成されているが、出力動画が 606x1080 (9:16 Crop) である場合、絶対座標 (Y=1500 等) で配置されたテキストは画面の外に追い出され、視覚的に消失する。
    2. **Success Illusion**: FFmpeg は「存在しない位置に画像を置いた」としてもエラーを出さない。

- **Verification Logic**:
    1. **Source Discovery**: `ffprobe` 等で入力ソースの解像度を抽出し、フィルタ（`crop` 等）適用後の最終解像度を計算。
    2. **Layout Context Awareness**: テンプレート（PSDデザイン等）が適用されているかを確認。テンプレートあり＝デザインキャンバスサイズ、テンプレートなし＝計算されたクロップサイズ、という「レンダリング文脈」に応じたターゲット解像度を決定する。
    3. **Asset Constraint Assertion**: `generate_text_image` 等のアセット生成関数に、決定された「文脈依存の解像度」を厳密に受け渡しているかを確認。
    4. **Canvas Aspect Matching**: アスペクト比が同一（9:16）であっても、解像度（DPI/Scale）が異なれば座標が破綻することを前提に、常に 1:1 のピクセル対応を保証する。

- **Benefit**: レイアウト情報の論理的な正しさだけでなく、バイナリレンダリングにおける物理的な視認性を 120% 担保する。
 
## Phase 25: The Visual Presence Gate (Pattern 205)

論理的な「成功（Exit Code 0）」や「存在（File Exists）」、さらにはブラウザエージェントによる「DOM/ログ上の成功確認」すら超えて、人間の目に「期待通りに映っているか」を最終防衛線とするパターン。

- **The "Invisible Presence" Problem**: 
    - ブラウザサブエージェントが「テロップは表示されている」と報告（False Positive）しても、実際には y 座標のバグで画面下端に 1px だけ残っていたり、ロゴの裏に隠れている場合がある。
    - **Case Study (2026-02-06)**: 1080x1920 のキャンバスサイズ（Pattern 204）へと修正したが、テロップが依然として不可視であった。原因は二段構えであった：
        1. **Coordinate Conflict**: 描画 y 座標がテンプレート指定（y=1146）ではなくデフォルト値（y=1600）であったため、ロゴの背後に隠蔽された。
        2. **Scaling Regression**: トリムループ（各クリップ。ソースサイズ 1920x1080）で適用されたオーバーレイが、テンプレート合成時の「プレースホルダーへのスケーリング（1080x610）」によって極端に小さくなり、視認不能となった。

- **Verification Logic**:
    1. **Direct Binary Inspection**: フロントエンドのステートや API のレスポンスを信じず、OS 層から生成された MP4 ファイルを直接開き、特定のフレーム（テロップが表示されるはずの時間）をキャプチャする。
    2. **Multi-Point Visual Sampling**: 単一のフレームではなく、動画全体からランダムに 3 箇所以上をサンプリングし、テロップの「読みやすさ」「色」「位置」を人間の視覚、または高度な Vision LLM で最終監査する。
    3. **Coordinate-Logic Parity**: レンダリングエンジンの「デフォルト位置」と、テンプレートエンジンが定義する「指定位置」に乖離がないかをコードレベルでクロスチェックする。

- **Benefit**: 「技術的には完成しているが、現実には使えない」というユーザー体験の断絶を 100% 回避する。

## Phase 26: State Divergence Audit (Pattern 206)

UI 上の選択（表示）と、バックエンドで実行されるジョブのパラメータ（実行コンテキスト）の乖離を特定・排除するパターン。

- **The Problem**: 
    - **Sticky Parameters**: フロントエンドの「テンプレートなし」という選択が API リクエストに反映されず、バックエンドが古いステートやデフォルト値を使用してしまう。
    - **Visual Deception**: UI 上では「なし」になっているが、内部的なステートオブジェクトには ID が残っている。

- **Verification Logic**:
    1. **Egress Request Audit**: `browser_subagent` のコンソールログやネットワークトレースをスキャンし、`approve` や `export` 時に送信されるペイロード（`template_id` 等）が UI の最新の選択と 1:1 で一致しているかを確認。
    2. **State Context Validation**: バックエンドの実行ログにおいて、受け取ったパラメータがプロジェクト保存値（Project Defaults）を正しく上書きしているかを確認。
    3. **"None" Explicitly Pass**: "No selection" が「フィールドの欠落」として扱われるとバックエンドがデフォルトを採用してしまうため、明示的に `null` や `"none"` を送信し、かつバックエンドがそれを「機能の無効化」として解釈するかを検証。

- **Benefit**: 「ユーザーの意図（Intent）」と「システムの実行（Execution）」の不一致による混乱と手戻りをゼロに抑える。

## Phase 27: Logic Parity Audit (Pattern 208)

フロントエンドのブラウザベースのプレビュー（React/SVG/HTML）と、バックエンドのバイナリ生成エンジン（FFmpeg/Python）の表示ロジックを極限まで同期させ、エクスポート後の「期待外れ」を防止するパターン。

- **The Problem**: 
    - **Platform Divergence**: ブラウザの `textAlign: center` と FFmpeg の `drawtext` では、テキストの幅計算やオフセットの扱いが微妙に異なる。
    - **Coordinate Drift**: プレビューで見ているアスペクト比と、実際に合成される動画のアスペクト比の僅かな差により、テロップの相対位置がズレる。

- **Verification Logic**:
    1. **Structural Mirroring**: プレビューコンポーネントの `props`（fontSize, fontFamily, fill）と、レンダラーの `drawtext` パラメータが同一のソース（Blueprint）から生成されていることを確認。
    2. **Coordinate Expression Audit**: 静的な座標値ではなく、` (w-text_w)/2 ` のような動的な FFmpeg 式を用いることで、解像度やアスペクト比の変化に対してプレビューと同等の幾何学的整合性を保つ。
    3. **Font Cache Parity**: UI が使用するウェブフォントと、サーバーが解決するシステムフォントパス（Pattern 207）が等価であることをフォントマッピングテーブルで検証。

- **Benefit**: 「プレビューは完璧だったのに、ダウンロードしたら台無し」という、プロ仕様のツールにおける致命的な信頼性欠如を排除する。

## Phase 28: Coordinate Scaling Parity Audit (Pattern 209)

デザイン時（固定キャンバス）の座標と、実行時（可変解像度）の物理解像度の不一致に起因する「不可視の成功（Invisible Success）」を防止する検証パターン。

- **The Problem**: 
    - **Resolution Mismatch**: 編集 UI では 1080x1920 のキャンバスを使用しているが、実際の動画生成ではソースの解像度やクロップ設定により、これより小さい（例: 606x1080）解像度で出力される。
    - **Out-of-Bounds Rendering**: デザイン時の座標（Y=1500）がそのまま出力解像度（高さ 1080px）に適用されると、要素は画面外に描画され、FFmpeg はエラーを出さないため発見が遅れる。

- **Verification Logic**:
    1. **Dynamic Ratio Validation**: `output_height / design_height` の比率（Scale Factor）が正しく算出され、座標（Y）およびフォントサイズに適用されているかを確認。
    2. **Telemetry Probe Proof**: 実際に FFmpeg に渡されるフィルタ文字列内の `y` パラメータが、`output_height` を超えていないことをランタイムログでアサーションする。
    3. **Sub-pixel Position Matching**: スケーリングが行われた後でも、画面端からの相対距離（％）がプレビューと等価であることを目視またはピクセル監査（Pattern 205）で検証。

- **Benefit**: 解像度の異なる多様なデバイスや出力設定においても、クリエイターの意図したレイアウトを 120% 確実に再現する。

## Phase 29: Arithmetic Overflow & Halo Audit (Pattern 211)

エクスポートされたバイナリにおいて、テロップ等の要素が「二重に描画されている」「文字が重なって見える（Ghosting/Halo）」といった質感の異常を検知するパターン。

- **The Problem**: 
    - **Logic Overlap (RESOLVED Feb 2026)**: テンプレート合成処理（CAPTION レイヤー）または汎用テロップ処理が、トリミングループ内のレガシーな PNG オーバーレイ処理と重複して実行され、文字が 2 重に焼き込まれる。
    - **Scaling Saturation**: フォントサイズやストローク幅（borderw）をスケーリングした際、FFmpeg のレンダラーが文字間のカーニングを維持できず、太い縁取り同士が衝突して「文字化け」に近い滲みが発生する。
- **Verification Logic**:
    1. **Opacity/Saturation Audit**: スクリーンショットの色値を解析し、期待される色（#FFFFFF 等）よりも「濃い」または「滲んでいる」現象を検知する。
    2. **Filter Chain Graph Inspection**: FFmpeg に渡される最終的なフィルタ文字列 (`filter_complex`) をスキャンし、同一のテキスト内容を持つ `drawtext` インスタンスが複数存在しないかを確認。
    3. **Variable Stroke Verification**: 座標スケーリング（Pattern 209）適用後、`borderw`（縁取り）の値が文字の輪郭を破壊するほど巨大（例：フォントサイズの 20% 以上）になっていないかをチェック。
- **Benefit**: 視認性（Visible）だけでなく、プロ仕様の動画としての「質感（Texture）」の整合性を 120% 保証する。

## Phase 30: Multi-Path Rendering Audit (Pattern 213)

複雑なメディアパイプラインにおいて、複数の独立した描画ロジック（レガシー、スタンドアロン、テンプレート）が干渉し、同一要素が重複して描画（Double Burn-in）されていないかを検証するパターン。

- **The Problem (RESOLVED Feb 2026)**: 
    - **Shadow Rendering**: 新機能（テンプレート）を実装した際、既存の描画ロジックが暗黙的に走り続け、意図しない場所に二重に要素が表示される。
    - **Logic Leakage**: テンプレート内のレイヤーとして管理されているテロップが、テンプレート外の汎用テロップ描画ループによっても処理され、フォントや位置の異なる「ゴースト」が発生する。
- **Verification Logic**:
    1. **Constraint Validation**: システム内で `template_id` が有効な場合、汎用的な描画関数（standalone_drawtext 等）がスキップされているかをコード監査またはデバッグログで確認。
    2. **Composition Difference Audit**: テンプレートなしとテンプレートありの出力を比較し、テンプレートありの場合にのみ存在するはずের特定座標以外の場所に、テキストが描画されていないかをピクセル単位でスキャン。
    3. **Filter Chain Graph Inspection**: 同一のタイムラインセグメントに対して、複数の `drawtext` フィルタが累積的に適用されていないかをチェック。
- **Benefit**: 描画ロジックの「排他管理」を徹底することで、レイアウト崩れや無駄なレンダリングコストを排除し、120% の視覚的一致を保証する。

---
*Updated: 2026-02-06*

## Phase 31: Verification Symmetry & Target Parity (Pattern 215)

エージェントが行う自動検証（browser_subagent 等）の対象と、ユーザーが実際に観測・操作している対象（ファイル、ジョブ ID、UI 上のインデックス）が完全に一致しているかを検証するパターン。

- **The Problem**: 
    - **Target Drift**: エージェントが「Short #1」のバグを修正し、その成功を確認したつもりでも、UI インデックスと API インデックスのズレ（Off-by-one）により、ユーザーが実際に見ている「Short #1」は修正されていない「Short #0」である場合がある。
    - **Success Hallucination**: 特定の URL（パラメータ付きなど）での表示確認には成功するが、それが「システム全体への修正適用」を意味しない。キャッシュや古いバイナリを誤って検証してしまう「偽陽性の成功」。

- **Verification Logic**:
    1. **Index Parity Audit**: UI 上の表示インデックス（1-based）と、API のペイロード（0-based）の対応関係を明示的にログ出力し、対象がズレていないかを確認。
    2. **Unique Identifier Locking**: 検証対象をファイル名やインデックスではなく、UUID（Job ID）で一意に特定し、その UUID に紐付くバイナリのみを検証。
    3. **Ambient Verification**: 特定の「成功したはずのファイル」を見るだけでなく、ダッシュボード全体をリロードし、隣接する要素への副作用や「修正が元に戻っていないか（Regression）」を確認。

- **Benefit**: 検証プロトコルそのものが抱える「盲点」を排除し、ユーザーが体験する現実とエージェントが報告する「成功」の 120% の同期を保証する。
 
+## Phase 32: The Path Resolution Desync (Pattern 216)
+
+エージェントのシェル環境でのファイルパス解決と、Web サーバー/ブラウザ環境でのパス解決が乖離し、存在しないはずのファイルに「成功（200 OK）」と誤認する、またはその逆が発生するパターン。
+
+- **The Problem**: 
+    - **Phantom Files**: `http://localhost:8000/.../video.mp4` は 200 OK で再生できるが、`ls /path/to/video.mp4` はエラーを返す。エージェントは存在確認ができずデバッグが停滞し、ユーザーは「プレビューと違う」と不満を持つ。
+    - **Path Shadowing**: ポータブル SSD のマウントポイント（`/Volumes/PortableSSD`）の変動や、ファイル名の Unicode 正規化（NFC/NFD）の不一致により、API ログ上のパスが物理的にアクセス不能になる。
+
+- **Verification Logic**:
+    1. **Physical Trace Audit**: ログ上のパスを鵜呑みにせず、`find` や `realpath` を用いて、現在のマウントポイントにおけるメディアファイルの「物理的な居場所」を再探索する。
+    2. **URL-Encoding Parity Check**: パスに含まれる日本語や特殊文字が、API の StaticFiles マウントロジックによってどのように正規化されているかを検証。
+    3. **Pre-Response Check**: `notify_user` や `browser_subagent` で成功を確信報告する前に、シェル環境で `ffprobe` や `ls -l` を実行し、バイナリの「物理的な読み取り可能性」をアサーションする。
+
+- **Benefit**: 環境の「外れ値（マウントズレ、エンコーディング）」に惑わされない、堅牢な検証プロセスを確立する。
 
+## Phase 33: Trace-Driven Boundary Verification (Pattern 218)

ステート（JSON、データベース）は正しいが実行結果が誤っている場合に、コード内の条件分岐（境界条件）における変数の値を強制的にログ出力し、実行時の真のステートを物理的に検証するパターン。

- **The Problem**: 
    - **Branch Hallucination**: プロジェクトファイルを確認すると `template_id` が存在するのに、レンダリング結果には反映されない。エージェントは「ファイルが正しいからコードが悪い」とループに陥るが、実際には実行時のオブジェクトが期待と異なる。
    - **Condition Lying**: `if blueprint.template_id:` がなぜか `False` になっているという事実に、ログがなければ辿り着けない。

- **Verification Logic**:
    1. **Mandatory Guard Injection**: 疑わしい `if` 文の直前に、その評価対象となっている全変数を `logger.info("[DEBUG] ...")` で出力する。
    2. **Log-Artifact Matching**: ログに出力された実行時の値と、ディスク上のステートファイルを突き合わせ、インスタンス化プロセスの欠陥（デシリアライズ漏れ等）を特定する。
    3. **Worker-Process Isolation Audit**: 異なるプロセス（UVicorn vs RenderWorker）で同一ファイルを参照している場合、一方の変更が他方に反映されるまでのタイムラグやマウントの同一性を検証する。

- **Benefit**: 「推測」ではなく「観測」に基づいてバグの本質（ステートの同期不全）を突き止め、不毛なコード修正の繰り返しを回避する。

## Phase 34: Multi-Process Evidence Trail (Pattern 219)

非同期キューやサブプロセスを利用したマルチプロセス環境において、特定のプロセスで発生したイベントやエラーがメインのログストリームから消失（Isolation）し、実態の見えない「幻影（Phantoms）」となる問題を防ぐパターン。

- **The Problem**: 
    - **Vanishing Logs**: `renderer.py` にデバッグ行を追加しても、`backend.log` に一切出力されない。エージェントは「コードが通っていない」と誤認するが、実際には別プロセス（RenderWorker）で実行されており、その標準出力がどこにも記録されていない、あるいは別の物理ファイルに書き出されている。
    - **Process Context Blindness**: メインプロセス（API）から見た「成功」が、サブプロセスの「沈黙」によって偽装される。

- **Verification Logic**:
    1. **Process Tree Audit**: `ps aux` や `lsof` を用いて、実際にレンダリングを実行しているバイナリ（`python render_worker.py` 等）の有無と、その PID を特定する。
    2. **Redirection Audit (The DEVNULL Trap)**: `subprocess.Popen` や `run` の呼び出し箇所（例: `render_queue.py`）を静的解析し、`stdout=DEVNULL` や `stderr=DEVNULL` が指定されていないか確認する。これが指定されている場合、コード内の `logger` 出力や `print` は物理的に消失する。
    3. **Ambient Log Sweeping**: `/tmp` やプロジェクトディレクトリ内の隠しログファイルを `find` で網羅的に検索し、「はぐれたログ」を回収・結合（Union Log）して分析する。

- **Benefit**: 多層化・分散化されたメディアパイプラインにおいて、エンドツーエンドの「証拠の鎖（Chain of Evidence）」を維持し、ブラックボックス化を 120% 排除する。
 
## Phase 35: Physical Metadata Audit (Pattern 220)

出力ファイルが存在し、かつ「成功」とマークされているが、視覚的・内容的に期待と異なる（例：テンプレートが消えている）場合に、ファイルの「メタデータ」を物理的に検証して論理パスの通過を証明するパターン。

- **The Problem**: 
    - **The Transparent Success**: レンダリング結果が 1080x1920 (テンプレートサイズ) であるべきなのに、見た目がフル画面の元動画に見える。エージェントは「テンプレートが適用されていない（＝コードが実行されていない）」と推測しがちだが、実際には「適用されたが合成順序が誤っている」場合がある。
    - **Visual Hallucination**: ブラウザ上の縮小プレビューでは解像度の違いに気づけず、単に「テンプレートがない」という抽象的な失敗として報告してしまう。

- **Verification Logic**:
    1. **Resolution Probe**: `ffprobe` を用いて、出力ファイルの正確な `width` と `height` を取得する。これが標準サイズ (606x1080) かテンプレートサイズ (1080x1920) かを確認。
        - **1080x1920 の場合**: テンプレート適用ロジック（コードの主要ブランチ）は間違いなく通過している。問題はデータの伝搬ではなく、**合成（レイヤー配置）**にある。
        - **606x1080 の場合**: テンプレート適用ロジックがスキップまたは例外でフォールバックしている。
    2. **Bitrate & Sampling Audit**: テンプレート合成により画像レイヤーが追加された場合、ファイルサイズやビットレートの特性が変化する。期待される「複雑度」の変化を確認する。

- **Benefit**: 「実行されたかどうか」と「正しく描画されたか」を切り分け、デバッグの焦点を「ステート（ID）」から「アルゴリズム（フィルタ）」へと即座にシフトできる。

## Phase 36: Filter Graph Forensic Dump (Pattern 221)

ログの消失（Phase 34）と視覚的な遮蔽（Phase 35）が同時に発生した場合に、プログラムが生成した最終的なコマンドライン引数やスクリプトを「外部ファイル」に強制出力（ダンプ）して検証するパターン。

- **The Problem**: 
    - **The Telemetry Void**: サブプロセスが `DEVNULL` にリダイレクトされているため、コード内の `print` や `logger` が一切機能しない。
    - **The Logic Mirage**: 実行結果（MP4）は生成されるが、なぜ特定のレイヤーが欠損しているのかをコードを眺めるだけでは特定できない。

- **Verification Logic**:
    1. **Persistence Injection**: フィルタ文字列を結合して FFmpeg に渡す直前のコードに、`with open("/tmp/debug.txt", "w") as f: f.write(...)` を追加する。
    2. **Z-Order Reconstruction**: ダンプされた `filter_complex` を解析し、入力ソース、スケールフィルタ、オーバーレイ座標、およびラベルの連鎖を物理的に追跡する。
    3. **Artifact-Graph Mapping**: 使用されているソースファイルのパス（background.png 等）が実際に存在し、かつ正しい順序で overlay されているかを確認する。

- **Benefit**: 実行時の「ブラックボックス」を排除し、生成された複雑なメディアロジックを静的ファイルとして 100% 確実に検証できる。

## Phase 37: Out-of-Band Frame Export (Pattern 222)

ユーザーが報告する「変化がない」という主観的なフィードバックと、サーバー上の「成功」という客観的なステートの間にブラウザキャッシュという壁がある場合に、キャッシュをバイパスしてサーバー上の真の姿を強制的に視覚化するパターン。

- **The Problem**: 
    - **The Cache Hallucination**: ブラウザが古い動画ファイルをキャッシュしているため、ユーザーは何度リロードしても「テロップが適用されていない」と誤認する。
- **Verification Logic**:
    1. **Direct Frame Extraction**: ブラウザを介さず、サーバー側で `ffmpeg -i file.mp4 -frames:v 1 /tmp/frame_check.png` を実行して、出力動画の物理的な断面（フレーム）を画像として書き出す。
    2. **Side-by-Side Validation**: 書き出した画像をエージェント経由でユーザーに提示、またはエージェント自身が Vision 機能で解析し、テンプレートやスタイルの存在を直接証明する。
- **Benefit**: 「見ているものが正解ではない」というキャッシュの罠を 120% 無効化し、デバッグの焦点をサーバー側の実装のみに絞り込める。

## Phase 38: Status Persistence & Payload Sync Audit (Pattern 223/228)

UI 上での「設定」が実際には永続化層（DB/JSON）に到達しておらず、レンダリング時にデフォルト値に回帰してしまう「保存漏れ」や、保存タイミングと実行タイミングの「同期ズレ（Persistence Latency）」を特定・排除するパターン。

- **The Problem**: 
    - **The Default Trap (Pattern 223)**: ユーザーがテロップスタイルを「basic」に変更したつもりでも、プロジェクトファイルを確認すると `telop_config: None` になっている。
    - **The Persistence Gap (Pattern 228)**: UI での「最新の編集」がサーバーに保存される前に「Approve」がクリックされると、古いスタイルでレンダリングされてしまう。

- **Verification Logic**:
    1. **Request Body Inspection**: `handleApprove` 時のネットワークリクエストを `browser_subagent` で監視し、UI の最新ステート（`telopStore`）が **API リクエストボディに直接同梱（Payload Injection）** されているかを確認。
    2. **Pre-Launch Persistence Check**: レンダリングプロセスが起動する「直前」のログまたはプロジェクトファイルをスキャンし、リクエストで送られたペイロードが `project.json` に正しくフラッシュ（Override）されているかを検証。

- **Benefit**: 「保存」と「実行」を API リクエストレベルでアトミックに結合することで、120% の視覚的一致（WYSIWYG）を保証する。

## Phase 39: Service-Route Integrity Audit (Pattern 232)

コード上の実装（API エンドポイント）と、検証エージェントが想定するアクセスパス（URL ルート）の乖離による「幻影の失敗（Phantom 404/Null）」を排除するパターン。

- **The Problem**: 
    - **Route Hallucination**: エージェントが `/health` や `/projects/list` へのアクセスを試みるが、実際には実装されていない（または名称が異なる）ために 404 となり、システムがダウンしていると誤認する。
- **Verification Logic**:
    1. **Service Map Audit**: API 実装ファイル（`api.py` 等）を直接 `grep` し、現在実際に有効なエンドポイント（`@app.get(...)`）のリストを作成。
    2. **Endpoint Parity Check**: 検証ステップで使用する URL が、ステップ 1 で特定した実エンドポイントと 1:1 で一致しているかを確認。
    3. **Boot-Up Sequence Validation (Pattern 230)**: サービス再起動直後の 404/Connection Error が「実装ミス」か「起動遅延（Nohup Startup Latency）」かを、数秒おきの継続的プローブで切り分ける。

- **Benefit**: 検証プロトコルが「空想の仕様」に依存するのを防ぎ、実在するインターフェースに基づいた 120% 正確な環境診断を実現する。

## Phase 40: Visual Ground-Truth Verification (Pattern 233)

ログや API レスポンスといった「技術的な成功指標」と、生成された成果物の「視覚的な実態」の乖離（Success Hallucination）を排除する、FBL の最終防衛線。

- **The Problem**: 
    - **Technical Success Mirage**: サーバーは 200 OK を返し、ログには「スタイル適用済み」と記録されているにもかかわらず、実際に出力された動画内ではデフォルトのスタイル（白色など）が使用されている。
    - **Root Cause**: データの到達（Persistence）は成功しているが、レンダリングエンジンの深部で属性名の不一致（fill vs color など）によりデフォルト値にフォールバックしている。
- **Verification Logic**:
    1. **Direct Asset Inspection**: 技術ログのみに依存せず、`ffmpeg` などを用いて成果物（mp4）から特定のタイムスタンプのフレームを静止画（png）として抽出する。
    2. **Vision-Based or Manual Parity Check**: 抽出した画像の色情報やレイアウトを、Vision AI または人間が確認し、指定したスタイル（例：黄色 #ffc800）が物理的に反映されているかを検証する。
    3. **Attribute-Level Trace**: 視覚的な不一致が確認された場合、レンダラー内部での「キー名のマッピング」を疑い、テンプレート設定と動的ペイロードの属性名を照合する。

- **Benefit**: 「動いているように見えるが正しくない」というサイレント・フェイラを 120% 撲滅し、ユーザーの期待値と最終成果物の完全な同期を保証する。

## Phase 41: Post-Transactional Persistence Audit (Pattern 234 / Pattern 252)

ハイレベルな抽象化レイヤー（ORM や Pydantic モデル）による、下層（物理ファイル/DB）への意図しない「上書き（Wipe-out）」を検知する検証パターン。

- **The Problem (Pattern 252: Post-Persistence Sidechannel Sync)**:
    - **The Shadow Overwrite**: あるステップでデータを物理ファイルに保存（Patch）しても、その直後に別のハイレベルな関数（`save_project` 等）が古いメモリ上のオブジェクトを使ってファイルを保存し直すと、先行する Patch（特に Pydantic モデル外の `telop_config` 等）が完全に消失する。
    - **Success Hallucination**: 手前のステップのログには「保存成功」と出るため、開発者は後続のステップ（レンダラー等）に原因があると誤認し、デバッグが迷走する。
- **Verification Logic**:
    1. **Terminal-Point Inspection**: 単に「保存関数が呼ばれたこと」を検証するのではなく、一連のアクション（API エンドポイントの処理等）が **完全に終了した直後** の物理的なディスク状態を `cat` または `ls` で最終確認する。
    2. **Context-Persistence Delta Audit**: Pydantic モデルに含まれない「拡張フィールド（Extensible fields）」を扱っている場合、それらを手動で再注入・再保存するロジックが正常に完了し、かつ後続の保存処理によって塗りつぶされていないかを重点的にチェックする。
    3. **Order of Operation Trace**: ログを時系列で分析し、`Manual Patch` -> `Automated Save` という順序で実行されていないか（逆であるべき）を確認する。

- **Benefit**: 抽象化の裏側で発生する「データの蒸発」を 100% 捕捉し、マルチレイヤーな永続化戦略における整合性を保証する。

## Phase 42: Inter-Process State Integrity Audit (Pattern 235/236)

メインプロセスからバックグラウンドワーカー（別プロセス）へ情報を引き継ぐ際、共有ファイル（Project JSON 等）の「同期タイミング」に依存する脆さを排除するための検証パターン。

- **The Problem**: 
    - **The Shared-File Lottery**: メインプロセスがファイルを保存した直後にワーカーを起動しても、OS レベルのフラッシュ遅延やワーカー側の先行読み込みにより、ワーカーが「古い（または不完全な）」データを参照してしまう。
    - **Persistence Race**: 複数のプロセスが同一のファイルを不規則に更新し、互いのパッチを消去し合う。
- **Verification Logic**:
    1. **Isolation Audit**: ワーカーへのパラメータ受け渡しが、共有ファイルではなく「タスク固有の不変スナップショット（専用の一時 JSON ファイル等）」を介して行われているかを確認する。
    2. **Handover Trace**: `subprocess` 起動時の引数を監視し、想定されるデータペイロードやそのパスが物理的に正しく渡されているかを検証する。
    3. **Lifecycle Cleanup Audit**: タスク終了後に、これらの一時的な「通信用スナップショット」が適切にクリーンアップされているかをチェックし、ディスクの肥大化を防ぐ。

- **Benefit**: 非同期ワークフローにおける非決定的な失敗（タイミング依存のバグ）を 120% 排除し、ミッションクリティカルなレンダリングタスクの確実な実行を保証する。
 


## Phase 43: Cross-Layer Composition Integrity Audit (Pattern 237)

マルチレイヤーな合成（背景 + 動画 + テロップ）において、一部のレイヤーの修正が他のレイヤーの消失やズレを誘発していないかを検証する、「視覚的全一性」の保証パターン。

- **The Problem**: 
    - **Shadow Regression**: テロップのスタイルの修正に成功しても、その過程でテンプレートエンジンの分岐が変わり、背景素材（BACKGROUND）やロゴ透過（OVERLAY）が消失したり、16:9 映像の配置（Placeholder）が狂ったりする。
    - **Partial Success Illusion**: 単一の成功（例：テロップが黄色になった）に目を奪われ、全体的なレイアウト崩れ（Layout Crazy）を見落としたまま「修正完了」を報告してしまう。
- **Verification Logic**:
    - **Full-Context Frame Extraction**: 修正対象の要素が含まれるフレームを抽出し、ターゲット（テロップ）だけでなく、周囲の全てのレイヤー（背景、動画枠、座標）がデザインガイドと一致しているかを「レイヤーのスイープ」で確認する。
    - **Template-Boundary Probing**: テンプレート適用時と非適用時の両方のケースをテストし、レンダリングロジックがコンテキストに応じて正しくスイッチしているか、または不要なレイヤーの重複（Double Rendering）が発生していないかを検証する。
    - **Visual Continuity Check**: 再生時間の異なる複数のポイント（開始/中間/終了）でフレームを抽出し、時間経過によるレイヤーの消失や同期ズレがないかを確認する。

- **Benefit**: 一部の修正が全体を壊す「局所最適化の罠」を排除し、プロフェッショナルな映像品質に不可欠な「視覚的な全一性」を 120% 保証する。

## Phase 44: Coordinate Reference Frame Audit (Pattern 238)

UI (Design Canvas) と レンダラー (Physical Frame) 間の座標解釈の乖離を排除するための検証パターン。

- **The Problem**: 
    - **Anchor Mismatch**: UI 上では「要素の中心」として座標を扱っているが、レンダラー（FFmpeg drawtext 等）が「描画開始点（左上）」として解釈すると、要素が画面外や意図しない位置にシフトする。
    - **Logical Drift**: テンプレートあり/なしで座標の基準点（Origin）が変わるロジックが存在する場合、単一の修正が別のコンテキストでレイアウト崩れを引き起こす。
- **Verification Logic**:
    1. **Anchor Point Assertion**: レンダラーに渡される最終的な座標式（FFmpeg の `x=(w-tw)/2` 等）が、UI から送られた `x` 座標の「意図（中心点か、左端か）」と数学的に整合しているかを確認する。
    2. **Context-Switching Test**: テンプレート適用時と非適用時の両方で、テロップが「同一のピクセル位置」に表示されるかを 1px 単位で検証する。
- **Benefit**: ユーザーがプレビューで見ているレイアウトと、エクスポートされたバイナリのレイアウトを 1:1 で完全に一致させる。

## Phase 45: Artifact Freshness Assertion (Pattern 240)

検証プロセスにおいて、過去の実行で生成された古いログやデバッグ用中間ファイル（Artifacts）を誤って「最新の成功エビデンス」として誤認する「Stale Result Hallucination（成功の幻覚）」を排除するパターン。

- **The Problem**: 
    - **Persistence of Evidence**: `/tmp/filter_debug.txt` や `./render.log` などのファイルは、新しいジョブが開始されても上書きされるまでは古い内容が残る。
    - **Timing Gap**: 修正を加えた後のテスト実行が、何らかの理由（ワーカーが古い、キャッシュ、ビルドエラー）で最新のロジックに到達しなかった場合、エージェントが古いファイルを見て「修正が反映されている」と誤認し、False Positive を報告してしまう。
- **Verification Logic**:
    1. **Pre-Audit Purge**: 検証開始直前に、ターゲットとなる中間ファイルやログを物理的に削除（`rm`）するか、基準となるタイムスタンプを取得する。
    2. **Strict Timestamp Check**: 生成された成果物のタイムスタンプが、検証プロセスの開始時刻（Trigger Time）よりも後であることを数学的に保証する。
    3. **Evidence Invalidation**: タイムスタンプが古い場合、たとえ内容が「期待通り」であっても、それは「今回の修正による成果ではない」と判断し、検証を不合格（Fail）とする。
- **Benefit**: 隠れたデッドロックやワーカーの更新漏れ、キャッシュ問題を確実に炙り出し、検証プロセスの誠実性（Integrity）を 120% 保証する。

## Phase 46: Refresh-Resilience Audit (Pattern 241)

SPA において、ページのリフレッシュ（ブラウザ更新）が重要なステート（テロップスタイル、タイムライン編集等）の消失や、その後のバックエンド操作における「意図しない初期化（上書き）」を引き起こさないかを検証するパターン。

- **The Problem**: 
    - **Memory-Only State**: テロップのデザイン情報などが React のメモリ内ステートにのみ保持されている場合、リフレッシュによりそれらは消失する。
    - **Aggressive Overwrite**: リフレッシュ後の「空のステート」のまま「承認（Approve）」等の保存アクションを実行すると、バックエンドに保存されていた正しい設定が空のデータで上書きされてしまう。
- **Verification Logic**:
    1. **Edit-Refresh-Action Sequence**: 要素を編集し、ブラウザをリフレッシュした後、再度同じ編集を行わずに重要なアクション（保存/レンダリング開始）を実行し、以前の編集内容が保持されているか、または適切に復元されているかを確認する。
    2. **State Hydration Check**: ページロード直後の API リクエスト（GET）とその後のアクションリクエスト（POST/PUT）の内容を比較し、メモリが空の状態でデフォルト値が送信されていないかを監査する。
    3. **Persistence Continuity**: サーバー側のログを確認し、リフレッシュ後のリクエストに期待される `telop_config` 等が含まれていることを確認する。
- **Benefit**: ユーザーの操作ミスや不慮の再読み込みによる「努力の消失」を防ぎ、プロフェッショナルな編集環境としての信頼性を 120% 保証する。

### **Case Study: The Pydantic Schema Erasure (Pattern 241 Resolution)**
2026-02-06に発生した、レンダリング完了後にテロップスタイルが消失する問題の特定と解決。
1.  **Root Cause**: レンダリングワーカーがジョブステータスを更新する際、`repository.save_project(project)` を呼び出していた。この `project` オブジェクト（Pydanticモデル）の定義には、動的に注入された `telop_config` フィールドが含まれていなかったため、シリアライズ（JSON保存）の過程でそのフィールドが物理ファイルから **永久に抹消** されていた。
2.  **Resolution (Post-Save Synchronization)**: バリデーション済みの Pydantic モデルによる保存を行った直後に、低レイヤーの JSON 操作を用いて `telop_config` を **手動で再注入（Re-injection）** する後処理ロジックを実装。これにより、スキーマの厳密性を保ちつつ、動的な拡張データの永続性を死守することに成功した。
3.  **Lesson**: スキーマ駆動開発（Pydantic等）と動的なメタデータ拡張を併用する場合、モデルの「外」にあるデータの生存権を保証するための「保存後の同期（Post-save Sync）」を標準プロトコルとして組み込む必要がある。


## Phase 47: Compositional Integrity Audit (Pattern 188)

- **The Problem**: 
    - **Bare Rendering**: テロップの「スタイル」は適用されているが、「コンテナ（デザインテンプレート）」が適用されておらず、単なる 9:16 クロップ動画になってしまう。
    - **Resolution Mismatch**: デザインテンプレートが未適用のまま、1080p キャンバス前提の座標で描画され、レイアウトが崩れる（例: 606x1080 枠外に文字がはみ出す）。
- **Verification Logic**:
    1. **Structural Probe (ffprobe)**: 出力 MP4 の解像度が、選択したテンプレートのキャンバスサイズ（例: 1080x1920）と一致しているか物理的に確認する。
    2. **Multi-Asset Check**: レンダリングリクエスト（POST /approve）において、`template_id` と `telop_config` の両方が有効な値として送信されているかログを確認する。
    3. **Visual Frame Audit**: 背景画像 (Background) と、正しいスタイル（色・縁取り）が適用されたテキストが「同じフレーム内」に共存しているか、動画の特定フレーム（例: 3秒地点）をダンプして確認する。
- **Benefit**: 「スタイルは正しいが枠がない」「枠はあるが文字がズレている」といった、合成ミスによる品質低下を未然に防ぎ、最終成果物のデザイン完成度を 120% 保証する。

## Phase 48: Multi-Persona Simulated Team Review (Pattern 245)

[Claude Code Agent Teams](https://code.claude.com/docs/ja/agent-teams) の並列協業概念を 120% 品質保証に応用。

- **The Problem**: 単一ペルソナ（例：Bug Hunter）による検証では、技術的なバグは見つけられても、UXの違和感、セキュリティの盲点、あるいはパフォーマンス上の懸念を同時に高い解像度で監査することは困難である。
- **Implementation (/debate team)**:
    1. **Team Formation**: HR Director が検証対象（PR、新機能、大規模リファクタ）に対し、3名の専門家レビューチーム（例：Security + Performance + UX）を編成。
    2. **Round 0: Independent Audit**: 各ペルソナが独立してチェックを実施。
    3. **Round 1-N: Mutual Argument Loop**: **核心**。各ペルソナが他者の監査結果に異議を唱え、エビデンスをぶつけ合う。これにより、単なる「見落とし」だけでなく「誤認」や「トレードオフの無視」を排除する。
    4. **Phase 4: Consensus Building**: 全ペルソナの指摘と反論を経て、最終的な「120% 合格判定」と「改善ロードマップ」をリーダーが調整して決定する。
- **Benefit**: 複数の専門的視点による「科学的議論（Scientific Debate）」を検証フェーズに導入することで、単一エージェントのバイアスを打破し、最高精度の品質（Robustness, Security, Delight）を保証する。

## Phase 49: Post-Export Binary Integrity Audit (Pattern 253)

レンダリング完了報告（100% / COMPLETED）直後のバイナリを対象に、OSレベルの互換性とメディアメタデータの整合性を物理的に監査するフェーズ。

- **The Problem (The QuickTime Compatibility Gap)**: 
    - FFmpeg が「成功」とマークしても、出力ファイルが再生不可（0バイト、またはコーデック非互換）である場合がある。特にブラウザでのプレビューには成功するが、QuickTime 等のネイティブプレイヤーでのみ破損扱いになるケースを検知する。
- **Verification Protocol**:
    1. **Metadata Assertion**: `ffprobe` を実行し、コーデック (`h264`)、ピクセルフォーマット (`yuv420p`)、およびアスペクト比が Blueprint の意図と物理的に一致しているかを確認。
    2. **File Density Probe**: ファイルサイズが期待値（例: 20秒の動画で数MB以上）に対して極端に小さくないか（< 10KB 等）を確認。
    3. **Binary Scrubbing**: 成功と報告されたファイルのバイナリヘッダーが破損していないか、OS-native な検証コマンドや `ffprobe -v error` で警告が出ないかをアサーションする。

- **Benefit**: 「書き出し成功」という言葉の裏にある不完全性を排除し、ユーザーの手元に届く成果物の物理的信頼性を 120% 保証する。

## Phase 50: Diagnostic Render Guard (Pattern 251 Expansion)

外部レンダリングプロセスの「サイレントな失敗」を、複数の物証（Exit Code, stderr, File Size）によって多角的にアサーションするフェーズ。

- **The Problem**: FFmpeg 等のコマンドが `Exit Code 0`（成功）を返しても、実際にはフィルタアセットの読み込み漏れや書き込みエラーで成果物が不完全な場合がある。
- **Verification Protocol**:
    1. **Full Trace Forensic**: `stderr` を意図的にキャプチャし、`Error`, `Failed to open`, `Invalid data` 等の致命的キーワードを自動スキャンする。
    2. **Binary Integrity Assertion**: 出力ファイルの「有無」だけでなく、物理解像度の不一致やファイルサイズの極端な乖離（例：10KB未満）を検知し、偽の成功（Success Hallucination）を排除する。
    3. **Error Log Persistence**: 失敗時には詳細な `stderr` を独立したログファイル（`*_ffmpeg_error.log`）として永久保存し、オフラインでのフォレンジック分析を可能にする。

## Phase 51: Post-Persistence Sidechannel Sync Validation (Pattern 252 Expansion)

抽象化された永続化レイヤー（Pydantic モデル等）が、保存時に非スキーマデータを抹消（Strip）する「保存制約による破壊」を検知・復旧するフェーズ。

- **The Problem**: Pydantic モデルベースの `save_project` 等を実行した際、UI や特定の用途（レンダリング等）で必要な「一時的な拡張フィールド」がモデル定義に含まれていないために物理ファイルから削除されてしまう。
- **Verification Protocol**:
    1. **Atomic Sequence Audit**: 保存アクションの直後、ディスク上の物理ファイルを直接 `cat` または低レイヤーなライブラリで読み取り、特定の「拡張フィールド」が生存しているかを確認する。
    2. **Sidechannel Re-injection Check**: 保存関数の直後に、拡張フィールドを物理ファイルへ書き戻す（Patch）処理が実装され、かつ期待通りに動作しているかを実機でアサーションする。
    3. **End-to-End Persistence Match**: レンダリング工程が、この「再注入されたデータ」を正確にロードして最終成果物に反映させているか、物的な証拠（最終映像）をもって検証する。

---
## Phase 52: Input Completeness Audit (The Non-Zero Payload Guard - Pattern 254 Expansion)

クリティカルな後続処理（レンダリング等）に渡されるペイロードが、スキーマ上は「任意（Optional）」であっても、最終品質として「必須」である場合に、空（0 items/null）のまま送信されていないかを物理的にアサーションするフェーズ。

- **The Problem**: 複雑な UI フローにおいて、エディタを一度も開かないままアクションを実行すると、設定値が初期値（空）のまま送信され、バックエンドでは「正常終了したが中身のない成果物」が生成される（Success without Content）。
- **Verification Protocol**:
    1. **Egress Observation**: `browser_subagent` の監視またはデバッグログを用いて、API リクエスト時に送信される配列フィールド（`telop_config` 等）の `length` が 0 でないことを確認する。
    2. **Fallback Trigger Verification**: 意図的に設定を空にした状態でアクションを実行し、UI 層で「デフォルト設定の自動注入（Fallback Injection）」が正常にトリガーされるかをアサーションする。
    3. **Content Continuity Audit**: 最終成果物（MP4 等）を物理的に開き、フォールバックによって注入されたデフォルト要素が、期待されるスタイル（デフォルトのフォント、サイズ等）で実際に「描画」されているかを確認する。

- **Benefit**: ユーザーの操作パターンに依存せず、常に「最低限の合格ライン」を超えた成果物を保証する、不確実性に対する最後の防衛線となる。

---
## Phase 53: Volatile State Preservation Audit (Approval Hydration - Pattern 305 Expansion)

フロントエンドの作業状態（選択、承認済みリスト等）がブラウザのリフレッシュによって消失し、一括操作（Export 等）のコンテキストが失われる「ボラティリティによる断絶」を排除するフェーズ。

- **The Problem**: バックエンドの `project.json` にステータスが保存されていても、UI 側の `useState` (React) が空に戻ると、エクスポートボタンが消えたり、件数が 0 にリセットされたりし、ユーザーは「最初からやり直し」という錯覚に陥る。
- **Verification Protocol**:
    1. **Persistence State Match**: バックエンドのプロジェクトデータ内の各アイテム（Short 等）の `status` プロパティが、フロントエンドの初期化ステート（例: `approvedShorts` Set）に 1:1 で反映されるマッピングロジックが存在するか確認。
    2. **Refresh Resiliency Probe**: ブラウザをリロードした後、ユーザーの追加操作なしに「承認済み件数」がリロード前と同一であることをアサーションする。
    3. **Consistency Guard**: UI 上の「承認取り消し」アクションが、永続化されたバックエンドステータスとフロントエンドのステートの両方を同時に更新し、リロード後も「取り消された状態」が維持されるかを確認する。

- **Benefit**: ブラウザという不安定な実行環境において、ユーザーの「承認」という意志決定を 100% 永続化し、セッションを跨いだ作業の継続性を保証する。

---
## Phase 54: Relative Layout scaling Audit (Cross-Resolution Integrity)
物理的な解像度（1080p, 4K等）に依存せず、常に期待通りのレイアウトが再現されるかを検証するフェーズ。

- **The Problem**: ハードコードされた絶対ピクセル値（Pattern 309のAnti-Pattern）が原因で、高解像度素材でテロップが小さすぎる、あるいは低解像度素材で枠からはみ出す事故が発生する。
- **Verification Protocol**:
    1. **Dynamic Resolution Probe**: 1280x720, 1920x1080, 3840x2160 の異なる解像度の素材を同一のスタイル設定でレンダリング。
    2. **Frame-Relative Assertion**: 画面の高さに対する文字の高さを計測し、解像度に関わらず一定の比率（例: Height * 0.05）が維持されていることを `ffprobe` や画像解析ツールでアサーションする。
- **Outcome (2026-02-06)**: `DESIGN_WIDTH/HEIGHT` 定数による動的スケーリングの実装により、アスペクト比や解像度の異なる環境でのレイアウト一貫性を 120% 達成。
- **Benefit**: 素材の多様性に関わらず、デザインの品質を 100% 同一に保つことができる。

---
## Phase 55: Batch Fidelity Synchronization (Fidelity Flush Check)
エンジンの改善（フォールバック強化等）を、既に承認・完了済みの古いデータに対しても自動適用し、一貫性を確保できているかを検証するフェーズ。

- **The Problem**: 以前の低品質なエンジンでレンダリングされた動画がプロジェクト内に混在し、一括エクスポート時に品質の不揃いが発生する。
- **Verification Protocol**:
    1. **Legacy Metadata Audit**: `project.json` を走査し、最新のエンジン仕様（Pattern 308）を満たさない `COMPLETED` 動画を特定する。
    2. **Forced Re-render Trigger**: 特定された低品質動画に対し、再レンダリングフラグを立ててバックグラウンドで更新（Flush）されるかを確認する。
- **Outcome (2026-02-06)**: `DEFAULT_TELOP_STYLE` フォールバックの実装後、古い Short #1 を「再承認」することで、最新の品質（縁取り、影、位置）が正しく反映される「Fidelity Flush」の有効性を実証済み。
- **Benefit**: プロジェクト全体の成果物が常に最高品質で配布可能であることを保証する。

---
*Updated: 2026-02-06. Global FBL Resilience & Fidelity Expansion.*


