# 🚀 Antigravity: 5分クイックスタート

> GitHub1本で、どこでも同じ開発環境を再現。

## 前提条件

- **Node.js >= 18** (`brew install node` でインストール)
- **Git**

---

## Step 1: インストール

```bash
git clone https://github.com/RYKNSH/antigravity-core.git ~/.antigravity && bash ~/.antigravity/setup.sh
```

これで自動的に:
- ✅ GitHub から clone
- ✅ Pre-commit hook インストール
- ✅ 依存関係チェック

---

## Step 2: 日次ルーティン

```
🌅 朝: /checkin
   └── 環境クリーンアップ＆GitHub同期

💻 作業: /go "タスク"
   └── 自動でワークフロー実行

🌙 終了: /checkout
   └── 自己評価＆GitHub push
```

---

## よく使うコマンド

| コマンド | 用途 |
|---------|------|
| `/go` | セッション開始〜作業〜終了まで全自動 |
| `/checkin` | セッション開始 |
| `/checkout` | セッション終了 |
| `/work` | タスク実行 |
| `/verify` | テスト・検証 |
| `/debate` | Multi-Persona批評 |

---

## 個人用カスタマイズ

```bash
# 個人用ディレクトリで実験
cd ~/.antigravity/personal/
vim my-workflow.md

# OSS貢献したくなったら
mv my-workflow.md ../contrib/workflows/
git add contrib/workflows/my-workflow.md
git commit -m "contrib: add my-workflow"
git push
```

詳細: [docs/PERSONAL_TO_OSS.md](docs/PERSONAL_TO_OSS.md)

---

## 困ったら

1. **README.md** を確認 → 基本情報
2. **PHILOSOPHY.md** → なぜ作ったか
3. **CONTRIBUTING.md** → 貢献方法

---

**Ready to code!** 🎉
