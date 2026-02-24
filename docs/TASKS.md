# Antigravity Core Self-Improving Pipeline — TASKS

> **現在のフェーズ**: Phase 1 — brain_log 構造化
> **今すぐ着手可能なタスク**: 1.1.1

---

## 🔶 MS 1.1: brain_log 構造化フォーマット定義（進行中）

### タスク 1.1.1: `INCIDENT_FORMAT.md` 作成
- **工数**: 小（1セッション以内）
- **担当ファイル**: `~/.antigravity/INCIDENT_FORMAT.md`
- **内容**: 構造化MDのフォーマット定義 + OPENサンプル + FIXEDサンプル
- **完了チェック**: AIがフォーマットを参照してbrain_logを書けるか確認

### タスク 1.1.2: `checkout.md` に構造化MD自動出力ステップを追加
- **工数**: 小
- **担当ファイル**: `~/.antigravity/agent/workflows/checkout.md`
- **内容**: セッション終了時に `brain_log/session_MMDD.md` を構造化形式で出力するステップ
- **依存**: 1.1.1
- **完了チェック**: checkout実行後にファイルが生成されることを確認

### タスク 1.1.3: `dependency_map.json` に brain_log セクション追記
- **工数**: 小
- **担当ファイル**: `~/.antigravity/dependency_map.json`
- **内容**: `brain_log` の reads/writes/format_spec を追記
- **依存**: 1.1.1
- **完了チェック**: JSON lintが通ること

### タスク 1.1.4: 動作確認テスト
- **工数**: 小
- **内容**: 1セッション実行して構造化MDが正しく出力されることを確認
- **依存**: 1.1.2, 1.1.3
- **完了チェック**: `grep "type: hang" brain_log/session_*.md` で検索できる

---

## ⬜ MS 2.1: GitHub Actions 依存マップ整合性CI

### タスク 2.1.1: `.github/workflows/ci.yml` スケルトン
- **工数**: 小
- **担当ファイル**: `~/.antigravity/.github/workflows/ci.yml`
- **内容**: PR trigger + node setup + 基本ジョブ構造
- **依存**: MS1.1完了後に着手

### タスク 2.1.2: `scripts/check_dependency_map.js` 作成
- **工数**: 中
- **内容**: dependency_map.jsonの全readsファイルが実在するか確認
- **依存**: 2.1.1

### タスク 2.1.3: JSON lintステップ
- **工数**: 小
- **内容**: `node -e "JSON.parse(fs.readFileSync('dependency_map.json'))"` でlint
- **依存**: 2.1.1

### タスク 2.1.4: テストPRで自動実行確認
- **工数**: 小
- **依存**: 2.1.2, 2.1.3

---

## ⬜ MS 3.1: サーバー版 evolve エンジン
*(MS 2.1完了後に詳細化)*

---

## ⬜ MS 4.1: chaos_monkey.js CI統合
*(MS 3.1完了後 + サンドボックス確保後に詳細化)*
