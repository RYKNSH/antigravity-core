#!/bin/bash
# ========================================
# デプロイスクリプト
# ========================================

set -e

echo "🦅 Aphelion Eagle - Deployment"
echo "=============================="

# 色の定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ----------------------------------------
# 事前チェック
# ----------------------------------------
echo ""
echo "🔍 Running pre-deployment checks..."

# 品質ゲート
echo "Running quality gate..."
npm run lint
npm run typecheck
npm run test
npm run build

echo -e "${GREEN}✅ All checks passed${NC}"

# ----------------------------------------
# デプロイ先の選択
# ----------------------------------------
echo ""
echo "Select deployment target:"
echo "  1) Vercel (Frontend)"
echo "  2) Railway (Backend)"
echo "  3) Both"
echo ""
read -p "Enter choice [1-3]: " choice

case $choice in
    1)
        echo ""
        echo "🚀 Deploying to Vercel..."
        npx vercel --prod
        ;;
    2)
        echo ""
        echo "🚀 Deploying to Railway..."
        railway up --environment production
        ;;
    3)
        echo ""
        echo "🚀 Deploying to Vercel..."
        npx vercel --prod
        echo ""
        echo "🚀 Deploying to Railway..."
        railway up --environment production
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

# ----------------------------------------
# 完了
# ----------------------------------------
echo ""
echo -e "${GREEN}🎉 Deployment complete!${NC}"
echo ""
echo "Post-deployment checklist:"
echo "  [ ] Verify application is running"
echo "  [ ] Check error logs"
echo "  [ ] Monitor performance metrics"
