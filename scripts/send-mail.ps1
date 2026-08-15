param(
  [Parameter(Mandatory=$true)][string]$ConfigPath,
  [Parameter(Mandatory=$true)][string]$Subject,
  [Parameter(Mandatory=$true)][string]$Body
)

$ErrorActionPreference = "Stop"
$config = Get-Content -Raw -LiteralPath $ConfigPath | ConvertFrom-Json
$mail = $config.notifications.email
if (-not $mail.enabled) { exit 0 }

if ([string]::IsNullOrWhiteSpace($mail.smtpHost)) { throw "smtpHost is empty" }
if ([string]::IsNullOrWhiteSpace($mail.username)) { throw "username is empty" }
if ([string]::IsNullOrWhiteSpace($mail.from)) { throw "from is empty" }
if ($null -eq $mail.to -or $mail.to.Count -eq 0) { throw "to is empty" }

$password = [Environment]::GetEnvironmentVariable([string]$mail.passwordEnv, "Process")
if ([string]::IsNullOrEmpty($password)) {
  $password = [Environment]::GetEnvironmentVariable([string]$mail.passwordEnv, "User")
}
if ([string]::IsNullOrEmpty($password)) {
  throw "SMTP password environment variable is not set: $($mail.passwordEnv)"
}

$message = New-Object System.Net.Mail.MailMessage
$message.From = New-Object System.Net.Mail.MailAddress([string]$mail.from)
foreach ($recipient in $mail.to) {
  if (-not [string]::IsNullOrWhiteSpace([string]$recipient)) { [void]$message.To.Add([string]$recipient) }
}
$message.Subject = $Subject
$message.Body = $Body
$message.SubjectEncoding = [Text.Encoding]::UTF8
$message.BodyEncoding = [Text.Encoding]::UTF8

$client = New-Object System.Net.Mail.SmtpClient([string]$mail.smtpHost, [int]$mail.smtpPort)
$client.EnableSsl = [bool]$mail.enableSsl
$client.UseDefaultCredentials = $false
$client.Credentials = New-Object System.Net.NetworkCredential([string]$mail.username, $password)
$client.Timeout = 20000

try {
  $client.Send($message)
} finally {
  $message.Dispose()
  $client.Dispose()
}
