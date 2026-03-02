# Round 2: Task Router（Phase 2）のディスパッチャ設計と非同期RPAの連携機構

**日時**: 2026-03-01T07:07:00Z

---

### 🔄 Round 2: 「ボタンが押された後」の確実な実行と並行処理

**🏗️ System Architect**:
小西さんがDiscord上で「案A」のボタンを押下した瞬間の処理（Phase 2: Task Router）を定義します。
1. **Button Interaction Webhook**: Discordはボタン押下イベントをBUDDYサーバーのエンドポイントに送信します。
2. **State Update**: `tasks.db` の `action_proposals` テーブルで該当タスクのステータスを `approved` に変更し、選ばれた案（A）を記録します。
3. **Execution Dispatcher (`src/processor/task-router.js`)**: `approved` なタスクを定期監視（またはWebhook駆動）で拾い上げ、タスクの種別に応じて以下のワーカースレッド（または別プロセス）にディスパッチします。
   - `type: api_action` (Chatwork返信等) → 即座にNode.js内で `axios` やSDKを使って実行。
   - `type: rpa_action` (領収書取得等) → Playwrightスクリプトを別プロセスで起動（`child_process.spawn`）。
   - `type: human_escalation` → Chatwork APIを叩いて、宛先（Lisaさん等）に小西さん代理として「〇〇をお願いします」とタスク起票。

**🤖 DevOps Engineer**:
RPAアクション（Playwright）の別プロセス起動は危険です。小西さんが10個のタスクに立て続けに「案A」を押した場合、バックグラウンドで10個のChrome（Chromium）インスタンスが立ち上がり、サーバー（Mac Studio等の環境）がメモリ枯渇でクラッシュする恐れがあります。
解決策として、**「Concurrency Control（並行実行数制御）」**を設けたジョブキューシステムが必要です。外部ライブラリの `BullMQ`（Redis必須）を使うか、あるいは外部依存を減らすためにSQLiteベースの軽量キュー（例: `better-sqlite3` を使った独自のワーカープール、または `p-queue` パッケージ）を採用すべきです。

**🔒 Security Architect**:
SQLite + `p-queue` によるインメモリ＋永続化のハイブリッドが妥当でしょう。サーバーリブート時にもSQLiteから未完了タスク（`approved` かつ未実行）を復元できます。
さらにセキュリティの観点から、Playwrightを起動する際の**認証情報（セッション/Cookie）**の扱いが問題になります。
1Password CLI（`op` コマンド）をNode.jsから叩き、環境変数として注入した状態でPlaywrightを起動する設計（`.env` に平文で残さない）が理想的です。ただし、セッション（Cookie）が切れた場合に再ログインを強行すると2FAでブロックされるため、**「2FA等でRPAがコケた（Failed）場合は、自動的に `type: human_escalation` にフォールバックする機能」**をルーターに持たせる必要があります。

**😈 Devil's Advocate**:
素晴らしい。AIが「俺は無理だったわ、Lisa頼む！」と自動でパスできるなら、2FA突破問題は完全に無効化されます。
さらに、人間（Lisaさん等）へのエスカレーションも、単に「やっておいて」とチャットを投げるだけだと、チャットの中に埋もれます。
BUDDYはChatworkの**「タスク追加API」**を使って、Lisaさんに明確に期日付きの「タスク」としてアサインし、さらにそのタスクが完了（Done）になるまでDB上で `status: waiting_human` として監視し続けるべきです。もし期限を過ぎてもDoneになっていなければ、BUDDYが自動で「リマインド」を送信する。これで小西さんの「あれどうなったっけ？」という脳のメモリ解放が完璧になります。

**🏗️ System Architect**:
まとめると、Task Routerのアーキテクチャは以下の通りです。
1. **Interactive UI**: Discord Button Component
2. **State DB**: SQLite (`tasks.db`): `status=(pending -> proposed -> approved -> (processing -> completed | failed) | waiting_human -> completed)`
3. **Queue/Worker**: `p-queue` を利用し、RPA等の重いジョブの同時実行数を制限（concurrency: 2程度）。
4. **Fallback mechanism**: `rpa_action` → Error → 自動的に `human_escalation` へルーティング。
5. **Human API**: ChatworkのTask APIを活用したアサイン＋ポーリング（完了監視）＋自動リマインド。

---

### 🧭 Moderator Review

| 項目 | 内容 |
|------|------|
| 明確になったこと | ・Task Routerの具体的な技術スタック（SQLite, p-queue, Discord Interactive UI, Chatwork Task API）が確定。<br>・RPAクラッシュ防止の並行制御と、失敗時の「人間へのフォールバック」設計が確立。 |
| まだ残る懸念・論点 | ・Phase 3（自律判断領域の拡大）の実装アプローチ。<br>・今日からコードを書き始めるための「直近のマイルストーン（機能リスト）」の作成。 |
| 次ラウンドの焦点 | 継続的進化（Phase 3）のデータフローと、直近の開発マイルストーンのリストアップ。 |
| **判定** | `Continue` |
| **判定根拠（MRチェック）** | MR-03: Phase 2の実装構造は完全に同意された。しかし、これを「今日から実装できるアクションプラン」に落とし込むSuccess Criteriaを完全に満たすため、最終ラウンドへ。 |
