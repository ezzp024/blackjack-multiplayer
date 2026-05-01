@echo off
setlocal enabledelayedexpansion
echo Starting Obsidian Casino...
echo.

:: Kill old processes
taskkill /F /IM node.exe 2>nul
taskkill /F /IM cloudflared.exe 2>nul
timeout /t 2 /nobreak >nul

:: Clear old logs
echo. > server.log
echo. > tunnel.log
echo. > tunnel-err.log

:: Start server
start /min cmd /c "node server.js >> server.log 2>&1"
timeout /t 4 /nobreak >nul

:: Verify server started
findstr /C:"running on port" server.log >nul
if errorlevel 1 (
    echo [ERROR] Server failed to start. Check server.log for details.
    type server.log
    pause
    exit /b 1
)
echo [OK] Server started on port 3000

:: Start cloudflare tunnel
start /min cmd /c "cloudflared tunnel --url http://localhost:3000 > tunnel.log 2> tunnel-err.log"

:: Wait up to 30 seconds for tunnel URL
echo Waiting for tunnel URL...
set "URL="
for /l %%i in (1,1,30) do (
    if not defined URL (
        timeout /t 1 /nobreak >nul
        for /f "tokens=*" %%L in ('findstr "https://.*trycloudflare" tunnel-err.log 2^>nul') do (
            set "URL=%%L"
        )
    )
)

echo.
if defined URL (
    echo ============================================
    echo   LIVE URL: !URL!
    echo ============================================
) else (
    echo [WARN] Could not detect tunnel URL. Check tunnel-err.log manually.
)

echo.
echo Casino is running. Press any key to STOP everything.
pause >nul

:: Cleanup
taskkill /F /IM node.exe 2>nul
taskkill /F /IM cloudflared.exe 2>nul
echo Stopped.
endlocal
