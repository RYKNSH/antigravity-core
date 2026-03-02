# 🏁 Final Debate Report: Implementation Architecture
**テーマ**: secretary-buddy-implementation-arch (SECRETARY BUDDY 実装アーキテクチャ)

---

## 💎 Refined Proposal: The "Async Task Router" Architecture
「マスタープラン」をコードとして実装するための、堅牢でスケーラブルなNode.jsアーキテクチャが確定しました。
すべての機能は、DiscordのインタラクティブUIを中心とした**イベント駆動型マイクロサービス**として実装されます。

### 🗺️ システムアーキテクチャとデータフロー

#### 1. データストア (State Management)
- **技術選定**: `SQLite` (`tasks.db`)
- **スキーマ**:
  - `incoming_events`: 各チャネル（Chatwork/Discord/Email）からの未処理の生データ。
  - `action_proposals`: イベントに対するBUDDY（LLM）の提案内容（案A/B）と、その実行ステータス（approved, executing, completed, failed, human_waiting）。

#### 2. Input / Output (ユーザーインターフェース)
- **技術選定**: `Discord Interactive Components`
- **UIレス設計**: 小西氏専用のDiscord DM/チャンネルに、BUDDYから「メッセージ＋ボタン（案A・案B）」が通知される。小西氏がボタンを押すとWebhookがトリガーされ、`action_proposals`のステータスが更新される。

#### 3. Execution Pipeline (Task Router)
- **技術選定**: `Task Router` + `p-queue` (並行実行制御)
- **フロー**:
  1. Routerが `approved` ステータスのタスクをDBから抽出。
  2. タスクの種類に応じてディスパッチ：
     - **API Task**: Node.js内で即時同期処理。
     - **RPA Task**: Playwrightスクリプトを `p-queue`（並行数2程度）に入れてヘッドレス実行。クラッシュを防ぐ。
     - **Human Task**: Chatwork Task APIを叩き、Lisaさん等の実担当者宛にChatwork上で「タスク」を起票。

#### 4. フォールバック＆セキュリティ
- **RPA Fallback**: Playwrightの実行中に2FA等でブロックされたりエラーが起きた場合、自動的に `Human Task`（Lisaさんへの依頼）へフォールバックする。AIは無理に突破せず人間を呼ぶ。
- **Vault Integration**: 1Password等（または暗号化`.env`）から、実行直前にのみクレデンシャルをメモリに読み込む安全なラッパー関数（`vault.js`）を使用。

---

## 🚀 開発マイルストーン (実装タスクリスト)

以下、今日から着手可能な「開発ステップ（PR単位）」です。

- **Milestone 1: Inbox Core (Event Receiver & DB)**
  - `src/db/init.js` (SQLiteスキーマ構築)
  - `src/processor/inbox-aggregator.js` (API経由での受動的・能動的メッセージ取得)
  - `src/discord/interactive-bot.js` (Discord UIの構築とボタンイベント受信)

- **Milestone 2: The Brain & The Router (提案と振り分け)**
  - `src/processor/ai-proposer.js` (LLMを使った案A/Bの生成とDB登録)
  - `src/processor/task-router.js` (ボタン押下イベントをトリガーとした実行ディスパッチャ)
  - `src/actions/human-fallback.js` (Chatworkへの自動タスク起票機能)

- **Milestone 3: Advanced Execution (RPA & Vault)**
  - `src/actions/rpa-runner.js` (`p-queue`によるPlaywrightの安定稼働キュー)
  - `src/utils/vault.js` (認証情報のセキュアな一時払い出し)
  - `src/processor/rule-engine.js` (Auto-Approveの境界線を定形するポリシーエンジン)

## 🛡️ Addressed Concerns
- [解決済み] **RPAの無秩序な多重起動によるサーバクラッシュ** → `p-queue`（ジョブキュー）の導入による並行数制御。 (by DevOps Engineer)
- [解決済み] **RPAにおける2FA・CAPTCHAの壁** → 失敗時自動でHuman Fallback（Chatworkへのタスク起票）に遷移させる設計で完全無効化。(by Security Architect & Devil's Advocate)
- [解決済み] **「UIをどう作るか」という工数の無駄** → DiscordのボタンUIを「逆ハック」してInboxとして採用。開発工数を最小化。 (by Devil's Advocate)
