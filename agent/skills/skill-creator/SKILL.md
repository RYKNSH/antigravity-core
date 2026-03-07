---
name: skill-creator
description: 高品質なAgent Skillを作成するためのガイド。スキルの設計原則、構造、Progressive Disclosure、パッケージングまで。
source: anthropics/skills (公式)
---

# Skill Creator

Agent Skillの効果的な作成ガイド。

## スキルの構造

```
skill-name/
├── SKILL.md          # 必須: メインの指示ファイル
├── scripts/          # オプション: ヘルパースクリプト
├── examples/         # オプション: 参照実装
└── resources/        # オプション: テンプレート・アセット
```

## コア原則

### 1. Concise is Key
- SKILL.mdは短く保つ（理想: 100-300行）
- 詳細はresources/に分離
- AIが一度に読んでコンテキストを消費しない設計

### 2. Progressive Disclosure
- **Layer 1**: SKILL.md（常に読み込まれる）→ 最小限のメタデータ
- **Layer 2**: resources/（必要時にAIが読む）→ 詳細ルール・例
- **Layer 3**: examples/（実装時に参照）→ 完全な実装例

### 3. Set Appropriate Degrees of Freedom
- 厳密すぎる → 柔軟性がなくなる
- 緩すぎる → 品質がばらつく
- ガードレール（禁止事項）+ ガイダンス（推奨パターン）のバランス

## 作成プロセス

1. **理解**: 具体的な例から始める。何を達成したいか？
2. **計画**: 再利用可能なパターンを抽出
3. **初期化**: ディレクトリ構造を作成
4. **編集**: SKILL.mdを書く（frontmatter + 手順）
5. **パッケージ**: scripts/resources/を追加
6. **反復**: 実際に使って改善

## SKILL.md フロントマター

```yaml
---
name: skill-name
description: 1-2文の説明（AIがこのスキルを呼ぶべきかの判断に使用）
---
```
