# ARTISTORY STUDIO: Project Overview

ARTISTORY STUDIO は、ポータブル開発環境上で管理・運用される次世代のスタジオツールであり、AI を活用したクリエイターコミュニティの基盤です。

## 1. Vision & Purpose
- **AI × Music**: AIを用いた音楽・アート・MV制作を通じて、世の中に作品をローンチするクリエイター集団の基盤を提供。
- **Autonomous Community**: スタジオ業務の効率化、自律的なタスク管理、および段階的な学習体験（Courses）を通じたコミュニティ形成。
- **First Principles**: 依存性を最小限に抑えた高速な型安全（Strict TypeScript）開発基盤の提供。

## 2. Infrastructure Architecture
「常時即時反応」と視覚的な管理を実現するためのハイブリッド構成。

- **Management Dashboard (Next.js)**: `/Volumes/PortableSSD/01_アプリ開発/ARTISTORY STUDIO` に配置されたフロントエンド基盤。Next.js 16.1.5, React 19, Tailwind CSS 4 を使用。スタジオの全体状況の可視化と設定管理を担う。
- **Bot Hosting (Railway/Local)**: `discord.js` クライアントが常時稼働。WebSocket による入出力（ボタン操作への即時反応）を担当。
- **Middleware (GAS)**: Cloud (Google) 上で常時稼動。外部サイトからの Webhook 受付窓口。受信データを正規化して Bot API へ転送。
- **Editor Control Tower (OpsOS)**: 運営（Editor）がスタジオ全体を指揮するための統合管理基盤。NextAuth.js による Discord 認証を備え、CRM（顧客管理）、LMS（学習管理）、CMS（コンテンツ管理）、Economy（経済圏管理）の 4 つの柱で構成される。
- **Control Tower (Express API)**: Bot プロセス内で稼働する Bridge API サーバー。管理者からのリモート操作 (`POST /api/admin/setup`) や、Web App からの業務アクション (`POST /api/bot/sync-members`, `POST /api/bot/unlock-course`, `POST /api/admin/seed-lms`) を受け取る。

- **Database (Supabase)**: Cloud (PostgreSQL) 上で常時稼動。ユーザープロファイル、トークン残高、コース進捗、マーケットプレイス在庫の永続化。

## 3. Core Features (Implemented)

### Server Structure Builder
`server_schema.json` に定義されたギルド構成（ロール、カテゴリ、チャンネル）を自動適用。
- **Command**: `/setup`
- **Logic**: `ChannelManager.ts` による冪等な自動生成および同期。既存のチャンネルに対しても、スキーマに定義された `topic`（説明文）、`permissionOverwrites`（権限）、および `position`（並び順）を強制的に同期する「Synchronizer」機能を搭載。さらに、スキーマ外の不要なチャンネルやカテゴリーを自動パージする **Integrated Cleanup & Self-Repair** 機能を備え、「Experience Drift（体験の乖離）」を排除する。
- **Features**: Forum/Announcement チャンネル対応、`initialMessages` による初期コンテンツの自動投稿、`permissionOverwrites` による権限の自動制御、**Fuzzy Identity Matching** による重複排除をサポート。

### Course Unlock System (Moderated Progressive Access)
ユーザーの学習進捗に合わせて、特定のロールを付由することで動的にチャンネルを「出現」させる仕組み、および Web UI 上でのコンテンツ制御。
- **Logic**: `UnlockManager.ts` (Discord) / `lms-progress.ts` (Web).
- **Flow**: 生徒は LMS のプライベートフォームから課題を提出。運営が内容を承認すると、Web 側で次のモジュールが解放される。コース全体の最終課題が承認された時点で、Bot API を介して Discord ロール（`🔓｜Step X 解放`）が付与され、新しいチャンネルが表示される。
- **Privacy First**: 未熟な段階の作品を Discord の公衆に晒すことなく、LMS 内の閉じた環境で「提出（作品提出）→ 承認（品質確認）→ Discord 解放（実力の証明）」という高付加価値な体験を提供。
- **Progress Tracking**: 各コンテンツの完了状況を Supabase に保存し、コース一覧に進捗バーを表示。

