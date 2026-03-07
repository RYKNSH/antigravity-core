#!/bin/bash
# .agent/supervisors/run_immortal.sh

# 設定
# 注意: プロジェクトルートから実行することを想定
AGENT_CMD="npx tsx src/agent/immortal-agent.ts"
HEARTBEAT_FILE=".agent/state/heartbeat"
LOG_FILE=".agent/logs/immortal.log"
# テスト用に短めに設定 (30秒)
MAX_SILENCE_SEC=30

mkdir -p .agent/state .agent/logs

echo "[Supervisor] Starting Immortal Agent Supervisor..." | tee -a "$LOG_FILE"

# クリーンアップハンドラ
cleanup() {
    echo "[Supervisor] Shutting down..." | tee -a "$LOG_FILE"
    if [ -n "$AGENT_PID" ]; then
        kill $AGENT_PID 2>/dev/null
    fi
    exit 0
}
trap cleanup SIGINT SIGTERM

while true; do
    echo "[$(date)] Supervising agent..." >> "$LOG_FILE"

    # 1. エージェントをバックグラウンドで起動
    # tsxは終了しない限り走り続ける
    $AGENT_CMD >> "$LOG_FILE" 2>&1 &
    AGENT_PID=$!
    echo "[Supervisor] Agent started with PID: $AGENT_PID" | tee -a "$LOG_FILE"

    # 2. 監視ループ (プロセスが存在する間)
    while kill -0 $AGENT_PID 2>/dev/null; do
        sleep 5
        
        # Heartbeatチェック
        if [ -f "$HEARTBEAT_FILE" ]; then
            # dateコマンドの差異(Mac vs Linux)を吸収するため、パールやnodeを使わず簡易的に実装
            # Macのstat -f %m、Linuxのstat -c %Y の違いがあるため、ファイルの中身(Date.now())を使う
            LAST_HEARTBEAT_MS=$(cat "$HEARTBEAT_FILE")
            
            # 現在時刻(ミリ秒)取得 (nodeを使用)
            CURRENT_TIME_MS=$(node -e 'console.log(Date.now())')
            
            DIFF_MS=$((CURRENT_TIME_MS - LAST_HEARTBEAT_MS))
            DIFF_SEC=$((DIFF_MS / 1000))

            if [ "$DIFF_SEC" -gt "$MAX_SILENCE_SEC" ]; then
                echo "[Supervisor] ALERT: Heartbeat silent for ${DIFF_SEC}s. Killing PID $AGENT_PID" | tee -a "$LOG_FILE"
                kill -9 $AGENT_PID
                break # 再起動ループへ
            fi
        fi
    done

    echo "[Supervisor] Agent died. Restarting in 5 seconds..." | tee -a "$LOG_FILE"
    sleep 5
done
