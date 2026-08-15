$ErrorActionPreference = "Stop"
$startup = [Environment]::GetFolderPath("Startup")
$linkPath = Join-Path $startup "Codex Usage Watcher.lnk"
if (Test-Path -LiteralPath $linkPath) {
  Remove-Item -LiteralPath $linkPath -Force
  Write-Host "Removed: $linkPath"
} else {
  Write-Host "Startup shortcut was not installed."
}
