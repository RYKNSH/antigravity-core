#!/usr/bin/env node
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const STATE_FILE = process.env.ANTIGRAVITY_DIR ? path.join(process.env.ANTIGRAVITY_DIR, '.session_state.json') : '/antigravity/.session_state.json';
const POLL_INTERVAL = 3000;

function readState() {
  if (!fs.existsSync(STATE_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch(e) {
    return null;
  }
}

function writeState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function loop() {
  console.log(`[Immortal Core] Starting Eternal Loop... Monitoring ${STATE_FILE}`);

  while (true) {
    try {
      const state = readState();
      if (!state) {
        await new Promise(r => setTimeout(r, POLL_INTERVAL));
        continue;
      }

      // 1. Process pending tasks
      if (state.pending_tasks && state.pending_tasks.length > 0) {
        const nextTask = state.pending_tasks[0];
        if (nextTask.status === 'pending') {
          console.log(`[Immortal Core] Found new task: ${nextTask.task}`);
          
          // Mark as in-progress
          state.current.workflow = nextTask.workflow || "/go";
          state.current.action = nextTask.task;
          state.current.action_ttl = nextTask.ttl || 300; // 5 minutes default
          state.current.action_updated_at = new Date().toISOString();
          
          nextTask.status = 'in_progress';
          writeState(state);

          // TODO: Actually trigger the Agent runtime via MCP Host Server or SSH tunnel
          // For now, simulated execution sleep
          
          console.log(`[Immortal Core] Simulating work on task via MCP/SSH Gateway...`);
          // simulate working time
          await new Promise(r => setTimeout(r, 2000));
          
          // Completion
          state.current.action = null;
          state.current.action_updated_at = null;
          state.current.action_ttl = null;
          state.pending_tasks.shift(); // remove completed
          writeState(state);
          
          console.log(`[Immortal Core] Task completed.`);
        }
      }

      // Update heartbeat so Healthcheck knows we are alive
      state.last_checkin = new Date().toISOString();
      writeState(state);

    } catch (e) {
      console.error("[Immortal Core] Loop error:", e);
    }
    
    await new Promise(r => setTimeout(r, POLL_INTERVAL));
  }
}

loop();
