#!/bin/bash
# ========================================
# 開発環境起動スクリプト
# ========================================

set -e

echo "🦅 Aphelion Eagle - Development Server"
echo "======================================="

# 環境変数の読み込み
if [[ -f ".env.local" ]]; then
    export $(cat .env.local | grep -v '^#' | xargs)
fi

# Turboで全サービスを起動
npm run dev
