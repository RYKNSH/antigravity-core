#!/bin/bash
# ========================================
# 初期セットアップスクリプト
# ========================================

set -e  # エラー時に停止

echo "🦅 Aphelion Eagle - Initial Setup"
echo "=================================="

# 色の定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ----------------------------------------
# Node.js 環境のセットアップ
# ----------------------------------------
echo ""
echo "📦 Setting up Node.js environment..."

# Node.js バージョンチェック
NODE_VERSION=$(node -v 2>/dev/null || echo "not installed")
if [[ "$NODE_VERSION" == "not installed" ]]; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js 20+${NC}"
    exit 1
fi

NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1 | sed 's/v//')
if [[ "$NODE_MAJOR" -lt 20 ]]; then
    echo -e "${YELLOW}⚠️  Node.js version $NODE_VERSION detected. Recommended: 20+${NC}"
fi

echo -e "${GREEN}✅ Node.js $NODE_VERSION${NC}"

# npm パッケージのインストール
echo ""
echo "📥 Installing npm packages..."
npm install

# ----------------------------------------
# 環境変数のセットアップ
# ----------------------------------------
echo ""
echo "⚙️  Setting up environment variables..."

if [[ ! -f ".env.local" ]]; then
    cp .env.example .env.local
    echo -e "${GREEN}✅ Created .env.local from template${NC}"
    echo -e "${YELLOW}⚠️  Please edit .env.local with your API keys${NC}"
else
    echo -e "${GREEN}✅ .env.local already exists${NC}"
fi

# ----------------------------------------
# Git Hooks のセットアップ
# ----------------------------------------
echo ""
echo "🔧 Setting up Git hooks..."
npx husky install 2>/dev/null || true
echo -e "${GREEN}✅ Git hooks configured${NC}"

# ----------------------------------------
# 完了
# ----------------------------------------
echo ""
echo "=================================="
echo -e "${GREEN}🎉 Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Edit .env.local with your API keys"
echo "  2. Run 'npm run dev' to start development"
echo ""
echo "Read docs/PRINCIPLES.md to understand the development philosophy."
