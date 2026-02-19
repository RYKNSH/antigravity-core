#!/bin/bash
# validate_pr.sh - PR品質ゲート用ヘッドレス検証スクリプト
# 使用法: ./validate_pr.sh [検証対象ディレクトリ]

TARGET_DIR="${1:-.}"
OUTPUT_DIR="/tmp/antigravity_validation"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

mkdir -p "$OUTPUT_DIR"

echo "🔍 Antigravity PR Validation"
echo "============================"
echo "Target: $TARGET_DIR"
echo "Time: $TIMESTAMP"
echo ""

# 1. Lint チェック
echo "1/4 Running lint..."
if pnpm lint 2>&1 | tee "$OUTPUT_DIR/lint_$TIMESTAMP.log"; then
    echo "✅ Lint passed"
else
    echo "❌ Lint failed"
    LINT_FAILED=1
fi

# 2. Type チェック
echo ""
echo "2/4 Running typecheck..."
if pnpm typecheck 2>&1 | tee "$OUTPUT_DIR/typecheck_$TIMESTAMP.log"; then
    echo "✅ Typecheck passed"
else
    echo "❌ Typecheck failed"
    TYPE_FAILED=1
fi

# 3. テスト実行
echo ""
echo "3/4 Running tests..."
if pnpm test 2>&1 | tee "$OUTPUT_DIR/test_$TIMESTAMP.log"; then
    echo "✅ Tests passed"
else
    echo "❌ Tests failed"
    TEST_FAILED=1
fi

# 4. セキュリティチェック（簡易）
echo ""
echo "4/4 Running security check..."
SECURITY_ISSUES=0

# ハードコードされたシークレットのパターン検索
if grep -rn "api[_-]?key\s*[:=]\s*['\"][^'\"]\+" "$TARGET_DIR" --include="*.ts" --include="*.js" 2>/dev/null | grep -v "process.env" | grep -v ".example"; then
    echo "⚠️ Potential hardcoded API keys found"
    SECURITY_ISSUES=$((SECURITY_ISSUES + 1))
fi

if grep -rn "password\s*[:=]\s*['\"][^'\"]\+" "$TARGET_DIR" --include="*.ts" --include="*.js" 2>/dev/null | grep -v "process.env"; then
    echo "⚠️ Potential hardcoded passwords found"
    SECURITY_ISSUES=$((SECURITY_ISSUES + 1))
fi

if [ $SECURITY_ISSUES -eq 0 ]; then
    echo "✅ No obvious security issues"
else
    echo "❌ $SECURITY_ISSUES security issues found"
fi

# 結果サマリー
echo ""
echo "============================"
echo "Validation Summary"
echo "============================"

FAILED=0
[ -n "$LINT_FAILED" ] && FAILED=$((FAILED + 1)) && echo "❌ Lint"
[ -n "$TYPE_FAILED" ] && FAILED=$((FAILED + 1)) && echo "❌ Typecheck"
[ -n "$TEST_FAILED" ] && FAILED=$((FAILED + 1)) && echo "❌ Tests"
[ $SECURITY_ISSUES -gt 0 ] && FAILED=$((FAILED + 1)) && echo "❌ Security"

if [ $FAILED -eq 0 ]; then
    echo ""
    echo "🎉 All checks passed!"
    exit 0
else
    echo ""
    echo "💥 $FAILED check(s) failed"
    echo "Logs saved to: $OUTPUT_DIR"
    exit 1
fi
