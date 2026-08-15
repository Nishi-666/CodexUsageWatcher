'use strict';
const readline = require('node:readline');
const { version: packageVersion } = require('../package.json');
const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
let initialized = false;
rl.on('line', (line) => {
  if (!line.trim()) return;
  const msg = JSON.parse(line);
  if (msg.method === 'initialize') {
    if (msg.params?.clientInfo?.version !== packageVersion) {
      process.stdout.write(JSON.stringify({ id: msg.id, error: { code: -2, message: `Unexpected client version: ${msg.params?.clientInfo?.version}` } }) + '\n');
      return;
    }
    process.stdout.write(JSON.stringify({ id: msg.id, result: { userAgent: 'mock', platformFamily: 'windows', platformOs: 'windows' } }) + '\n');
    return;
  }
  if (msg.method === 'initialized') { initialized = true; return; }
  if (!initialized) {
    process.stdout.write(JSON.stringify({ id: msg.id, error: { code: -1, message: 'Not initialized' } }) + '\n');
    return;
  }
  if (msg.method === 'account/read') {
    process.stdout.write(JSON.stringify({ id: msg.id, result: { account: { type: 'chatgpt', planType: 'plus', email: 'mock@example.com' }, requiresOpenaiAuth: true } }) + '\n');
    return;
  }
  if (msg.method === 'account/rateLimits/read') {
    process.stdout.write(JSON.stringify({ id: msg.id, result: {
      rateLimitsByLimitId: {
        codex: { limitId: 'codex', limitName: null, primary: { usedPercent: 23, windowDurationMins: 300, resetsAt: 2000000000 }, secondary: { usedPercent: 51, windowDurationMins: 10080, resetsAt: 2000100000 }, rateLimitReachedType: null }
      },
      rateLimitResetCredits: { availableCount: 1, credits: null }
    } }) + '\n');
    return;
  }
  process.stdout.write(JSON.stringify({ id: msg.id, error: { code: -32601, message: 'Method not found' } }) + '\n');
});
