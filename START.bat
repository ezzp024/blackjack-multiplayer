@echo off
setlocal enabledelayedexpansion
title Obsidian Casino — Starting...
color 0A

echo.
echo  ============================================
echo    OBSIDIAN CASINO — STARTUP
echo  ============================================
echo.

:: Kill old processes
taskkill /F /IM cloudflared.exe 2>nul
timeout /t 1 /nobreak >nul

:: Create logs dir
if not exist logs mkdir logs

:: Clear old logs
echo. > logs\server.log
echo. > logs\tunnel-err.log

:: Check if PM2 is available
where pm2 >nul 2>&1
if errorlevel 1 (
    echo [WARN] PM2 not found in PATH, falling back to node...
    goto :start_node
)

:: Stop any existing PM2 process
pm2 stop obsidian-casino 2>nul
pm2 delete obsidian-casino 2>nul
timeout /t 1 /nobreak >nul

:: Start with PM2
echo [1/3] Starting server with PM2...
pm2 start ecosystem.config.js
timeout /t 4 /nobreak >nul

:: Check PM2 logs for startup confirmation
pm2 logs obsidian-casino --lines 20 --nostream > logs\server.log 2>&1
findstr /C:"running on port" logs\server.log >nul
if errorlevel 1 (
    echo [INFO] Waiting for server...
    timeout /t 3 /nobreak >nul
)
echo [OK] Server running on port 3000 (PM2 managed — auto-restarts on crash)
goto :start_tunnel

:start_node
echo [1/3] Starting server with node...
start /min cmd /c "node server.js >> logs\server.log 2>&1"
timeout /t 5 /nobreak >nul
findstr /C:"running on port" logs\server.log >nul
if errorlevel 1 (
    echo [ERROR] Server failed to start. Check logs\server.log
    type logs\server.log
    pause
    exit /b 1
)
echo [OK] Server started on port 3000

:start_tunnel
echo [2/3] Starting Cloudflare tunnel...
start /min cmd /c "cloudflared tunnel --url http://localhost:3000 > logs\tunnel.log 2> logs\tunnel-err.log"

:: Wait for tunnel URL (up to 30s)
echo [3/3] Waiting for tunnel URL...
set "URL="
for /l %%i in (1,1,30) do (
    if not defined URL (
        timeout /t 1 /nobreak >nul
        for /f "tokens=*" %%L in ('findstr "https://.*trycloudflare" logs\tunnel-err.log 2^>nul') do (
            set "URL=%%L"
        )
    )
)

:: Show crypto wallet info from server log
set "WALLET="
for /f "tokens=*" %%L in ('findstr "Hot wallet" logs\server.log 2^>nul') do set "WALLET=%%L"

echo.
echo  ============================================
if defined URL (
    echo    LIVE URL  : !URL!
) else (
    echo    LIVE URL  : Check logs\tunnel-err.log
)
echo    LOCAL     : http://localhost:3000
echo    ADMIN     : http://localhost:3000/admin
if defined WALLET (
    echo    !WALLET!
)
echo  ============================================
echo.
echo  Login: owner / owner
echo.
echo  Casino is LIVE. Close this window to STOP.
echo.

:: Keep window open (PM2 runs in background)
pause >nul

:: Cleanup on exit
pm2 stop obsidian-casino 2>nul
taskkill /F /IM cloudflared.exe 2>nul
echo Stopped.
endlocal
