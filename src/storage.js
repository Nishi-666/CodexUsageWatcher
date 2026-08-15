'use strict';
const fs = require('node:fs');
function loadState(filePath) { try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch (err) { if (err.code === 'ENOENT') return null; throw err; } }
function saveState(filePath, state) { const temp = `${filePath}.tmp`; fs.writeFileSync(temp, JSON.stringify(state, null, 2), 'utf8'); fs.renameSync(temp, filePath); }
function appendHistory(filePath, record) { fs.appendFileSync(filePath, `${JSON.stringify(record)}\n`, 'utf8'); }
module.exports = { loadState, saveState, appendHistory };
