# 個人用カスタマイズからOSS貢献へ

Antigravityは、個人用カスタマイズとOSS貢献を同一リポジトリで管理できます。

## 判断基準

### 個人用 (personal/)

以下に該当する場合は`personal/`に配置してください：

- ✅ 特定環境に依存する設定
- ✅ 個人的なAPI keys, secrets
- ✅ 実験的な機能（未完成）
- ✅ プライベートプロジェクト情報
- ✅ 自分専用のワークフロー

**例**:
- `personal/my-secret-workflow.md`
- `personal/secrets/.env`
- `personal/experiments/new-feature.sh`

### OSS (contrib/ or core/)

以下に該当する場合はOSS貢献を検討してください：

- ✅ 汎用的なワークフロー
- ✅ 誰でも使える機能
- ✅ ドキュメント完備
- ✅ 動作確認済み
- ✅ 個人情報を含まない

**例**:
- `contrib/workflows/blog-automation.md`
- `contrib/skills/seo-optimizer/`
- `contrib/examples/nextjs-setup.md`

## 貢献手順

### Step 1: 個人用で作成・テスト

```bash
cd ~/.antigravity/personal/
vim my-awesome-workflow.md

# テスト
./my-awesome-workflow.md
```

### Step 2: 汎用性チェック

以下のチェックリストを確認してください：

- [ ] 特定の環境に依存していないか
- [ ] 個人情報（名前、メール、API key等）が含まれていないか
- [ ] ドキュメントがあるか（使い方、目的、前提条件）
- [ ] 他の人が理解できるか
- [ ] 動作確認済みか

### Step 3: contrib/に移動

```bash
# ワークフローの場合
mv personal/my-awesome-workflow.md contrib/workflows/my-awesome-workflow.md

# スキルの場合
mv personal/my-skill/ contrib/skills/my-skill/

# 実例の場合
mv personal/my-example.md contrib/examples/my-example.md
```

### Step 4: Git add & commit

```bash
git add contrib/workflows/my-awesome-workflow.md
git commit -m "contrib: add awesome workflow for X"
```

**コミットメッセージ規約**:
- `contrib: add ...` (新規追加)
- `contrib: update ...` (更新)
- `contrib: fix ...` (バグ修正)

### Step 5: Push & PR作成

```bash
# Feature branchを作成
git checkout -b feature/awesome-workflow

# Push
git push origin feature/awesome-workflow

# GitHubでPR作成
# https://github.com/RYKNSH/antigravity-core/compare
```

### Step 6: レビュー

コミュニティがレビューし、フィードバックを提供します。

**レビュー観点**:
- 汎用性
- ドキュメント品質
- セキュリティ
- コーディング規約

### Step 7: マージ

承認されたら`main`にマージされ、全ユーザーが利用可能になります。

## セキュリティチェック

### Pre-commit Hook

Antigravityには自動チェック機能があります：

**Check 1**: `personal/`配下のファイル
- README.md と .gitkeep 以外はコミット禁止

**Check 2**: Secretsパターン
- API_KEY, SECRET, PASSWORD, TOKEN等を検出

**Check 3**: `credentials/`配下のファイル
- .gitkeep 以外はコミット禁止

### 手動チェック

コミット前に以下を確認してください：

```bash
# 1. git statusで確認
git status

# 2. 個人情報検索
grep -r "YOUR_NAME\|YOUR_EMAIL\|API_KEY" contrib/

# 3. Diffを確認
git diff --cached
```

## よくある質問

### Q: 個人用ファイルが誤ってコミットされることはありますか？

A: いいえ。以下の3層防御で保護されています：
1. `.gitignore`で`personal/*`を除外
2. Pre-commit hookで自動チェック
3. ガイドラインで明文化

### Q: contrib/と core/の違いは？

A:
- **contrib/**: コミュニティからの貢献、オプショナル
- **core/**: コア機能、全員が使う、メンテナーが管理

初めての貢献は`contrib/`に配置してください。

### Q: 貢献が却下されたらどうなりますか？

A: フィードバックを受けて改善できます。
   または、`personal/`に戻して個人用として使い続けることもできます。

### Q: 個人用ファイルのバックアップは？

A: 以下の方法があります：
```bash
# SSDにバックアップ
rsync -av --delete ~/.antigravity/personal/ /Volumes/PortableSSD/.antigravity/personal/

# またはプライベートGitリポジトリ
cd ~/.antigravity/personal
git init
git remote add origin git@github.com:YOUR_USERNAME/antigravity-personal.git
git push
```

## 詳細情報

- [CONTRIBUTING.md](../CONTRIBUTING.md) - 貢献ガイドライン
- [personal/README.md](../personal/README.md) - 個人用ディレクトリガイド
- [contrib/README.md](../contrib/README.md) - コミュニティ貢献ガイド

---

**一緒に、AI時代のクリエイター文化を作りましょう！**
