'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');

for (const script of ['run-tests.js', 'integration-app-server.js']) {
  const full = path.join(__dirname, script);
  const r = spawnSync(process.execPath, [full], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status || 1);
}
console.log('\nAll tests passed.');
