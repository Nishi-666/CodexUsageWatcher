'use strict';

const { loadConfig } = require('./config');
const { resolveCodex } = require('./codex-resolver');

try {
  const config = loadConfig();
  const found = resolveCodex(config.codex.command);
  console.log(`Codex CLI: ${found.version}`);
  console.log(`Path: ${found.command}`);
  console.log(`Detected via: ${found.source}`);
  process.exit(0);
} catch (err) {
  console.error('[ERROR] Codex CLI was not found.');
  console.error('This Watcher needs the Codex CLI app-server; the desktop app alone is not enough.');
  console.error('Official npm install method:');
  console.error('  npm install -g @openai/codex');
  if (Array.isArray(err.attempts) && process.env.CODEX_WATCHER_DEBUG === '1') {
    console.error('\nDetection attempts:');
    for (const a of err.attempts) console.error(`- ${a.command}: ${a.error || 'failed'}`);
  }
  process.exit(2);
}
