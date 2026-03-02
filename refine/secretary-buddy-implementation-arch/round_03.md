# Round 3: 保守性・セキュリティ（Phase 3）と直近の開発マイルストーン

**日時**: 2026-03-01T07:09:00Z

---

### 🔄 Round 3: 「何からコードを書くか」の確定

**🔒 Security Architect**:
Phase 3（自律判断とセキュアVault）の実装について確定させます。
BUDDY（AI）に「月額1万円以下のSaaS契約は通す」等の自律判断（Auto-Approve）をさせるためには、**ルールエンジン（Rule Engine）**が必要です。
現状、小西さんの判断ログはMR（User Global Rules）として蓄積されていますが、システムが機械的にパースできるJSON/YAML形式のポリシー定義ファイル（例: `policies/auto_approve.json`）を持たせ、`src/processor/task-router.js` の前段でポリシー評価を行う機構が適しています。
また、Vaultについては、1Password CLI (`op read`) を Node.jsの `execSync` で呼び出し、必要なコンテキスト（ブラウザアクションや決済など）の直前にのみメモリに展開するラッパー関数（`src/utils/vault.js`）を開発すべきです。

**🤖 Automation Strategist**:
同意します。
それでは、ここまで決まったアーキテクチャを基に、「今日から着手すべきコード実装（マイルストーン）」を定義します。小西さんが「今すぐ」恩恵を受けられるように、以下の順番で開発を進めるのがベストです。

**マイルストーン1: インフラ層とInboxの初期構築（Phase 1 Core）**
1. `tasks.db` (SQLite) の初期化スクリプト作成 (`src/db/init.js`)
2. DiscordのInteractive Message（ボタン機能）を送信・受信する基盤の実装 (`src/discord/interactive-bot.js`)
3. 各チャネル（Chatwork/Gmail/Discordメンション）からのデータ取得バッチの実装 (`src/processor/inbox-aggregator.js`)

**マイルストーン2: AI提案とTask Routerの実装（Phase 1-2 Bridge）**
4. LLMを用いたA/B案生成モジュール (`src/processor/ai-proposer.js`)
5. ボタン押下イベントからタスク実行へと繋ぐディスパッチャ (`src/processor/task-router.js`)
6. `human_escalation` モジュール：Lisaさん宛へのChatworkタスク自動起票と監視 (`src/actions/human-fallback.js`)

**マイルストーン3: 実行アクションの拡張とVault（Phase 2-3 Core）**
7. 1Password連携ラッパー (`src/utils/vault.js`)
8. Playwright（ブラウザサブエージェント）の起動・非同期管理キュー構築 (`p-queue`等を利用した `src/actions/rpa-runner.js`)
9. ポリシー判定ルールエンジンの組み込み (`src/processor/rule-engine.js`)

**🤔 Skeptic**:
このマイルストーンなら、夢物語ではなく具体的な「1つ1つのPR（Pull Request）」として進められますね。
ただ、データベース（SQLite）のスキーマ定義はどうしますか？
最も重要なテーブル構成を確定させておかないと、後で破綻します。

**🏗️ System Architect**:
スキーマは非常にシンプルに2つで足ります。

**1. `incoming_events` (受信イベントログ)**
- `id` (PK, UUID)
- `source` (enum: chatwork, discord, email)
- `raw_data` (JSON)
- `received_at` (Timestamp)
- `status` (enum: unread, processed)

**2. `action_proposals` (AIによる提案と実行ステータス)**
- `id` (PK, UUID)
- `event_id` (FK to incoming_events)
- `summary` (Text)
- `option_a` (Text, 案Aの内容)
- `option_b` (Text, 案Bの内容)
- `selected_option` (Text, A or B)
- `status` (enum: pending_user, approved, executing, completed, failed, waiting_human)
- `assigned_human_task_id` (String, ChatworkタスクID等)
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

**😈 Devil's Advocate**:
完璧です。
この設計・マイルストーンがあれば、もはや「議論」は不要です。あとは上から順にコードを書くだけです。
小西さんには「これが最強のAIコマンダーシステムの設計図と開発手順です。マイルストーン1から実装に入ってよろしいでしょうか？」と提案すれば終わります。

---

### 🧭 Moderator Review

| 項目 | 内容 |
|------|------|
| 明確になったこと | ・Phase 3のルールエンジンとVault連携方針が確定。<br>・直近の開発マイルストーン（9ステップ）と、コアとなるSQLiteの2テーブルスキーマが完全に定義された。 |
| まだ残る懸念・論点 | なし。すぐに `master_plan.md` に追記して`/go`へ直結できるレベルに到達した。 |
| 次ラウンドの焦点 | Conclusion |
| **判定** | `Conclude` |
| **判定根拠（MRチェック）** | MR-03/MR-08: 「どう作るか（実装レベル）」の曖昧さが全て払拭され、DBスキーマからディレクトリ構造、実装順序までが具体化されたためConcludeとする。 |
