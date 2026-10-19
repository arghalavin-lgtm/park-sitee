@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed or is not in PATH.
  echo Install Node.js, then run this file again.
  pause
  exit /b 1
)

rem SQLite: Node 22.5+ has it built in. On older Node, install better-sqlite3 once.
node -e "require('node:sqlite')" >nul 2>nul
if errorlevel 1 (
  if not exist node_modules\better-sqlite3 (
    echo Installing SQLite driver, please wait...
    call npm install --no-audit --no-fund
    if errorlevel 1 (
      echo npm install failed. Check your internet connection or install Node.js 22.5 or newer.
      pause
      exit /b 1
    )
  )
)

start "Park Server" cmd /k "node server.js"
timeout /t 2 /nobreak >nul
start "Park Admin" "http://localhost:8000/admin/"
