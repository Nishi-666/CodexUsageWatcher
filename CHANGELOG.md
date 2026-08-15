# Changelog

All notable public changes to Codex Usage Watcher will be documented here.

## [1.1.1] - 2026-08-15

Initial public open-source release preparation.

### Added

- Git hygiene for user configuration, runtime state, logs, editor files, and local archives.
- `config.example.json`; `config.json` is generated locally on first use and is not tracked.
- GitHub Actions tests on supported Node.js LTS releases for Windows.
- Security policy, contribution guide, issue templates, and repository line-ending rules.
- English project overview plus Japanese documentation.

### Changed

- The app-server `clientInfo.version` now follows `package.json` instead of reporting a stale hard-coded version.
- Minimum supported Node.js version is now 22, avoiding End-of-Life Node.js 18 and 20 release lines.
- Documentation now distinguishes the official Codex npm package from Windows standalone/desktop installs.

### Security

- Watcher stop/status logic now fingerprints the process start time before trusting a stored PID, reducing stale-PID reuse risk.
- Public-repository defaults now reduce the risk of accidentally committing user email configuration, local usage history, logs, and environment files.
