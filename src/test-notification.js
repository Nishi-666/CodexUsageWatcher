'use strict';
const { loadConfig } = require('./config');
const { Logger } = require('./logger');
const { Notifier } = require('./notifier');
(async () => {
  const config = loadConfig(); const logger = new Logger(config.storage.eventLogFile); const notifier = new Notifier(config, logger);
  await notifier.send('Codex Usage Watcher テスト', 'Windows通知とアラーム音のテストです。メールを有効化している場合はメールも送信します。', 'NOTICE');
  console.log('通知テストを実行しました。');
})().catch((err) => { console.error(err.stack || err.message); process.exit(1); });
