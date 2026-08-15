# Security Policy

Codex Usage Watcher is an unofficial local utility. It launches the installed Codex CLI's documented `app-server` process and reads account/rate-limit information through the local stdio protocol.

## Supported versions

Security fixes are currently provided for the latest public release only.

## Reporting a vulnerability

Prefer a private GitHub Security Advisory if the repository has private vulnerability reporting enabled. If that is unavailable, open a minimal issue asking for a private contact path **without posting exploit details or secrets**.

Do not include API keys, authentication tokens, cookies, SMTP passwords, full unredacted logs, or private email addresses in a public issue.

## Sensitive local files

The following are intentionally excluded from Git:

- `config.json` — user configuration; may contain email addresses or local paths.
- `data/state.json` and `data/history.jsonl` — local usage snapshots/history.
- `data/watcher.lock` — runtime process lock.
- `logs/watcher.log` and `logs/app-server.log` — local diagnostics that may include usernames, filesystem paths, plan information, or upstream diagnostic text.
- `.env*` — environment files are not used by default, but are ignored to reduce accidental secret commits.

Review and redact local diagnostic data before sharing it anywhere.

## Authentication model

The watcher does **not** scrape the ChatGPT website and does not request ChatGPT cookies. It relies on the authentication already managed by the locally installed Codex CLI.

`account/read` is used only to log account type, plan type, whether an email field is present, and whether OpenAI authentication is required. The email address itself is not written by the watcher.

Optional SMTP notification credentials are read from the environment variable named by `notifications.email.passwordEnv`; the password should not be stored in `config.json`.

## PowerShell use

Windows notifications and optional SMTP mail are implemented by bundled PowerShell scripts. The Node process invokes only the scripts located inside this project directory and passes notification text as process arguments. The notification subprocess currently uses a process-scoped PowerShell execution-policy override so downloaded local scripts can run; it does not change the machine-wide PowerShell policy.

Never disable Microsoft Defender, restore quarantined files, or add antivirus exclusions merely to run this project. Investigate the exact detection and affected path first.
