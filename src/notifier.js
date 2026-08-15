'use strict';

const { spawn } = require('node:child_process');
const path = require('node:path');
const { formatEvent } = require('./format');

class Notifier {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.notifyScript = path.join(config._root, 'scripts', 'notify.ps1');
    this.mailScript = path.join(config._root, 'scripts', 'send-mail.ps1');
  }

  shouldNotify(evt) {
    const n = this.config.notifications;
    if (evt.type === 'NORMAL_RESET' && !n.notifyOnNormalReset) return false;
    if (evt.type === 'RESET_TIME_CHANGED' && !n.notifyOnResetTimeChanged) return false;
    if ((evt.type === 'RESET_CREDIT_ADDED' || evt.type === 'RESET_CREDIT_DECREASED') && !n.notifyOnCreditChange) return false;
    if (evt.type === 'WINDOW_ADDED' || evt.type === 'WINDOW_REMOVED') return false;
    return true;
  }

  async sendEvent(evt, snapshot) {
    if (!this.shouldNotify(evt)) return;
    const msg = formatEvent(evt, snapshot);
    this.logger.info(`Notification: ${msg.title}`, { type: evt.type, body: msg.body });
    await this.send(msg.title, msg.body, evt.severity || 'INFO');
  }

  async send(title, body, severity = 'INFO') {
    const jobs = [];
    const n = this.config.notifications;
    if (n.windows?.enabled) {
      jobs.push(this._runPowerShell(this.notifyScript, ['-Title', title, '-Body', body, '-Severity', severity, '-DisplaySeconds', String(n.windows.displaySeconds || 8), '-Sound', String(Boolean(n.windows.sound))], 15000));
    }
    if (n.email?.enabled) {
      jobs.push(this._runPowerShell(this.mailScript, ['-ConfigPath', this.config._configPath, '-Subject', title, '-Body', body], 30000));
    }
    const results = await Promise.allSettled(jobs);
    for (const r of results) if (r.status === 'rejected') this.logger.warn('Notification channel failed', { error: r.reason?.message || String(r.reason) });
  }

  _runPowerShell(script, args, timeoutMs) {
    return new Promise((resolve, reject) => {
      const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, ...args], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      let stderr = '';
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (d) => { stderr += d; });
      const timer = setTimeout(() => { try { child.kill(); } catch {} reject(new Error(`PowerShell notification timed out: ${path.basename(script)}`)); }, timeoutMs);
      child.on('error', (err) => { clearTimeout(timer); reject(err); });
      child.on('exit', (code) => { clearTimeout(timer); if (code === 0) resolve(); else reject(new Error(`${path.basename(script)} exited ${code}: ${stderr.trim()}`)); });
    });
  }
}

module.exports = { Notifier };
