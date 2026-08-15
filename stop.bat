@echo off
setlocal EnableExtensions
cd /d "%~dp0"
where node >nul 2>nul || (
  echo [ERROR] Node.js was not found in PATH.
  pause
  exit /b 1
)
node src\stop.js
set EXITCODE=%ERRORLEVEL%
pause
exit /b %EXITCODE%
