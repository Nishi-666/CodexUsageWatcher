@echo off
setlocal EnableExtensions
cd /d "%~dp0"
where node >nul 2>nul || (
  echo [ERROR] Node.js was not found in PATH.
  echo Install Node.js 22 or later, then retry.
  pause
  exit /b 1
)
node src\find-codex.js >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Codex CLI was not found.
  echo Run install.bat. It can install/detect the official CLI automatically.
  pause
  exit /b 1
)
node src\main.js
endlocal
