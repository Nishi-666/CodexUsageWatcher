# Codex Usage Watcher

> Unofficial Windows utility for monitoring Codex ChatGPT rate-limit usage, reset timing, limit exhaustion, and recovery events through the documented Codex app-server protocol.

[日本語](README.ja.md)

## Why this exists

Codex Usage Watcher keeps a small local process running on Windows, reads the rate-limit state exposed by `codex app-server`, stores local history, and notifies you when meaningful changes occur.

It is designed for people who use Codex heavily and want to know when a usage window resets or approaches exhaustion without scraping the ChatGPT website.

## Highlights

- Uses the documented Codex app-server stdio JSONL/JSON-RPC interface.
- Reads `account/read` and `account/rateLimits/read`.
- Reacts to `account/rateLimits/updated` and also polls as a fallback.
- Supports multiple rate-limit buckets when `rateLimitsByLimitId` is available.
- Detects scheduled and locally inferred early resets.
- Warns at configurable remaining-usage thresholds.
- Detects server-reported limit state changes and Reset Credit count changes.
- Windows balloon/sound notifications.
- Optional SMTP email notifications.
- Local JSON/JSONL history; no external npm dependencies.
- Automatic Codex CLI discovery across common Windows installations.

## Important scope and disclaimer

This project is **not an OpenAI product** and is not affiliated with or endorsed by OpenAI.

It does not scrape the ChatGPT web UI and does not ask for ChatGPT cookies. It launches the Codex CLI's local `app-server` and uses the authentication already managed by Codex CLI.

Upstream Codex app-server behavior can change. The watcher intentionally stays on documented methods, but compatibility can still break after a Codex update.

Official app-server documentation:

https://developers.openai.com/codex/app-server

## Requirements

- Windows 10 or Windows 11.
- Node.js 22 or 24 LTS.
- Codex CLI installed and signed in with an authentication mode that exposes ChatGPT rate-limit data.

Node.js 18 and 20 are intentionally not supported by this public release because those release lines are End-of-Life as of August 2026.

No `npm install` is required for this watcher itself; it has no third-party npm runtime dependencies.

## Quick start

1. Download or clone this repository to a stable folder.
2. Run `install.bat`.
3. The installer checks Node.js, locates Codex CLI, runs the built-in test suite, and tests Windows notifications.
4. If Codex CLI is missing, the installer can offer the official npm package command after confirmation:

   ```cmd
   npm install -g @openai/codex
   ```

5. If needed, run `codex` once and sign in with ChatGPT.
6. Optionally let the installer register startup-on-login.
7. Run `start.bat` to begin monitoring.

Useful commands:

| Command | Purpose |
| --- | --- |
| `start.bat` | Start the watcher in the current console. |
| `stop.bat` | Stop the watcher only after verifying the PID and process start-time fingerprint. |
| `status.bat` | Show the last saved usage snapshot. |
| `check-now.bat` | Query Codex app-server immediately. |
| `test-notification.bat` | Test Windows notification and optional email. |
| `run-tests.bat` | Run the automated test suite. |
| `uninstall-startup.ps1` | Remove the startup shortcut. |

## Configuration

The tracked template is `config.example.json`.

On first use, the watcher creates a local `config.json` from that template. `config.json` is intentionally ignored by Git because it may contain personal email addresses or local paths.

Default detection configuration:

```json
{
  "resetDropMinPoints": 3,
  "normalResetGraceSeconds": 600,
  "resetTimeChangeMinSeconds": 60,
  "remainingWarningThresholds": [20, 10, 5, 0]
}
```

### Event types

- `NORMAL_RESET` — usage recovered around the previously observed reset time.
- `EARLY_RESET` — usage recovered away from the previously observed reset time.
- `RESET_TIME_CHANGED` — the next reset timestamp changed without a detected usage reset.
- `LOW_REMAINING` — remaining usage crossed a configured threshold.
- `LIMIT_REACHED` — remaining usage reached 0%.
- `SERVER_LIMIT_REACHED` — Codex app-server reported a limit-reached classification.
- `RESET_CREDIT_ADDED` — available Reset Credit count increased.
- `RESET_CREDIT_DECREASED` — available Reset Credit count decreased.

`EARLY_RESET` is a **local classification**, not a statement from OpenAI. The watcher infers it from the observed usage drop and the previous `resetsAt` value.

## Optional email notifications

Email is disabled by default. Edit your local `config.json`:

```json
"email": {
  "enabled": true,
  "smtpHost": "smtp.gmail.com",
  "smtpPort": 587,
  "enableSsl": true,
  "username": "your-address@gmail.com",
  "passwordEnv": "CODEX_WATCHER_SMTP_PASSWORD",
  "from": "your-address@gmail.com",
  "to": ["destination@example.com"]
}
```

Store the SMTP password in an environment variable rather than in the JSON file:

```cmd
setx CODEX_WATCHER_SMTP_PASSWORD "YOUR_APP_PASSWORD"
```

SMTP provider requirements can change; consult your provider's current documentation for authentication requirements.

## Local data and privacy

The watcher stores data only under its project directory by default:

- `data/state.json` — latest normalized snapshot.
- `data/history.jsonl` — snapshot and detected-event history.
- `data/watcher.lock` — local PID + process start-time fingerprint.
- `logs/watcher.log` — watcher diagnostics.
- `logs/app-server.log` — Codex app-server stderr.

These files are ignored by Git.

The watcher calls `account/read` but only logs the account type, plan type, whether an email field exists, and whether OpenAI authentication is required. It does not log the returned email address itself.

Local logs can still contain usernames, filesystem paths, plan information, or upstream diagnostic text. **Review and redact logs before posting them publicly.** See [SECURITY.md](SECURITY.md).

## How Codex CLI discovery works

With the default `"command": "auto"`, the watcher tries, in broad order:

1. `CODEX_WATCHER_CODEX` environment variable.
2. An explicit command/path configured in `config.json`.
3. `codex` found on `PATH`.
4. Known Windows Codex standalone/package locations.
5. Global npm shim locations.
6. A final conventional `codex` shell lookup.

To force a particular executable, set `codex.command` in `config.json` or set `CODEX_WATCHER_CODEX`.

## Reliability model

The watcher uses both event-driven and polling paths:

1. Start `codex app-server` as a local child process.
2. Perform the required `initialize` / `initialized` handshake.
3. Read a complete rate-limit snapshot with `account/rateLimits/read`.
4. Treat `account/rateLimits/updated` as a prompt to refresh the full snapshot.
5. Poll periodically as a fallback.
6. If the app-server exits, reconnect with exponential backoff.
7. Notify once when monitoring becomes unavailable and optionally when it recovers.

The normalized representation does not assume there is only one `codex` bucket; it monitors all buckets returned through `rateLimitsByLimitId`.

## Development and tests

Run:

```powershell
npm test
```

The suite includes rate-limit normalization/detection tests and a mock app-server integration test. A live Codex account is not required for automated tests.

GitHub Actions runs syntax checks and tests on Windows with supported Node.js LTS versions.

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security notes

- Do not commit `config.json`, runtime state, history, logs, `.env` files, or credentials.
- Do not put SMTP passwords in `config.json`.
- Do not disable Microsoft Defender or add antivirus exclusions just to run this project.
- Windows notification/email helpers invoke bundled PowerShell scripts. See [SECURITY.md](SECURITY.md) for the exact security model.

## License

MIT License. See [LICENSE](LICENSE).
