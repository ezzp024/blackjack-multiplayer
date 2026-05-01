@echo off
echo Starting Obsidian Casino...

:: Kill old processes
taskkill /F /IM node.exe 2>nul
taskkill /F /IM cloudflared.exe 2>nul
timeout /t 1 /nobreak >nul

:: Start server
start /min cmd /c "node server.js > server.log 2>&1"
timeout /t 2 /nobreak >nul

:: Start tunnel
start /min cmd /c "cloudflared tunnel --url http://localhost:3000 > tunnel.log 2>tunnel-err.log"
timeout /t 8 /nobreak >nul

:: Extract and show URL
for /f "tokens=*" %%i in ('findstr "trycloudflare.com" tunnel-err.log') do (
    echo %%i | findstr /C:"https://" >nul && echo LIVE URL: %%i
)

echo.
echo Casino is running. Close this window to shut it down.
pause
