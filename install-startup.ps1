$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$vbs = Join-Path $root "start-hidden.vbs"
$startup = [Environment]::GetFolderPath("Startup")
$linkPath = Join-Path $startup "Codex Usage Watcher.lnk"

$ws = New-Object -ComObject WScript.Shell
$shortcut = $ws.CreateShortcut($linkPath)
$shortcut.TargetPath = "$env:WINDIR\System32\wscript.exe"
$shortcut.Arguments = '"' + $vbs + '"'
$shortcut.WorkingDirectory = $root
$shortcut.Description = "Codex Usage Watcher"
$shortcut.Save()

Write-Host "Startup shortcut installed: $linkPath"
