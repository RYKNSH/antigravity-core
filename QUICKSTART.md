# 🚀 Antigravity: 5分クイックスタート

> SSD1本で、どこでも同じ開発環境を再現。

## 前提条件

- **Node.js >= 18** (`brew install node` でインストール)
- **Git**

---

## Step 1: SSD接続

1. PortableSSD を Mac に接続
2. `/Volumes/PortableSSD` が表示されることを確認

---

## Step 2: プロジェクト初期化

新しいプロジェクト or 新しいPCで:

```bash
# この1行だけ！
/project-init
```

これで自動的に:
- ✅ GEMINI.md → ホームディレクトリへコピー
- ✅ ワークフロー・スキル → プロジェクトへ同期
- ✅ Docker等の依存関係チェック

---

## Step 3: 日次ルーティン

```
🌅 朝: /checkin
   └── 環境クリーンアップ＆最新化

💻 作業
   └── /dev で開発サーバー起動

☕ 休憩時: /checkpoint_to_blog
   └── 学んだことをブログ化 → Notion投稿

🌙 終了: /checkout
   └── 自己評価＆改善提案
```

---

## よく使うコマンド

| コマンド | 用途 |
|---------|------|
| `/checkin` | セッション開始 |
| `/checkout` | セッション終了 |
| `/dev` | 開発サーバー起動 |
| `/test` | テスト実行 |
| `/fbl` | 品質フィードバックループ |
| `/debate` | Multi-Persona批評 |

---

## 困ったら

1. **GEMINI.md** を確認 → 全リソース一覧あり
2. **ワークフロー一覧** → `SSD/.antigravity/agent/workflows/`
3. **スキル一覧** → `SSD/.antigravity/agent/skills/`

---

**Ready to code!** 🎉
