---
name: immortal-agent-core
description: 既存のプロジェクトに「自律型・長時間稼働」機能を追加し、PID監視とJSONステート永続化による堅牢なプロセス管理体制を構築します。
---

# Immortal Agent Core Skill

このスキルは、あなたのプロジェクトに「死なないエージェント (Immortal Agent)」機能を追加します。
Watchdogプロセスによる死活監視、JSONによるステート永続化、およびバックオフリトライロジックを含みます。

## 前提条件
- Node.js v20+
- pnpm

## セットアップ手順

### 1. 依存関係のインストール

プロジェクトルートで以下のコマンドを実行し、ファイルシステム操作とTypeScript実行環境を整えます。

```bash
pnpm add fs-extra
pnpm add -D tsx @types/fs-extra @types/node
```

### 2. ディレクトリ構造の作成

エージェントの状態管理用ディレクトリを作成し、Git管理外に設定します。

```bash
mkdir -p .agent/state .agent/supervisors .agent/logs
echo ".agent/state\n.agent/logs" >> .gitignore
```

### 3. リソースの展開

このスキルに含まれるテンプレートファイルをプロジェクトに配置します。

#### A. Core Runtime (エージェント本体)
`src/agent/immortal-agent.ts` として配置します。

```bash
mkdir -p src/agent
cp {SKILL_DIR}/resources/runtime/immortal-agent.ts src/agent/immortal-agent.ts
```

#### B. Supervisor (Watchdogスクリプト)
`.agent/supervisors/run.sh` として配置し、実行権限を付与します。

```bash
cp {SKILL_DIR}/resources/supervisors/run.sh .agent/supervisors/run.sh
chmod +x .agent/supervisors/run.sh
```

## 使い方

### エージェントの実装
`src/agent/immortal-agent.ts` を開き、`start()` メソッド内の `// 擬似的な処理` 部分をあなたのビジネスロジックに置き換えてください。

```typescript
// src/agent/immortal-agent.ts

public async start() {
  while(true) {
    // ...
    // ここにあなたのロジックを書く
    await myCustomBotLogic.execute(this.stepId); 
    // ...
  }
}
```

### 起動方法 (Hardcore Launch)

**「ハードコア起動」** または **`/immortal`** というコマンドで、このエージェントをバックグラウンド起動することを推奨します。

1. `package.json` に以下を追加してください:
   ```json
   "scripts": {
     "immortal": "./.agent/supervisors/run.sh"
   }
   ```

2. 以下のコマンドで起動します:
   ```bash
   npm run immortal
   # または
   # ユーザー設定で「ハードコア起動」= "npm run immortal" とエイリアス設定
   ```

ログは `.agent/logs/immortal.log` に出力されます。
監視するには `tail -f .agent/logs/immortal.log` を使用してください。

### デバッグ機能
以下の空ファイルを作成することで、リカバリー機能をテストできます。

- **クラッシュテスト**: `touch .agent/debug_crash` (即座にプロセス終了 → 再起動)
- **フリーズテスト**: `touch .agent/debug_hang` (120秒停止 → タイムアウト検知 → 再起動)

---

## Toolchain

**Scripts**: None
**Knowledge**: None
**Related WF**: None
