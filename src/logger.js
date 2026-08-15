'use strict';
const fs = require('node:fs');
class Logger {
  constructor(filePath) { this.filePath = filePath; }
  line(level, message, extra) {
    const ts = new Date().toISOString();
    const suffix = extra === undefined ? '' : ` ${safeJson(extra)}`;
    const text = `${ts} [${level}] ${message}${suffix}`;
    console.log(text);
    try { fs.appendFileSync(this.filePath, `${text}\n`, 'utf8'); } catch (err) { console.error(`${ts} [LOGGER] Failed to write log: ${err.message}`); }
  }
  info(message, extra) { this.line('INFO', message, extra); }
  warn(message, extra) { this.line('WARN', message, extra); }
  error(message, extra) { this.line('ERROR', message, extra); }
  debug(message, extra) { this.line('DEBUG', message, extra); }
}
function safeJson(value) { try { return JSON.stringify(value); } catch { return '"<unserializable>"'; } }
module.exports = { Logger };
