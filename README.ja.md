# Codex Usage Watcher 1.1.1

Windows上でCodexのChatGPT利用制限を監視し、利用量のリセット、リセット時刻変更、残量低下、上限到達、復旧などを通知する**非公式のローカル常駐ツール**です。

[English README](README.md)

## 概要

Codex CLIの `codex app-server` をローカル子プロセスとして起動し、stdioのJSONL/JSON-RPCで公開されているapp-serverメソッドを利用します。

主に利用するもの:

- `initialize` / `initialized`
- `account/read`
- `account/rateLimits/read`
- `account/rateLimits/updated`

公式ドキュメント:

https://developers.openai.com/codex/app-server

ブラウザ画面のスクレイピングやChatGPT Cookieの取得は行いません。Codex CLIが既に管理している認証を利用します。

このプロジェクトはOpenAI公式製品ではなく、OpenAIによる承認・保証を受けたものでもありません。

## 主な機能

- Codexの利用率・残量・次回リセット時刻の監視。
- `rateLimitsByLimitId` が返された場合の複数利用枠監視。
- `account/rateLimits/updated` を契機とした即時再取得。
- 定期ポーリングによる通知取りこぼし対策。
- 通常リセット／予定外リセットのローカル判定。
- 残量20% / 10% / 5% / 0%などの閾値通知。
- Codex側の上限到達状態の検出。
- Reset Credit残数変化の検出。
- Windows通知・アラーム音。
- 任意のSMTPメール通知。
- app-server切断時の指数バックオフ再接続と復旧通知。
- 外部npmランタイム依存なし。

## 必要条件

- Windows 10 / 11
- Node.js 22または24 LTS
- Codex CLI
- ChatGPTのrate-limit情報を取得できる認証方式でCodex CLIへサインイン済みであること

2026年8月時点でNode.js 18と20はEOLのため、公開版ではNode.js 22以上を必要条件とします。

Watcher本体には外部npmパッケージがないため、`npm install` は不要です。

## 最短の使い方

1. ZIPを任意の場所に展開するか、GitHubからcloneします。移動する可能性の低い場所を推奨します。
2. `install.bat` をダブルクリックします。
3. Node.jsとCodex CLIを確認します。
4. Codex CLIが見つからない場合、確認後に公式npmパッケージのインストールを実行できます。

   ```cmd
   npm install -g @openai/codex
   ```

5. 内蔵テストとWindows通知テストが実行されます。
6. 希望すれば、その場でCodex app-serverへのライブ疎通確認を行います。
7. Windowsログオン時に自動起動するか選択できます。
8. `start.bat` で監視開始です。

Codex CLIの初回認証がまだの場合は、`codex` を一度起動して利用可能なサインイン方法を選択してください。

## コマンド

| ファイル | 内容 |
| --- | --- |
| `start.bat` | 監視開始 |
| `stop.bat` | 監視停止 |
| `status.bat` | 最後に保存した利用状況を表示 |
| `check-now.bat` | app-serverへ直接接続して現在値を取得 |
| `test-notification.bat` | Windows通知と任意のメール通知をテスト |
| `run-tests.bat` | 自動テストを実行 |
| `uninstall-startup.ps1` | 自動起動ショートカットを削除 |

## 設定ファイル

GitHubで追跡するのは `config.example.json` です。

初回利用時に同内容から**個人用の `config.json` を自動生成**します。`config.json` はメールアドレスやローカルパスを書き込む可能性があるため `.gitignore` で除外されています。

デフォルト判定値:

```json
"detection": {
  "resetDropMinPoints": 3,
  "normalResetGraceSeconds": 600,
  "resetTimeChangeMinSeconds": 60,
  "remainingWarningThresholds": [20, 10, 5, 0]
}
```

### 検出イベント

- `NORMAL_RESET` — 以前の `resetsAt` 付近で使用量が回復。
- `EARLY_RESET` — 予定時刻から離れた時点で使用量が回復。
- `RESET_TIME_CHANGED` — 利用量リセットを伴わず `resetsAt` が有意に変化。
- `LOW_REMAINING` — 残量が指定閾値を下回った。
- `LIMIT_REACHED` — 残量0%到達。
- `SERVER_LIMIT_REACHED` — Codex側が上限到達状態を返した。
- `RESET_CREDIT_ADDED` — Reset Credit残数増加。
- `RESET_CREDIT_DECREASED` — Reset Credit残数減少。

### 予定外リセット判定

