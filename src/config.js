'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(ROOT, 'config.json');
const EXAMPLE_CONFIG_PATH = path.join(ROOT, 'config.example.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function ensureDirFor(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function ensureUserConfig() {
  if (fs.existsSync(CONFIG_PATH)) return CONFIG_PATH;
  if (!fs.existsSync(EXAMPLE_CONFIG_PATH)) {
    throw new Error(`Configuration template is missing: ${EXAMPLE_CONFIG_PATH}`);
  }
  try {
    fs.copyFileSync(EXAMPLE_CONFIG_PATH, CONFIG_PATH, fs.constants.COPYFILE_EXCL);
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
  return CONFIG_PATH;
}

function loadConfig() {
  const configPath = ensureUserConfig();
  const config = readJson(configPath);

  if (!config.storage || typeof config.storage !== 'object') {
    throw new Error('config.json: storage section is required.');
  }

  for (const key of ['stateFile', 'historyFile', 'eventLogFile', 'appServerLogFile']) {
    if (typeof config.storage[key] !== 'string' || !config.storage[key].trim()) {
      throw new Error(`config.json: storage.${key} must be a non-empty string.`);
    }
    config.storage[key] = path.resolve(ROOT, config.storage[key]);
    ensureDirFor(config.storage[key]);
  }

  config._root = ROOT;
  config._configPath = configPath;
  return config;
}

module.exports = { ROOT, CONFIG_PATH, EXAMPLE_CONFIG_PATH, ensureUserConfig, loadConfig };
