'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { AppServerClient } = require('../src/app-server-client');

(async () => {
  const mock = path.join(__dirname, 'mock-app-server.js');
  const client = new AppServerClient({
    command: process.execPath,
    args: [mock],
    requestTimeoutMs: 5000,
    stderrLogFile: path.join(os.tmpdir(), 'codex-usage-watcher-mock.log'),
    logger: { warn() {} }
  });
  await client.start();
  const account = await client.request('account/read', { refreshToken: false });
  assert.equal(account.account.planType, 'plus');
  const limits = await client.request('account/rateLimits/read');
  assert.equal(limits.rateLimitsByLimitId.codex.primary.usedPercent, 23);
  assert.equal(limits.rateLimitResetCredits.availableCount, 1);
  client.close();
  console.log('PASS app-server JSONL integration');
})().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
