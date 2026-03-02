# Round 1: Central Inbox（Phase 1）の通知と状態管理のアーキテクチャ

**日時**: 2026-03-01T07:06:00Z

---

### 🔄 Round 1: どのように全チャネルをリアルタイムに集約し、小西氏に提案するのか？

**🏗️ System Architect**:
Phase 1の「Central Inbox（情報の一元化とA/B提案）」を実装レベルに落とし込みます。
各チャネル（Chatwork, Discord, Gmail）からの情報を取得する部分は、**Event-Driven Architecture（イベント駆動アーキテクチャ）**を採用すべきです。
1. **Webhook Receiver**: DiscordやChatworkからのWebhookを受け取るExpressサーバー（`src/server/webhook-listener.js`）をバックグラウンドで常駐させる。
2. **Polling Fallback**: Webhookが使えない古いAPI（一部のメール等）に対しては、`setInterval`による定期ポーリングワーカー（`src/processor/polling-worker.js`）を動かす。
3. **Queue System**: 受け取った生データは直ちに処理せず、ローカルのSQLiteデータベース（`tasks.db`）の `incoming_events` テーブルに「未処理」ステータスで突っ込む。

**🤖 DevOps Engineer**:
SQLiteへのキューイングは正解です。Node.jsのメモリ上で処理すると、クラッシュ時にタスクが消失します。
問題は「どうやってA/B案を生成し、小西さんに通知するか」です。
イベントが入るたびに毎回LLM（Gemini/OpenAI）のAPIを叩いていては、APIのレートリミットに引っかかりますし、遅延も発生します。

**🤔 Skeptic**:
その通り。さらに、小西さんの「Central Inbox」のUIは何にするんですか？
ターミナル上で通知を受け取るんですか？ブラウザに専用画面を作るんですか？
「小西さんが1秒で返せる」というUXを実現できなければ、このシステムはゴミになります。

**😈 Devil's Advocate**:
わざわざ専用のフロントエンド（React等）を作る必要は全くありません。既存の小西さんが一番見ているツールを**「逆ハック」**すればいいんです。
小西さんは日常的にターミナルとDiscordを開いています。
BUDDY（AI）からの「提案とA/B選択肢」は、**Discordの小西さん専用プライベートチャンネル（またはDM）にBotから送信**させればいい（Discord Botの `Interactive Components` であるボタン機能を使う）。
小西さんがDiscord上の「案A」のボタンを押せば、BUDDYのサーバーにWebhookが返り、処理が発火する。これで「UI開発」の工数はゼロになります。

**🏗️ System Architect**:
Devil's Advocateの提案は極めて優秀です。DiscordのButton Componentを利用した「Interactive Inbox」アーキテクチャとして定義しましょう。
**データの流れ**:
1. Chatwork/Gmail等から新規メッセージを受信 → `incoming_events` DBに保存。
2. `src/processor/ai-proposer.js` がキューを監視。新規イベントがあればLLMを用いて対応案（案A, 案B）を生成し、`tasks.db` の `action_proposals` テーブルに保存。
3. BUDDYのDiscord Botが、小西さんのプライベートDMに【タスク概要＋案Aボタン＋案Bボタン】のメッセージを投下。
これでPhase 1の「情報を集約し、1クリックで判断させる」実装は、極めて短いコードで実現可能です。

---

### 🧭 Moderator Review

| 項目 | 内容 |
|------|------|
| 明確になったこと | ・イベント受信（Webhook/Polling）→ SQLiteへの永続化キュー → LLMによるバックグラウンド案生成。<br>・専用UIは作らず、Discordの「ボタン機能」をInbox（A/B選択のUI）として流用するアーキテクチャが確定。 |
| まだ残る懸念・論点 | ・「ボタンが押された後」の処理（Phase 2のTask Router）をどのように安全かつ確実に並行処理させるか。<br>・Playwright等のブラウザRPAを用いた場合の、セッション維持やヘッドレス実行の安定性。 |
| 次ラウンドの焦点 | Phase 2の「Task Router（ディスパッチャと実行系の連携）」の実装アーキテクチャ。 |
| **判定** | `Continue` |
| **判定根拠（MRチェック）** | MR-03: Phase 1の受信・UI構造は解決したが、この先の「実行（Router）」の仕組みが未定義。実装レベルに落とし込むというSuccess Criteriaを満たすため、Deep Dive。 |
