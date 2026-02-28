# Personal Directory

このディレクトリは**個人用カスタマイズ専用**です。  
Gitで管理されず、完全にプライベートです。

## 📁 何を入れるか

### ✅ OK（個人用）
- 個人的なワークフロー
- 実験的な機能（未完成）
- カスタムスクリプト
- Secrets・Credentials
- 特定環境に依存する設定

### ❌ NG（OSSへ）
- 汎用的なワークフロー → `contrib/workflows/`へ
- バグ修正 → `core/`へPR
- ドキュメント → `docs/`へPR

## 🚀 OSS貢献する方法

作成したものが他の人にも役立つと思ったら：

```bash
# 1. contrib/に移動
mv personal/my-workflow.md contrib/workflows/my-workflow.md

# 2. Git add & commit
git add contrib/workflows/my-workflow.md
git commit -m "contrib: add my-workflow"

# 3. Push & PR作成
git push origin feature/my-workflow
```

詳細: [docs/PERSONAL_TO_OSS.md](../docs/PERSONAL_TO_OSS.md)

## 🔒 セキュリティ

このディレクトリは`.gitignore`で保護されています。  
**誤ってコミットされることはありません。**

ただし、念のため：
- Secretsは`personal/secrets/`に隔離
- `git status`で確認してからcommit
- Pre-commit hookが自動チェック

## 💾 バックアップ

個人用ファイルは定期的にバックアップしてください：

```bash
# プライベートGitリポジトリでバックアップ
cd ~/.antigravity/personal && git init && git push
```

または、プライベートGitリポジトリで管理することも可能です。
