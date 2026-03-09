#!/bin/bash
# ---------------------------------------------------------
# Git Fetch Safe Wrapper
# ---------------------------------------------------------
# タイムアウト検知とリトライを組み合わせた堅牢なスクリプト
# I/Oハング（DステートやTCPブラックホール）対策用

# 第一引数でタイムアウト秒数を指定可能（デフォルト60秒）
TIMEOUT_SEC=${1:-60}
shift || true

# 残りの引数を git fetch に渡す
FETCH_ARGS="$@"
if [ -z "$FETCH_ARGS" ]; then
    FETCH_ARGS="--prune"
fi

# 認証プロンプトでハングするのを防ぐ
export GIT_TERMINAL_PROMPT=0

echo "[INFO] Running: timeout $TIMEOUT_SEC git fetch $FETCH_ARGS"
timeout "$TIMEOUT_SEC" git fetch $FETCH_ARGS
EXIT=$?

if [ $EXIT -eq 124 ]; then
    echo "[WARN] git fetch timed out after ${TIMEOUT_SEC}s. Retrying once..."
    
    # リトライ前に少し待つ（ネットワークの一時的な詰まり解消への期待）
    sleep 2
    
    echo "[INFO] Retrying: timeout $TIMEOUT_SEC git fetch $FETCH_ARGS"
    timeout "$TIMEOUT_SEC" git fetch $FETCH_ARGS
    RETRY_EXIT=$?
    
    if [ $RETRY_EXIT -eq 124 ]; then
        echo "[ERROR] git fetch timed out again. Aborting."
        exit 124
    else
        exit $RETRY_EXIT
    fi
else
    exit $EXIT
fi
