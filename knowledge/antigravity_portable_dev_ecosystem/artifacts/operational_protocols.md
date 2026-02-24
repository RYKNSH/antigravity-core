# Operational Protocols & Intelligence Library

## 1. 🌅 Session Check-in (work-start)

セッション開始時に環境をクリーンにし、最新の「知能（Skills/Workflows）」を同期します。

### 1.1 クリーンアップ (Cleanup)
- **Temporary Data**: `browser_recordings/`, `implicit/` キャッシュ、24h以上前の `conversations/*.pb` を全削除。
- **System Caches**: 
    - Chrome: `~/Library/Application Support/Google/Chrome/Default/Service Worker`
    - Adobe: `~/Library/Application Support/Adobe/CoreSync`
    - Notion: `~/Library/Application Support/Notion/Partitions`
    - npm: `~/.npm/_npx`, `~/.npm/_cacache` 等のパージ。
- **Artifact Hygiene**: 24h以上前の brain artifacts (`~/.gemini/antigravity/brain/*`) を削除。

### 1.2 環境最新化 (Update & Sync)
- **Global-to-Local Sync**: `$ANTIGRAVITY_DIR`（`~/.antigravity`）の最新 Workflows と Skills をワークベースの `.agent/` へコピー。
    - `cp $ANTIGRAVITY_DIR/agent/workflows/*.md .agent/workflows/`
    - `cp -R $ANTIGRAVITY_DIR/agent/skills/* .agent/skills/`
- **Dynamic Resource Discovery**: `GEMINI.md` に環境内のリソース一覧を自動反映。
- **Usage Statistics Boot**: セッション開始を記録。
- **Port Recovery**: 未開放ポートの強制クリア (`lsof -ti:{port} | xargs kill -9`)。特に `8000` (FastAPI) と `3000` (Next.js) が主なターゲットです。
- **Framework Cache Purge (Next.js/Turbopack)**:
    - **Problem**: 起動時に `invalid digit found in string` や `Loading persistence directory failed` というエラーで Next.js が落ちる場合があります。これは Turbopack のビルドキャッシュ破損が原因です。
    - **Resolution**: `rm -rf apps/dashboard/.next` を実行してキャッシュを完全にパージし、再起動します。セッション開始時の `/checkin` 直後や、大きな環境同期の後に発生しやすい傾向があります。

---

## 2. 🌙 Session Check-out (work-end)

### 2.1 自己評価 (Self-Evaluation)
セッションの成果を 5軸（効率・正確・対話・自律・品質）で監査し、改善点を特定。

### 2.2 Kaizen Implementation
発見した課題に対し、ルール (`.rules.md`) やワークフローをその場で更新し、SSD上のマスターへ反映。

### 2.3 知識化 (Knowledge Extraction)
有益な知見を Knowledge Items (KIs) として抽出し、一時ファイルを削除。

### 2.4 自動化と同期の検証 (Final Sync & Log)
- **Usage Logging**: `update_usage_tracker.sh /checkout` を実行。
- **Session Continuity**: `NEXT_SESSION.md` を生成。最優先タスク、未完了項目、注意点、関連ファイルを記録し、次回の `/checkin` 時のコンテキスト復元を支援。
- **Master Consistency Check**: ローカルの `GEMINI.md` と `$ANTIGRAVITY_DIR` の `GEMINI.md.master` の差分を確認。不一致がある場合は同期を促す警告を出力。

---

## 3. Operational Hygiene (衛生管理)

- **`COPYFILE_DISABLE=1`**: resource fork の生成抑制。
- **`find . -name "._*" -delete`**: macOS 特有のゴーストファイルの一掃。
- **Mandatory Port Verification**: プロセス起動前の `lsof` 確認。
- **Stale Binary Trap**: コード更新時の `npm run build` または `/tmp` キャッシュの物理削除の徹底。

### 3.1 Interactive Prompt Handling (Zsh Trap)
- **Problem**: `rm -rf dir/*` のように「ワイルドカード」を含む削除を Zsh 環境のスクリプトから実行すると、`zsh: sure you want to delete... [yn]?` という確認プロンプトが表示され、バックグラウンド処理が停止することがあります。
- **Resolution (Interactive)**: `send_command_input` を使用して AI エージェントが能動的に `y` を送る。
- **Resolution (Scripted)**: 可能な限りワイルドカードを避け、ディレクトリそのものを削除した後に再作成する (`rm -rf dir && mkdir dir`) か、`rm -rf dir/` のようにスラッシュで指定することでプロンプトを回避します。

---

## 4. Universal Workflow Library (1.5-Command Architecture)

どのプロジェクトでも同じ操作体系（知感）を提供します。セッション中のコマンドを最小化し、認知負荷を「タスクそのもの」へ集中させるため、統合メタワークフローを採用しています。

### 4.1 メインエントリーポイント
- **`/go "タスク"`**: **唯一の必須コマンド**。セッション開始 (`/checkin`) + 開発環境起動 (`/dev`) + 実装 (`/work`) + 検証 (`/verify`) を一気通貫で行う、Antigravity の標準作業プロトコル。

### 4.2 ライフサイクル管理
- **/start (/go)**: セッションの開始と環境準備。
- **/end (自然言語)**: 「終わり」「また明日」等の発言に反応し、リリース (`/ship`) の要確認、`/checkout`、および自己進化 (`/evolve`) を自動連鎖。

