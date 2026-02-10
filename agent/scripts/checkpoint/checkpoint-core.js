#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { execa } from 'execa';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { scanForSecrets, printSecurityReport } from './lib/secret_scanner.js';

const ARGS = process.argv.slice(2);
const COMMAND = ARGS[0];

const LOG_DIR = '/Volumes/PortableSSD/.antigravity/brain/checkpoint_logs';
const LOG_FILE = path.join(LOG_DIR, 'history.jsonl');

function logToBrain(type, data) {
    try {
        if (!fs.existsSync(LOG_DIR)) {
            fs.mkdirSync(LOG_DIR, { recursive: true });
        }
        
        const entry = {
            timestamp: new Date().toISOString(),
            type,
            context: process.cwd(),
            ...data
        };
        
        fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
    } catch (e) {
        // Fail silently or warn, but don't break the tool
        // console.error(chalk.yellow(`Note: Could not log to Brain: ${e.message}`));
    }
}


async function main() {
    if (!COMMAND) {
        showHelp();
        return;
    }

    switch (COMMAND) {
        case 'safe':
            await runSafe();
            break;
        case 'done':
            await runDone();
            break;
        case 'undo':
            await runUndo();
            break;
        case 'init':
            await runInit();
            break;
        default:
            console.log(chalk.red(`Unknown command: ${COMMAND}`));
            showHelp();
    }
}

function showHelp() {
    console.log(`
${chalk.bold('Usage:')} checkpoint <command>

${chalk.bold('Commands:')}
  ${chalk.cyan('safe')}   Quickly save state (git add + commit "WIP" + tag)
  ${chalk.cyan('done')}   Commit completed work with AI instruction log
  ${chalk.cyan('undo')}   Rollback to previous state
  ${chalk.cyan('init')}   Generate VS Code tasks
`);
}

async function runSafe() {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const tagName = `safe-${timestamp}`;

        console.log(chalk.gray('Creating safety snapshot...'));
        await execa('git', ['add', '.']);
        
        // Check if there are changes to commit
        const status = await execa('git', ['status', '--porcelain']);
        if (status.stdout) {
             await execa('git', ['commit', '-m', `WIP: Safety snapshot ${timestamp}`]);
        }

        await execa('git', ['tag', tagName]);
        
        logToBrain('SAFE', { 
            tagName, 
            description: `WIP: Safety snapshot ${timestamp}` 
        });

        console.log(chalk.green(`✅ Checkpoint created: ${chalk.bold(tagName)}`));
    } catch (error) {
        console.error(chalk.red('Failed to create checkpoint:'), error.message);
    }
}

async function runDone() {
    console.log(chalk.cyan('🤖 AI Task Completion Logger'));
    
    const answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'feature',
            message: 'Feature/Task Name:',
            validate: input => input.length > 0
        },
        {
            type: 'editor',
            name: 'instructions',
            message: 'AI Instructions/Context (Secret scanned):'
        }
    ]);

    // Security Scan
    const secrets = scanForSecrets(answers.instructions);
    if (secrets.length > 0) {
        printSecurityReport(secrets);
        const { proceed } = await inquirer.prompt([{
            type: 'confirm',
            name: 'proceed',
            message: 'Do you want to proceed despite warnings?',
            default: false
        }]);
        if (!proceed) {
            console.log(chalk.yellow('Aborted by user.'));
            return;
        }
    }

    try {
        const commitMsg = `feat: ${answers.feature} (AI Assist)\n\n${answers.instructions}`;
        await execa('git', ['add', '.']);
        await execa('git', ['commit', '-m', commitMsg]);
        
        logToBrain('DONE', { 
            feature: answers.feature, 
            instructions: answers.instructions 
        });

        console.log(chalk.green('✅ Changes committed successfully!'));
    } catch (error) {
        console.error(chalk.red('Failed to commit:'), error.message);
    }
}

async function runUndo() {
    try {
        const { stdout: log } = await execa('git', ['log', '--oneline', '-n', '10']);
        const choices = log.split('\n').map(line => ({
            name: line,
            value: line.split(' ')[0]
        }));

        const { commitHash } = await inquirer.prompt([{
            type: 'list',
            name: 'commitHash',
            message: 'Select commit to reset to (HARD RESET):',
            choices
        }]);

        const { confirm } = await inquirer.prompt([{
            type: 'confirm',
            name: 'confirm',
            message: chalk.red(`Are you sure you want to HARD RESET to ${commitHash}? All uncommitted changes will be lost.`),
            default: false
        }]);

        if (confirm) {
            await execa('git', ['reset', '--hard', commitHash]);
            console.log(chalk.green(`Reverted to ${commitHash}`));
        }
    } catch (error) {
        console.error(chalk.red('Error listing/resetting:'), error.message);
    }
}

async function runInit() {
    const vscodeDir = '.vscode';
    const tasksFile = path.join(vscodeDir, 'tasks.json');

    if (!fs.existsSync(vscodeDir)) {
        fs.mkdirSync(vscodeDir);
    }

    const tasksConfig = {
        version: "2.0.0",
        tasks: [
            {
                label: "Checkpoint: Safe",
                type: "shell",
                command: "checkpoint safe",
                presentation: { reveal: "silent" }
            },
            {
                label: "Checkpoint: Done",
                type: "shell",
                command: "checkpoint done",
                presentation: { reveal: "always" }
            }
        ]
    };

    fs.writeFileSync(tasksFile, JSON.stringify(tasksConfig, null, 4));
    console.log(chalk.green(`✅ Created ${tasksFile}`));
}

main();
