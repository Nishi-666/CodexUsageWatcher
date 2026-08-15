'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function unique(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    if (!item || !item.command) continue;
    const key = process.platform === 'win32'
      ? item.command.toLowerCase()
      : item.command;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function pathLookup(command) {
  const tool = process.platform === 'win32' ? 'where.exe' : 'which';
  const r = spawnSync(tool, [command], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 5000
  });
  if (r.status !== 0) return [];
  return String(r.stdout || '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildCandidates(configuredCommand = 'auto', env = process.env) {
  const candidates = [];

  if (env.CODEX_WATCHER_CODEX) {
    candidates.push({ command: env.CODEX_WATCHER_CODEX, source: 'CODEX_WATCHER_CODEX' });
  }

  if (configuredCommand && !['auto', 'codex'].includes(String(configuredCommand).toLowerCase())) {
    candidates.push({ command: configuredCommand, source: 'config.json' });
  }

  for (const found of pathLookup('codex')) {
    candidates.push({ command: found, source: 'PATH' });
  }

  if (process.platform === 'win32') {
    const localAppData = env.LOCALAPPDATA;
    const userProfile = env.USERPROFILE;
    const appData = env.APPDATA;
    const installDir = env.CODEX_INSTALL_DIR;

    if (installDir) {
      candidates.push({ command: path.join(installDir, 'codex.exe'), source: 'CODEX_INSTALL_DIR' });
    }
    if (localAppData) {
      candidates.push({
        command: path.join(localAppData, 'Programs', 'OpenAI', 'Codex', 'bin', 'codex.exe'),
        source: 'official standalone install'
      });
    }
    if (userProfile) {
      candidates.push({
        command: path.join(userProfile, '.codex', 'packages', 'standalone', 'current', 'bin', 'codex.exe'),
        source: 'official standalone current package'
      });
      candidates.push({
        command: path.join(userProfile, '.codex', 'packages', 'standalone', 'current', 'codex.exe'),
        source: 'legacy standalone current package'
      });
    }
    if (appData) {
      candidates.push({ command: path.join(appData, 'npm', 'codex.cmd'), source: 'npm global shim' });
      candidates.push({ command: path.join(appData, 'npm', 'codex.exe'), source: 'npm global executable' });
    }
  }

  if (!configuredCommand || ['auto', 'codex'].includes(String(configuredCommand).toLowerCase())) {
    candidates.push({ command: 'codex', source: 'shell fallback' });
  }

  return unique(candidates);
}

function shouldUseShell(command) {
  if (process.platform !== 'win32') return false;
  return /\.(cmd|bat)$/i.test(command) || !/[\\/]/.test(command);
}

function verifyCandidate(candidate) {
  const hasPathSeparator = /[\\/]/.test(candidate.command);
  if (hasPathSeparator && !fs.existsSync(candidate.command)) {
    return { ...candidate, ok: false, error: 'file does not exist' };
  }

  const r = spawnSync(candidate.command, ['--version'], {
    encoding: 'utf8',
    windowsHide: true,
    shell: shouldUseShell(candidate.command),
    timeout: 8000
  });

  if (r.error) return { ...candidate, ok: false, error: r.error.message };
  if (r.status !== 0) {
    return { ...candidate, ok: false, error: String(r.stderr || r.stdout || `exit ${r.status}`).trim().slice(0, 300) };
  }

  return { ...candidate, ok: true, version: String(r.stdout || r.stderr || '').trim() || 'version unknown', shell: shouldUseShell(candidate.command) };
}

function resolveCodex(configuredCommand = 'auto') {
  const attempts = [];
  for (const candidate of buildCandidates(configuredCommand)) {
    const checked = verifyCandidate(candidate);
    attempts.push(checked);
    if (checked.ok) return { ...checked, attempts };
  }
  const err = new Error('Codex CLI could not be found or executed.');
  err.code = 'CODEX_NOT_FOUND';
  err.attempts = attempts;
  throw err;
}

module.exports = { buildCandidates, resolveCodex, shouldUseShell, verifyCandidate };