### Marketplace Economy
`THEO COIN POINT` によるサーバー内経済圏。
- **Transactions**: `MarketManager.ts` によるアトミックなポイント減算・在庫更新・ログ保存。

## 4. Database Schema (Supabase)
- **`member_profiles`**: `theo_balance`, `points_balance`, `level`, `xp`.
- **`store_items`**: `price`, `stock`, `is_active`, `currency_type`.
- **`store_transactions`**: `item_id`, `buyer_id`, `status` ('completed').
- **`courses`**: `id`, `title`, `discord_role_id`, `order_index`.
- **`course_modules`**: `id`, `course_id`, `title`, `order_index`.
- **`course_contents`**: `id`, `module_id`, `type` (video/article/mission), `title`, `video_url`, `mission_url`.
- **`user_progress`**: `user_id`, `content_id`, `status`.

## 5. Implementation Status
- **Core Infrastructure**: 完了 (Zod Validation, Dynamic Loader, Graceful Shutdown)
- **Server Builder**: 完了 (7つの主要カテゴリへの整理、日本語化、フォーラム・アナウンス・権限設定・初期コンテンツ投稿に対応。Labo/Launchpad/Dojo を含む Vision Alignment を完遂)
- **Course Logic**: 完了 (Role-Based Progressive Access による段階的チャンネル解放を実装済み)
- **Marketplace Logic**: 完了 (Atomic Transactions を実装済み)
- **Deployment Strategy**: 確立 (Hybrid Cloud/Local + Railway 定義済み)
- **Deployment Execution**: 完了 (2026-01-27: Railway CLI によるデプロイと環境変数設定を完了)
- **Quality Assurance**: 完了 (Vitest による単体テストスイート構築済み)
- **Backend Stabilization**: 完了 (2026-01-28: Supabase, MarketManager, UnlockManager の統合、および Express API による Webhook 受付・自動コース解放フローの安定化を完遂。TypeScript の型不整合も解消)
- **Vibe Setting & Vision Alignment**: 完了 (2026-01-28: 日本人向けに「ワクワク」する日本語日本語チャンネル名、絵文字、詳細説明の刷新に加え、Labo、Launchpad、Dojo チャンネルの追加によるビジョン同期を完了)
- **Vision Mashup Reconstruction**: 完了 (2026-01-28: 創業者による「究極の構想」と最新のインフラパターンをマッシュアップし、Play Guide, Courses, Techniques, Case Study, Marketplace からなる完成版サーバー構造を構築)
- **Japanese Localization (Unified)**: 完了 (2026-01-28: 全てのチャンネル名を日本語へ完全移行。マインドセット、プロジェクト設計等の 6 ステップを含む全 50+ チャンネルの「おもてなし」化を完遂)
- **Aesthetic Refinement (Vertical Bar Style)**: 完了 (2026-01-28: チャンネル名セパレータを `・` から `｜` へ統一し、プレミアムな視覚体験を実現)
- **Role-Based Unlock System**: 完了 (2026-01-28: プライベートスレッドから、ロール付与による「段階的チャンネル解放」方式へ移行し、共通チャンネルでの体験価値を最大化)
- **Course Unlock API**: 完了 (2026-01-28: Web App から Discord ロール付与を指示するための Bridge API エンドポイントを実装)
- **Vision Design System**: 完了 (2026-01-28: Glassmorphism, Neon Glow, Grid Background を統合したダッシュボードデザインシステムを globals.css に実装)
- **Localized Role Architecture**: 完了 (2026-01-28: 役割（👑｜管理者、✏️｜編集者、👤｜メンバー）および進行状況ロール（🔓｜Step X 解放）の完全日本語化を完遂。運用安全性を強化)
- **Editor Control Tower (OpsOS)**: 完了 (2026-01-28: Phase 2 (CMS/LMS) を確立。統合レイアウト (`layout.tsx`) とエンジニアを介さないハイブリッド LMS アーキテクチャにより、コンテンツ管理の民主化を完遂)
- **Form-based LMS (Phase 3)**: 完了 (2026-01-28: TypeScript による型安全なデータ構造と、LMS コース一覧・詳細ページのフロントエンド基盤を実装。JSONB による複雑な多重解放条件に対応)
- **Trusted Admin Logic (Phase 4)**: 完了 (2026-01-28: Server Actions と Service Role によるセキュアな CUD 操作基盤を確立。sonner によるトースト通知、削除機能（Danger Zone）の追加による 120% UX を実現)
- **User Progress & Unlock Logic**: 完了 (2026-01-29: ユーザーごとの進捗保存、Discord ロールに基づいた動的なモジュールロック解除機能を実装)
- **LMS Content Delivery (Phase 5)**: 完了 (2026-01-29: 動画・記事・ミッション形式に対応したコンテンツ表示ページ (`Content View`) および「完了にする」インタラクションを統合)
- **Admin UX Enhancement**: 完了 (2026-01-29: 管理画面におけるモジュール・コンテンツのドラッグ＆ドロップによる並び替えの永続化を実装)
- **Moderated Submission System (Phase 6)**: 計画中 (2026-01-29: コンテンツページからの非公開提出、管理者による承認、および承認ベースのモジュール解放・ロール付与フローを策定)
- **Ideological Guide**: [思想なき開発は、ただの「機能の羅列」でしかない。](https://www.notion.so/2f665ff13b15814480b5d0ec382b9f77) (LMS開発の背景にあるホスピタリティと導きの美学)

## 6. Operation Protocol (Control Tower)
管理者は Discord を開かなくても、以下のコマンドでサーバー構造の同期や更新が可能です。
```bash
curl -X POST https://antigravity-agent-production.up.railway.app/api/admin/setup
```
このプロトコルにより、開発環境（管制塔）からの能動的なサーバー・オーケストレーションが実現されています。

## 7. Narrative & Vibe (Brand Identity)
ARTISTORY STUDIO の技術基盤は、単なる「効率化」ではなく、クリエイターの「熱狂」を逃さないための仕組みとして設計されています。

- **Instant Genesis**: `JSON Schema` を「楽譜」とし、Botを「指揮者」とするメタファー。人間が手作業でポチポチ設定する「ラグ」を排除し、閃きを即座に世界へと反映させる。
- **Build-Aware Operation**: 脳内（コード）の設計と現実（ランタイム）を同期させるための徹底したビルド基準。
- **Social Knowledge**: これらの開発プロセスは、SoloProStudio 規格に基づき「気づき」へと変換され、ブランドストーリーとして蓄積されています。
  - *Ref: [Case Study: Instant Genesisのススメ](file:///Users/ryotarokonishi/.gemini/antigravity/knowledge/soloprostudio_social_knowledge_ecosystem/artifacts/social_knowledge/case_studies/artistory_instant_genesis.md)*
  - *Ref: [Case Study: バックエンドとフロントエンドって何？](https://www.notion.so/2f665ff13b15810ea935fc04de9c2cfd)*

## 8. The Genesis Loop: 爆速のコミュニティ構築体験
ARTISTORY STUDIO の最大の特徴は、コードベースの変更が即座に Discord 上の「体験」へと変換されるループの速さです。

1.  **Schema Update**: `schema.json` でチャンネル名や順序、説明、メッセージなどの「理想系」を定義。
2.  **Remote Trigger**: `Control Tower (Admin API)` 経由で、Discord を開かずに構築指示を送信。
3.  **Instant Reality**: Bot が瞬時に（秒単位で）20 以上のチャンネルやロールを生成、初期コンテンツを投稿。

この「人間がポチポチ設定する時間（ヒューマン・ラグ）」の完全な排除が、クリエイティブな熱量を最大化する基盤となっています。

## 9. Experience Refinement Protocol (120% UX Loop)
「完成」をゴールとせず、日本人ユーザーの「情緒的なワクワク感」を最大化するための継続的なフィードバックループを回します。

- **Hardcore Mode**: 運用フェーズにおいても、自律的に改善ポイントを発見し、即座にスキーマへと反映させる「一切の妥協を排した」改善姿勢。2026-01-27には、`scripts/prune_channels.ts` を実行し、スキーマ外の20以上の不要チャンネルを完全に排除した「Strict Schema Enforcement」を完遂。
- **120% UX Focus**: ツールとしての利便性（100点）を超え、世界観への没入（+20点）を目指すための演出（絵文字、マイクロコピー、初期メッセージのトーン＆マナー）の継続的な研磨。
- **Pinned Vision (Permanent Onboarding)**: チャンネル説明（Guide Posts）の自動ピン留め機能を導入。ユーザーがいつ参加しても、最初にビジョンに触れられる環境を物理的に固定。
- **Vision Alignment Check**: 単に「仕様通り」であることに満足せず、ビジョン（AI × Music × Launch）に対して「何が足りないか」を問い続けるプロセス。
    - **Results (Completed)**: AI技術の速報性（AI Research - `🔬 LABO`）や、具体的な作品ローンチ戦略（Launch Strategy - `🚀 LAUNCHPAD`）における実践の場としての `🛠️｜実践とUGC` を追加。ビジョンとインフラの完全な一致を実現。
- **Daily Creator Cycle (Flow Optimization)**: ユーザーの行動動線に基づき、インプットからアウトプット、そして発信へと流れる論理的な並び順（HOME -> LABO -> ACADEMY -> CREATIVE -> LAUNCHPAD）を確立。
- **Autonomous Evolution**: ルールの自動構築と、エージェントによる自律的な体験改善を組み合わせ、人間が介在せずとも最高品質のコミュニティ環境が維持される状態を目指します。
- **Verified Resilience (Fallback Confirmation)**: 2026-01-28 の大規模再構築において、Discord コミュニティ機能が未有効な状態でも、`GUILD_ANNOUNCEMENT` -> `GUILD_TEXT` 等のバックグラウンド・フォールバックが正常に動作し、システムダウンなしでの 120% UX 再現を実証。

## 10. Vision Mashup Architecture (Completed 2026-01-28)
創業者の構想に基づき、クリエイターのライフサイクルを完全にカバーする「決定版」サーバー構造。

### カテゴリ構成
1.  **💬 COMMUNITY (NEW)**: `👋｜自己紹介`、`💬｜雑談・交流`。
2.  **📅 EVENTS (中心)**: Discord Native イベント機能を核とした、コミュニティの熱量の中心地。
2.  **📖 PLAY GUIDE**: 『はじめに』『ルールブック』『ベストプラクティス』。初心者迷子をゼロにするオンボーディング。
3.  **📢 ANNOUNCEMENTS**: 重要事項とニュースの 2 段構え。
4.  **🎓 COURSES (Step 1-6)**: マインドセットから SNS 発信まで。外部リンク（ファネル）と連動した、読み取り専用の体系的カリキュラム。**Role-Based Access** により段階的に解放される。
5.  **🛠️ TECHNIQUES (UGC)**: COURSES と対になる、ユーザー投稿型（Forum）のアトリエ。学んだことを即座にアウトプットする仕組み。
6.  **📚 CASE STUDIES**: 運営による『Pickup（密着インタビュー）』と『Startup（短期集中ログ）』。上級者の背中を見せる教育コンテンツ。
7.  **🛒 MARKETPLACE**: トークン経済圏の入り口。リアル店舗連携を見据えたウォレットとショップ。
8.  **🔬 LABO (Mashup Part)**: AI の進化速度に対応するための、最新ニュース速報と検証ログ。
