# 🏁 Final Debate Report: Discord UX/UI "Zero Inbox" Architecture

## 💎 Refined Proposal (The Output)
現状の「全通知を同一チャンネルに垂れ流し、ステータス変更時も色が変わるだけ」という実装を破棄し、**「Zero Inbox (ゼロ・インボックス) アーキテクチャ」**を採用したDiscord連携に再構築する。

### 📌 コア・コンセプト
ユーザーが `🔴-action-required` (Inbox) チャンネルを開いた時、そこにあるメッセージは**「今すぐユーザーが判断・アクションを下さなければならないタスク」だけ**であるべき。処理が終わったものは物理的に目の前から「消滅」し、ログ専用のチャンネルに移動（再送＆元メッセージ削除）させる。

### 🏗️ チャンネル構成設計
Discordサーバー内に以下のカテゴリとチャンネルを構成する：

**📂 SECRETARY COMMAND CENTER**
1. **`🔴-inbox`** (Action Required)
   - 役割: 人間のレビュー（A/B選択、指示出し）を待っている Pending タスクのみが存在。
   - 挙動: ボタン操作（Approve/Revise等）が完了した瞬間、Botはこのチャンネルからそのメッセージを**削除**する。
2. **`🟢-auto-approved`** (Read Only)
   - 役割: Rule Engineによって自律実行されたタスクの事後報告タイムライン。
   - 挙動: ボタンは一切配置せず、確認専用とする。
3. **`🗄️-archives`** (Log)
   - 役割: `🔴-inbox` で処理が終わった（A/Bが選ばれた、完了した）タスクの最終結果置き場。
   - 挙動: Inboxから削除されたメッセージの内容に「誰がどう判断したか」を追記し、完了した状態（緑色Embed等）で再生成してここに投稿する。

### 🎨 Embed UI の最適化（認知負荷最小化）
- **Color Coding**: 
  - `Warning / Orange` = ユーザーのアクション待ち (Inbox)
  - `Success / Green` = 処理完了 (Archive, Auto-Approve)
  - `Danger / Red` = 要エスカレーション・緊急事態（Fallback等）
- **Descriptionの短縮**: 生の受信メッセージ（Raw Data）全体をEmbedのDescriptionに詰め込むのをやめ、AIによる「要約（Summary）」と「次にとるべきアクション」を最上部に配置する。詳細なRawログは折りたたむか、不要なら省略する。
- **Threadsの活用**: ModalでAIへ「修正指示（Revise）」を出した場合、そのタスクのプロンプトライクなやり取り（再生成など）はログを汚さないよう、そのメッセージの「スレッド（Thread）」内で行う。

## 🛡️ Addressed Concerns
- **[解決済み] 新旧タスクの混在による視認性低下**: 
  - → 処理済みメッセージの「削除＆別チャンネルへの再投稿」による完全分離で解決 (by Skeptic & UX Architect)
- **[解決済み] Forumを開く1クリックのコスト**: 
  - → Forumを採用せず、通常のText Channelによる「常にInboxゼロを目指す」カンバン方式にすることで一覧性を維持しつつクリック数を削減 (by Discord Ninja)

## ⚠️ Remaining Risks (Minor)
- Discord APIの一時的な障害やレートリミットにより、「メッセージを削除して、アーカイブに再投稿する」トランザクションが非同期でずれた場合、極稀に「アーカイブだけされて元のInboxから消えない（またはその逆）」バグが起こり得る。
  - **対策**: DB（`tasks.db`）のステータス管理を正とし、定期ポーリングで `status = 'approved'` なのに Inbox にメッセージが残っている場合はそれを強制クリーンアップするロジックを入れることで回避可能。

## 📊 Persona Contribution
| Persona | Impact | Status |
|---------|--------|--------|
| UX Architect | High | 課題整理とUI構成案の土台を提示。 |
| Skeptic | High | Forum案の弱点を指摘し、「メッセージの削除」によるZero Inboxを提案。 |
| Discord Ninja | High | Discord APIの仕様（メッセージ移動不可、削除＆再投稿なら可能）を担保し、実現性を保証。 |