`usedPercent` が前回より `resetDropMinPoints` 以上下がった場合を利用量回復とみなします。また、小さな低下でも次回リセット時刻が十分先へ移動した場合は新しい利用窓として扱います。

取得時刻が以前観測した `resetsAt` の許容範囲内なら通常リセット、それ以外なら `EARLY_RESET` と分類します。

これは**OpenAIが「予定外リセット」と通知しているわけではなく、このWatcherによる観測上の分類**です。

## データ保存

デフォルトではプロジェクトフォルダ内だけに保存します。

- `data/state.json` — 最新スナップショット
- `data/history.jsonl` — スナップショットとイベント履歴
- `data/watcher.lock` — 起動中PID＋プロセス開始時刻の照合情報
- `logs/watcher.log` — Watcher動作ログ
- `logs/app-server.log` — Codex app-server stderr

これらはGit管理対象外です。

履歴は自動削除しません。長期間運用する場合は必要に応じてローテーションしてください。

### プライバシー上の注意

`account/read` の結果からWatcherがログへ保存するのは次の情報だけです。

- account type
- plan type
- emailフィールドが存在するかどうかの真偽値
- OpenAI認証が必要かどうか

**メールアドレス本体はWatcherログへ保存しません。**

ただしローカルログにはWindowsユーザー名を含むファイルパス、Codexのプラン情報、app-server側の診断メッセージなどが含まれる可能性があります。Issueへ貼る前に必ず内容を確認して匿名化してください。

詳細は `SECURITY.md` を参照してください。

## メール通知を有効にする

デフォルトでは無効です。生成された `config.json` を編集します。

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

SMTPパスワードは `config.json` に書かず、Windowsユーザー環境変数へ保存します。

```cmd
setx CODEX_WATCHER_SMTP_PASSWORD "YOUR_APP_PASSWORD"
```

`setx` 後は新しいプロセスから値を利用できます。Gmailなど各メールサービスのSMTP認証条件は変更される可能性があるため、利用時点の公式情報を確認してください。

## 自動起動

`install-startup.ps1` は現在のWindowsユーザーのStartupフォルダにショートカットを作成します。通常は管理者権限不要です。

ショートカットは `wscript.exe` → `start-hidden.vbs` → `start.bat` の順で起動し、ログオン時のコンソール表示を抑えます。

解除:

```powershell
powershell -ExecutionPolicy RemoteSigned -File .\uninstall-startup.ps1
```

## Codex CLIの自動検出

デフォルトは次です。

```json
"codex": {
  "command": "auto",
  "args": ["app-server"]
}
```

Windowsでは概ね次の順で探索します。

1. `CODEX_WATCHER_CODEX` 環境変数
2. `config.json` で明示したコマンド／フルパス
3. 現在の `PATH`
4. 既知のCodex Windows配置候補
5. `%APPDATA%\npm` 配下のグローバルnpm shim
6. 最後に通常の `codex` コマンド名

明示的に固定したい場合は `config.json` の `codex.command` か `CODEX_WATCHER_CODEX` を使用してください。

## 監視方式

1. `codex app-server` を子プロセスとして起動。
2. `initialize` → `initialized` のハンドシェイク。
3. `account/read` で認証状態の最小情報を確認。
4. `account/rateLimits/read` で完全な利用枠状態を取得。
5. `account/rateLimits/updated` を受けたら完全状態を再取得。
6. 60秒ごとのポーリングも併用。
7. app-server終了時は指数バックオフで再接続。

利用枠名を `codex` 1つに固定せず、`rateLimitsByLimitId` がある場合は返された全bucketのprimary/secondaryを監視します。

## テスト

```powershell
npm test
```

自動テストでは実アカウントを使用せず、mock app-serverを使ってJSONL連携まで確認します。

GitHub ActionsではWindows上のNode.js 22/24 LTSで構文確認とテストを実行する設定を同梱しています。

## セキュリティ

- `config.json`、`data/` の実データ、`logs/`、`.env*` はcommitしないでください。
- APIキー、ChatGPTトークン、Cookie、SMTPパスワードをIssueへ貼らないでください。
- Defenderの除外設定や無効化を、このWatcherを動かす目的だけで行わないでください。
- 通知・メール機能は同梱PowerShellスクリプトを使用します。詳細は `SECURITY.md` に明記しています。

## 開発への参加

`CONTRIBUTING.md` を参照してください。

## ライセンス

MIT License。`LICENSE` を参照してください。