### 4.3 内部コンポーネント (The "Big Three")
`/go` の内部で自律的に呼び出される「目的別」ワークフロー：
- **/work**: 実装（Spec/Feature/Fix/Refactor）。
- **/verify**: 多層検証（Test/FBL/Debate）。
- **/ship**: 安全なリリース（Build/Deploy/Migrate）。

---

## 5. Intelligence Skills (Capabalities)

---

## 5. Intelligence Skills (Capabalities)

- **First Principles Thinking**: 根本原因分析。
- **Architecture & ADR**: 境界設計と意思決定。
- **Autonomous Ops**: Docker, Homebrew, MCP の自律管理。
- **Autonomous Resource Discovery**: `list_resources.sh` を使用した環境内の Workflow/Skill/Knowledge の動的検出と `GEMINI.md` への自動反映。
- **Discovery & Probing**: 欠落しているコンテキストの自律的再建。

---

## 6. Dynamic Infrastructure & Monitoring
環境の健康状態とリソースの動的な可視化については、[Dynamic Infrastructure](./dynamic_infrastructure.md) を参照。
- **Usage Tracking**: 利用頻度の統計取得。
- **Resource Auto-Indexing**: インデックスの自動再構築。

## 7. Workflow Consolidation Architecture (The 1.5-Command System)

開発者の認知負荷を最小化するため、従来の 20個以上のコマンドを「目的別」のメタワークフローに集約。さらにそれを `/go` という単一のエントリーポイントに統合しています。

- **Layer 0: Intent & Session Entry (`/go`)**: コマンドの暗記（外在的負荷）を排除。
- **Layer 1: Task Analysis (`/work`)**: 自然言語から意図を判別し、適切なフェーズ（探索・計画・実装）を自動適用。
- **Layer 2: Multi-Layer Validation (`/verify`)**: ユニットテスト、静的解析、およびペルソナによる「相互反論レビュー」を連鎖実行。
- **Layer 3: Reliable Internal Release (`/ship`)**: ビルド、DBマイグレーション、デプロイプロトコルを安全に実行。

詳細は [Integrated Workflow Architecture](./architecture/integrated_workflow_architecture.md) を参照。

## 8. Proactive Suggestion System (自律提案)

AIがコンテキストを監視し、適切なタイミングでワークフローの実行を提案します。これにより、開発者は「コマンドを覚える」必要がなくなり、AIの提案を「承認/却下する」だけで品質を維持できます。

### 8.1 提案トリガー定義 (`AUTO_TRIGGERS.md`)
- **検証提案**: 実装直後にテスト不足を検知 → 「テスト追加しますか？」
- **レビュー提案**: 大規模変更や複雑なロジックを検知 → 「レビューセッションしますか？」
- **チェックポイント提案**: 1時間以上の未コミット作業を検知 → 「コミットしますか？」
- **ライフサイクル提案**: 夕方や長時間の非アクティブを検知 → 「今日はここまでにしますか？」

### 8.2 運用原則
- **命令ではなく気づき**: ユーザーの集中を妨げない「自然な区切り」で提案する。
- **学習型フィードバック**: 拒否された提案は頻度を下げ、採用されたパターンを強化する。
- **Agency (主導権) の維持**: AIが勝手に進めるのではなく、必ず提案と承認のステップを踏む。

---
## 10. Lightweight Operation & Performance Diagnostics

システムが重い（Load Average上昇、入力遅延）と感じた際の診断と復旧プロトコル。

### 10.1 Diagnostic Checklist (診断手順)
1.  **Load Average & CPU**: `top -l 1 | head -10` で Load Avg を確認。4以上は要注意。
2.  **Memory Pressure**: `vm_stat` だけでなく `top` の `PhysMem` を確認。unused が極端に少ない場合に注意。
3.  **Compressor (致命的指標)**: `top` の出力で `CMPRS` (Compressor) が数GB（例: 8GB以上）に達している場合、macOSがメモリ不足を圧縮処理で補っており、CPU負荷が恒常的に高まっている。
4.  **SWAP Usage**: `sysctl vm.swapusage` で used が 500MB を超えて増え続けている場合は Chrome 等の再起動が必要。
5.  **Offender Identification**: `ps aux -m | head -20` でメモリ消費上位プロセス（Chrome, Antigravity Helper, Node）を特定。

### 10.2 Lightweighting Workflow (軽量化の断行)
セッション中に実施可能な「外科的」クリーンアップ：

1.  **Graceful App Termination**:
    *   Chrome: `osascript -e 'tell application "Google Chrome" to quit'`
2.  **Cache Purge**:
    *   **Browser Recordings**: 2日以上前の録画をパージ。
        `find ~/.gemini/antigravity/browser_recordings -type f -mtime +2 -delete`
    *   **Chrome Service Worker**:
        `rm -rf ~/Library/Application\ Support/Google/Chrome/Default/Service\ Worker`
    *   **npm cache**: `~/.npm/_npx`, `~/.npm/_logs`, `~/.npm/_prebuilds`, `~/.npm/_cacache` を削除。
3.  **System Purge**:
    *   Disk cache の解放: `sudo purge` (sudoが必要なため実行可否を確認)
4.  **Process Restart**:
    *   Antigravity Agent の再起動、または Chrome の一括終了後の再起動。

---
*Updated: 2026-02-07. Added Port Recovery targets, Next.js Cache Purge protocol, and Archive System verification results.*
