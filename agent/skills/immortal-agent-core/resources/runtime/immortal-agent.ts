import fs from 'fs-extra';
import path from 'path';

// 設定
const STATE_PATH = path.resolve('.agent/state/agent_state.json');
const HEARTBEAT_PATH = path.resolve('.agent/state/heartbeat');
const LOG_PATH = path.resolve('.agent/logs/immortal.log');

interface AgentState {
    stepId: number;
    lastRun: string;
}

export class ImmortalAgent {
    private stepId: number = 0;

    constructor() {
        this.ensureDirectories();
        this.recoverState();
    }

    private ensureDirectories() {
        fs.ensureDirSync(path.dirname(STATE_PATH));
        fs.ensureDirSync(path.dirname(HEARTBEAT_PATH));
        fs.ensureDirSync(path.dirname(LOG_PATH));
    }

    private recoverState() {
        try {
            if (fs.existsSync(STATE_PATH)) {
                const state = fs.readJsonSync(STATE_PATH) as AgentState;
                this.stepId = state.stepId;
                this.log(`Recovered state: Step ${this.stepId}`);
            } else {
                this.log('No previous state found. Starting fresh.');
                this.stepId = 0;
            }
        } catch (error) {
            this.log(`Failed to recover state: ${error}. Starting fresh.`);
            this.stepId = 0;
        }
    }

    private saveState() {
        const state: AgentState = {
            stepId: this.stepId,
            lastRun: new Date().toISOString()
        };
        // Atomic write pattern
        fs.writeJsonSync(STATE_PATH, state, { spaces: 2 });
    }

    private log(message: string) {
        const timestamp = new Date().toISOString();
        const formattedMessage = `[${timestamp}] [Agent] ${message}`;
        console.log(formattedMessage);
        fs.appendFileSync(LOG_PATH, formattedMessage + '\n');
    }

    private heartbeat() {
        fs.writeFileSync(HEARTBEAT_PATH, Date.now().toString());
    }

    public async start() {
        this.log('Starting Immortal Agent Loop...');

        while (true) {
            try {
                await this.heartbeat();

                // 擬似的な処理
                this.stepId++;
                this.log(`Executing Step ${this.stepId}...`);

                // テスト用: 特定の条件でクラッシュやハングをシミュレート
                await this.checkDebugTriggers();

                this.saveState();

                // 通常の待機 (5秒)
                await new Promise(resolve => setTimeout(resolve, 5000));

            } catch (error) {
                this.log(`Error in loop: ${error}`);
                // エラー時は少し長く待つ
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }

    private async checkDebugTriggers() {
        // ファイルベースのデバッグトリガー
        // .agent/debug_crash ファイルが存在したらクラッシュ
        if (fs.existsSync('.agent/debug_crash')) {
            this.log('DEBUG TRIGGER: Simulating CRASH!');
            fs.removeSync('.agent/debug_crash');
            process.exit(1);
        }

        // .agent/debug_hang ファイルが存在したらハング (120秒スリープ)
        if (fs.existsSync('.agent/debug_hang')) {
            this.log('DEBUG TRIGGER: Simulating HANG (Sleeping 120s)...');
            fs.removeSync('.agent/debug_hang');
            await new Promise(resolve => setTimeout(resolve, 120000));
        }
    }
}

// 実行
if (require.main === module) {
    const agent = new ImmortalAgent();
    agent.start().catch(err => console.error(err));
}
