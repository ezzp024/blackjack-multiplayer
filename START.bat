@echo off
setlocal enabledelayedexpansion
title Obsidian Casino
color 0A

echo.
echo  ============================================
echo    OBSIDIAN CASINO
echo  ============================================
echo.

:: Kill anything on port 3000
for /f "tokens=5" %%p in ('netstat -ano 2^>nul ^| findstr ":3000 "') do (
    taskkill /F /PID %%p >nul 2>&1
)
taskkill /F /IM cloudflared.exe >nul 2>&1
timeout /t 1 /nobreak >nul

:: Make sure logs dir exists
if not exist logs mkdir logs

:: Clear old logs
type nul > logs\server.log
type nul > logs\tunnel.log

:: ── Start Node server ──────────────────────────────────────────
echo [1/3] Starting server...
start "Obsidian-Server" /min cmd /c "node server.js > logs\server.log 2>&1"

:: Wait up to 15s for server to be ready
set "READY=0"
for /l %%i in (1,1,15) do (
    if "!READY!"=="0" (
        timeout /t 1 /nobreak >nul
        findstr /C:"running on port" logs\server.log >nul 2>&1
        if not errorlevel 1 set "READY=1"
    )
)

if "!READY!"=="0" (
    echo [ERROR] Server did not start. Check logs\server.log:
    echo.
    type logs\server.log
    echo.
    pause
    exit /b 1
)
echo [OK] Server running on port 3000

:: ── Start Cloudflare tunnel ────────────────────────────────────
echo [2/3] Starting Cloudflare tunnel...
where cloudflared >nul 2>&1
if errorlevel 1 (
    echo [WARN] cloudflared not found — tunnel skipped. Site only at localhost:3000
    goto :show_info
)

start "Obsidian-Tunnel" /min cmd /c "cloudflared tunnel --url http://localhost:3000 > logs\tunnel.log 2>&1"

:: Wait up to 30s for tunnel URL
echo [3/3] Waiting for tunnel URL...
set "TUNNEL_URL="
for /l %%i in (1,1,30) do (
    if not defined TUNNEL_URL (
        timeout /t 1 /nobreak >nul
        for /f "tokens=*" %%L in ('findstr "trycloudflare.com" logs\tunnel.log 2^>nul') do (
            set "LINE=%%L"
            for /f "tokens=*" %%U in ('echo !LINE! ^| findstr /o "https://[^ ]*trycloudflare[^ ]*"') do (
                set "TUNNEL_URL=%%U"
            )
        )
        if not defined TUNNEL_URL (
            findstr "https://" logs\tunnel.log >nul 2>&1
            if not errorlevel 1 (
                for /f "tokens=*" %%L in ('findstr "https://" logs\tunnel.log 2^>nul') do (
                    set "TUNNEL_URL=%%L"
                )
            )
        )
    )
)

:show_info
echo.
echo  ============================================
echo    LOCAL   : http://localhost:3000
echo    ADMIN   : http://localhost:3000/admin
if defined TUNNEL_URL (
    echo    PUBLIC  : !TUNNEL_URL!
) else (
    echo    PUBLIC  : Check logs\tunnel.log for URL
)
echo  ============================================
echo.
echo  Login: owner / owner
echo.
echo  Press any key to STOP the casino.
echo.
pause >nul

:: ── Cleanup ────────────────────────────────────────────────────
taskkill /F /IM cloudflared.exe >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq Obsidian-Server" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq Obsidian-Tunnel" >nul 2>&1
echo Stopped.
endlocal
