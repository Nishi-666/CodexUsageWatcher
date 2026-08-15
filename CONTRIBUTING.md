# Contributing

Contributions are welcome, especially reproducible bug reports, compatibility fixes for Codex app-server changes, tests, and small improvements to Windows reliability.

## Development setup

Requirements:

- Windows 10 or 11 for full end-to-end behavior.
- Node.js 22 or 24 LTS.
- Codex CLI only for live checks; the automated test suite uses a mock app-server and does not require a Codex account.

Run:

```powershell
npm test
```

No third-party npm dependencies are required.

## Pull requests

Keep changes focused. Add or update tests for behavior changes. Do not commit `config.json`, runtime data, logs, credentials, personal paths, or other user-local information.

Before opening a pull request:

```powershell
Get-ChildItem src,tests -Filter *.js -Recurse | ForEach-Object { node --check $_.FullName }
npm test
```

## Codex app-server compatibility

Prefer the documented stable app-server surface. When behavior depends on an upstream Codex change, link the relevant OpenAI documentation or changelog in the pull request.

## Security issues

Do not report exploitable security issues with full details in a public issue. Follow `SECURITY.md`.
