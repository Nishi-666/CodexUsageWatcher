param(
  [Parameter(Mandatory=$true)][string]$Title,
  [Parameter(Mandatory=$true)][string]$Body,
  [string]$Severity = "INFO",
  [int]$DisplaySeconds = 8,
  [string]$Sound = "True"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$notify = New-Object System.Windows.Forms.NotifyIcon
$notify.Icon = [System.Drawing.SystemIcons]::Information
$notify.Visible = $true
$notify.BalloonTipTitle = $Title
$notify.BalloonTipText = $Body

switch ($Severity.ToUpperInvariant()) {
  "ERROR"     { $notify.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::Error;   $notify.Icon = [System.Drawing.SystemIcons]::Error }
  "WARNING"   { $notify.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::Warning; $notify.Icon = [System.Drawing.SystemIcons]::Warning }
  "IMPORTANT" { $notify.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::Warning; $notify.Icon = [System.Drawing.SystemIcons]::Warning }
  default      { $notify.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::Info }
}

if ($Sound -eq "True") {
  if ($Severity -eq "ERROR" -or $Severity -eq "WARNING" -or $Severity -eq "IMPORTANT") {
    [System.Media.SystemSounds]::Exclamation.Play()
  } else {
    [System.Media.SystemSounds]::Asterisk.Play()
  }
}

$notify.ShowBalloonTip([Math]::Max(1000, $DisplaySeconds * 1000))
Start-Sleep -Seconds ([Math]::Max(2, $DisplaySeconds))
$notify.Visible = $false
$notify.Dispose()
