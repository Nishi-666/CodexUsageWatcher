# Changelog

All notable public changes to Codex Usage Watcher will be documented here.

## [1.1.3] - 2026-08-27

### Fixed

- Treat near-100% usage (>=99.5%), <=0.5% remaining, or a server-reported limit state as effectively exhausted when deciding whether to emit `RESET_TIME_CHANGED`.
- Add a second defensive suppression check in the notifier, so an exhausted window cannot produce the Windows PowerShell reset-time notification even if such an event reaches the notification layer.

### Diagnostics

- `status.bat` now shows the watcher package version and the install folder it is reading, making stale or duplicate installations easier to identify.

### Tests

- Added regression coverage for near-100 floating-point usage values, explicit server limit state, and the boundary below the effective-exhaustion threshold.

## [1.1.2] - 2026-08-26

### Fixed

- Suppress `RESET_TIME_CHANGED` notifications while a usage window remains exhausted at 100% used. Codex can move `resetsAt` while refreshing an exhausted limit state; treating every movement as a real schedule change caused a notification on each 60-second poll.
- Preserve normal reset detection when usage actually recovers from 100%, so a real reset still emits `NORMAL_RESET` or `EARLY_RESET`.

### Tests

- Added regression coverage for a single exhausted reset-time movement, repeated 60-second exhausted polls, and recovery from 100% usage.

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
