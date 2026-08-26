@echo off
setlocal EnableExtensions
cd /d "%~dp0"
echo === Codex Usage Watcher setup v1.1.2 ===
where node >nul 2>nul || (
  echo [ERROR] Node.js is not available in PATH.
  echo Node.js 22 or later is required.
  pause
  exit /b 1
)
for /f "tokens=*" %%V in ('node -p "process.versions.node"') do set NODEVER=%%V
echo Node.js: %NODEVER%

where npm >nul 2>nul || (
  echo [ERROR] npm is not available in PATH.
  echo Your Node.js installation appears incomplete.
  pause
  exit /b 1
)
for /f "tokens=*" %%V in ('npm --version') do set NPMVER=%%V
echo npm: %NPMVER%

echo.
echo Detecting Codex CLI...
node src\find-codex.js
if errorlevel 1 goto install_codex
goto codex_ok

:install_codex
echo.
echo Codex CLI was not found.
echo This watcher requires the official Codex CLI because it uses "codex app-server".
echo.
echo For safety, this installer does NOT download and execute PowerShell scripts.
echo It can use the official npm package instead:
echo   npm install -g @openai/codex
echo.
choice /M "Install the official @openai/codex npm package now"
if errorlevel 2 goto codex_declined

echo.
echo Installing Codex CLI from the official npm package...
call npm install -g @openai/codex
if errorlevel 1 (
  echo [ERROR] npm installation failed.
  echo No antivirus exclusion or bypass should be added for this watcher.
  echo Review the npm/Windows Security error, then retry manually if appropriate:
  echo   npm install -g @openai/codex
  pause
  exit /b 1
)

echo.
echo Verifying Codex CLI without relying only on the current PATH...
node src\find-codex.js
if errorlevel 1 (
  echo [ERROR] Codex CLI was installed but the watcher could not locate it.
  echo Close this window, open a new Command Prompt, and rerun install.bat.
  pause
  exit /b 1
)
goto codex_ok

:codex_declined
echo.
echo Setup stopped. Install Codex CLI first, then run install.bat again.
echo Official npm command:
echo   npm install -g @openai/codex
pause
exit /b 1

:codex_ok
echo.
echo Running built-in tests...
node tests\all-tests.js || (
  echo [ERROR] Tests failed. Startup registration was not performed.
  pause
  exit /b 1
)

echo.
echo Running Windows notification test...
node src\test-notification.js

echo.
echo NOTE: If Codex CLI was just installed, the first live check may ask you to sign in.
echo You can also run "codex" once in a new terminal and choose Sign in with ChatGPT.
echo.
choice /M "Run a live Codex usage check now"
if errorlevel 2 goto skip_live_check
call check-now.bat
if errorlevel 1 (
  echo.
  echo [WARNING] Live check failed. If Codex has not been signed in yet, run "codex" once and sign in with ChatGPT, then retry check-now.bat.
)
:skip_live_check

echo.
choice /M "Start automatically when you sign in to Windows"
if errorlevel 2 goto nostartup
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File "%~dp0install-startup.ps1"
:nostartup

echo.
echo Setup complete.
echo Run start.bat to start monitoring now.
pause
endlocal
