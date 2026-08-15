'use strict';

const { spawn } = require('node:child_process');
const readline = require('node:readline');
const fs = require('node:fs');
const { version: packageVersion } = require('../package.json');
const { EventEmitter } = require('node:events');

class AppServerClient extends EventEmitter {
  constructor({ command, args, requestTimeoutMs, stderrLogFile, logger, shell }) {
    super();
    this.command = command;
    this.args = args || [];
    this.requestTimeoutMs = requestTimeoutMs || 20000;
    this.stderrLogFile = stderrLogFile;
    this.logger = logger;
    this.shell = shell;
    this.proc = null;
    this.rl = null;
    this.nextId = 1;
    this.pending = new Map();
    this.closed = false;
  }

  async start() {
    if (this.proc) throw new Error('app-server client already started');
    this.closed = false;

    this.proc = spawn(this.command, this.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      shell: this.shell ?? (process.platform === 'win32')
    });

    this.proc.on('error', (err) => this._handleFatal(err));
    this.proc.on('exit', (code, signal) => {
      const err = new Error(`codex app-server exited (code=${code}, signal=${signal || 'none'})`);
      err.code = code;
      this._handleFatal(err);
    });

    this.proc.stderr.setEncoding('utf8');
    this.proc.stderr.on('data', (chunk) => {
      try { fs.appendFileSync(this.stderrLogFile, chunk, 'utf8'); } catch {}
    });

    this.rl = readline.createInterface({ input: this.proc.stdout, crlfDelay: Infinity });
    this.rl.on('line', (line) => this._onLine(line));

    const init = await this.request('initialize', {
      clientInfo: {
        name: 'codex_usage_watcher',
        title: 'Codex Usage Watcher',
        version: packageVersion
      }
    });
    this.notify('initialized', {});
    return init;
  }

  request(method, params) {
    if (!this.proc || !this.proc.stdin.writable) {
      return Promise.reject(new Error('app-server is not writable'));
    }
    const id = this.nextId++;
    const message = { method, id };
    if (params !== undefined) message.params = params;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Request timed out: ${method}`));
      }, this.requestTimeoutMs);
      this.pending.set(id, { resolve, reject, timer, method });
      this._send(message);
    });
  }

  notify(method, params) {
    const message = { method };
    if (params !== undefined) message.params = params;
    this._send(message);
  }

  _send(message) {
    const line = `${JSON.stringify(message)}\n`;
    this.proc.stdin.write(line);
  }

  _onLine(line) {
    if (!line.trim()) return;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch (err) {
      this.logger.warn('Non-JSON line from app-server stdout', { line: line.slice(0, 500) });
      return;
    }

    if (Object.prototype.hasOwnProperty.call(msg, 'id')) {
      const pending = this.pending.get(msg.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(msg.id);
      if (msg.error) {
        const err = new Error(msg.error.message || `RPC error in ${pending.method}`);
        err.rpcError = msg.error;
        pending.reject(err);
      } else {
        pending.resolve(msg.result);
      }
      return;
    }

    if (msg.method) this.emit('notification', msg);
  }

  _handleFatal(err) {
    if (this.closed) return;
    this.closed = true;
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(err);
    }
    this.pending.clear();
    this.emit('fatal', err);
  }

  close() {
    this.closed = true;
    if (this.rl) this.rl.close();
    if (this.proc && !this.proc.killed) {
      try { this.proc.kill(); } catch {}
    }
    this.proc = null;
  }
}

module.exports = { AppServerClient };
