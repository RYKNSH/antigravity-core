# Antigravity Portable Setup

SSDベースのポータブルAntigravity設定。
どのPCでも、SSD接続＋シンボリックリンク作成で同一の作業環境を再現。

## ディレクトリ構造

```
/Volumes/PortableSSD/.antigravity/
├── README.md             ← このファイル
├── agent/
│   ├── rules/            ← グローバルルール
│   │   └── user_global.md
│   ├── workflows/        ← 標準ワークフロー（6種）
│   │   ├── checkin.md       # セッション開始＋環境最新化
│   │   ├── checkout.md      # セッション終了
│   │   ├── lightweight.md   # 適応的軽量化
│   │   ├── cleanup-48h.md   # 定期メンテナンス
│   │   ├── project-init.md  # プロジェクト初期化
│   │   └── clone-environment.md  # SSD環境クローン
│   └── skills/           ← グローバルスキル（7種）

│       ├── first-principles/
│       ├── architecture/
│       ├── code-review/
│       ├── autonomous-execution/
│       ├── bottleneck-hunter/
│       ├── mcp-best-practices/
│       └── llm-api-best-practices/
├── project-templates/    ← プロジェクトテンプレート
│   ├── docs/             # 原則ドキュメント
│   ├── configs/          # tsconfig, turbo.json等
│   └── scripts/          # setup, dev, deploy
└── knowledge/            ← ナレッジベース
```

## 新しいPCでのセットアップ

```bash
# シンボリックリンク作成
rm -rf ~/.agent 2>/dev/null
ln -s /Volumes/PortableSSD/.antigravity/agent ~/.agent

rm -rf ~/.gemini/antigravity/knowledge 2>/dev/null
ln -s /Volumes/PortableSSD/.antigravity/knowledge ~/.gemini/antigravity/knowledge

# 確認
ls -la ~/.agent ~/.gemini/antigravity/knowledge
```

## 新しいSSDへの移行

```bash
# 旧SSDから新SSDへコピー
cp -R /Volumes/OldSSD/.antigravity /Volumes/NewSSD/.antigravity

# シンボリックリンクを更新
rm ~/.agent && ln -s /Volumes/NewSSD/.antigravity/agent ~/.agent
rm ~/.gemini/antigravity/knowledge && ln -s /Volumes/NewSSD/.antigravity/knowledge ~/.gemini/antigravity/knowledge
```

## 利用可能なコマンド

| コマンド | 日本語エイリアス | 説明 |
|---------|----------------|------|
| `/checkin` | チェックイン | セッション開始＋環境最新化 |
| `/checkout` | チェックアウト | セッション終了＋自己評価 |
| `/lightweight` | 軽量化 | AI判断による適応的軽量化 |
| `/project-init` | プロジェクト初期化 | First Principles開発環境構築 |
| `/clone-environment` | 環境構築クローン作成 | 新SSDへの環境複製 |

---

## 主要コマンド詳細

### `/checkin` - セッション開始

セッション開始時に実行。**2つのPhase**で構成：

**Phase 1: クリーンアップ**
- browser_recordings 全削除
- 24時間以上経過した conversations 削除
- 古い brain artifacts 削除
- システムキャッシュ（Chrome/Adobe/Notion/npm）削除

**Phase 2: 環境最新化**
- SSDからワークフローを同期（最新版に更新）
- SSDからスキルを同期（first-principles等のアップデート反映）

---

### `/checkout` - セッション終了

セッション終了時に実行。**自己評価フィードバックループ**を含む：

**Phase 1: クリーンアップ**
- browser_recordings/implicit 削除
- システムキャッシュ削除
- ※ conversations は保持

**Phase 2: 自己評価**（5項目×5段階）
| 評価項目 | 観点 |
|---------|------|
| 効率性 | 無駄なツール呼び出しはなかったか |
| 正確性 | 初回で正しい解を提示できたか |
| コミュニケーション | ユーザーの意図を正確に理解できたか |
| 自律性 | 適切な判断を自分で行えたか |
| 品質 | 出力物はベストプラクティスに従っていたか |

**Phase 3: 改善提案→承認→反映**
```
自己評価 → 課題特定 → ソリューション提案 
    → ユーザー承認 → /checkin ワークフロー改善
    → 次セッションで効果検証
```

---

### `/clone-environment` - 環境クローン

新しいSSDにポータブル開発環境を完全複製：

1. 新SSDのボリューム名を確認
2. `.antigravity/` 全体をコピー
3. シンボリックリンクを新SSDに更新

**含まれるもの:**
- グローバルルール
- 全ワークフロー（6種）
- 全スキル（7種）
- プロジェクトテンプレート
- ナレッジベース

---

## 利用可能なスキル

| スキル | 発動条件 |
|--------|---------|
| First Principles | 根本原因分析が必要な時 |
| Architecture | 設計判断が必要な時 |
| Code Review | コードレビュー依頼時 |
| Autonomous Execution | 複数ステップタスク時 |
| Bottleneck Hunter | パフォーマンス問題時 |
| MCP Best Practices | MCP開発時 |
| LLM API Best Practices | LLM API統合時 |

