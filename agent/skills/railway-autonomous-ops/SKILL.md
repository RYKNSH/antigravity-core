---
name: railway-autonomous-ops
description: Railwayへのデプロイ・環境変数設定・Volume管理を自律的に行うスキル
---

# Railway Autonomous Operations Skill

Railway CLIを使用して、プロジェクトの作成、デプロイ、環境設定、永続ストレージ管理を行います。

## 前提条件
- `railway` CLIがインストールされていること (`npm i -g @railway/cli`)
- `railway login` で認証済みであること

## コマンド一覧

### 1. プロジェクト作成 & リンク
```bash
# 新規プロジェクト作成
railway init --name "MyProject"

# 既存プロジェクトにリンク
railway link [project-id]
```

### 2. サービス作成
Railway Config (`railway.toml`) がルートにある場合、`railway up` で自動的にサービスが作成されます。
モノレポ構成の場合、各サービスのルートディレクトリを指定して実行します。

```bash
# Backendサービスのデプロイ
railway up --service backend

# Frontendサービスのデプロイ
railway up --service dashboard
```

### 3. 環境変数設定
```bash
# 単一変数の設定
railway variables set KEY=VALUE --service backend

# 複数変数の設定
railway variables set KEY1=VAL1 KEY2=VAL2 --service backend

# 環境変数の確認
railway variables get --service backend
```

### 4. Volume (永続ストレージ) 管理
Proプラン以上が必要です。
CLIでのVolume作成は現在サポートされていない場合があるため、UI推奨ですが、マウント設定は可能です。

```bash
# Volumeマウント設定
railway volume add --service backend --mount-path /app/projects
```

### 5. ドメイン生成
```bash
railway domain add --service backend
```

## 自動デプロイフロー (monorepo)

1. **Backend**:
   ```bash
   railway up --service backend --detach
   # ドメイン取得
   BACKEND_URL=$(railway domain show --service backend --json | jq -r .domain)
   ```

2. **Frontend**:
   ```bash
   railway variables set NEXT_PUBLIC_API_URL=https://$BACKEND_URL --service dashboard
   railway up --service dashboard --detach
   ```

3. **CORS設定**:
   ```bash
   FRONTEND_URL=$(railway domain show --service dashboard --json | jq -r .domain)
   railway variables set CORS_ORIGINS="[\"https://$FRONTEND_URL\"]" --service backend
   ```

## トラブルシューティング
- **"Project not found"**: `railway link`を確認してください。
- **"Payment method required"**: Volumeなど有料機能を使う場合、Proプランかクレジットカード登録が必要です。
