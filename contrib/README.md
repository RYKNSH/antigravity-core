# Contrib Directory

コミュニティからの貢献を歓迎します！

## 📂 構造

```
contrib/
├── workflows/   # コミュニティワークフロー
├── skills/      # コミュニティスキル
└── examples/    # 実例・チュートリアル
```

## ✨ 貢献方法

### 1. 個人用で作成
`personal/`ディレクトリで自由に実験してください。

### 2. 汎用性を確認
他の人にも役立つか考えてください。

**チェックリスト**:
- [ ] 特定の環境に依存していないか
- [ ] 個人情報が含まれていないか
- [ ] ドキュメントがあるか
- [ ] 他の人が理解できるか

### 3. contrib/に移動
```bash
mv personal/my-workflow.md contrib/workflows/my-workflow.md
```

### 4. PR作成
```bash
git add contrib/workflows/my-workflow.md
git commit -m "contrib: add my-workflow"
git push origin feature/my-workflow
```

### 5. レビュー
コミュニティがレビューし、フィードバックを提供します。

### 6. マージ
承認されたら`main`にマージされ、全ユーザーが利用可能になります。

## 📋 品質基準

- ✅ ドキュメントがある
- ✅ 汎用的（特定環境に依存しない）
- ✅ 個人情報が含まれない
- ✅ 動作確認済み

## 🎯 contrib/ vs core/

**contrib/**:
- コミュニティからの貢献
- 実験的な機能
- オプショナル

**core/**:
- コア機能
- 全員が使う
- メンテナーが管理

## 詳細

詳細は [CONTRIBUTING.md](../CONTRIBUTING.md) をご覧ください。
