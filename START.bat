@echo off
title Alex's Craft Calc
cd /d "C:\Users\Administrator\Projects\alien-craft-calc"
echo.
echo   ========================================
echo     Alex's Craft Calc  -  Alien Purple
echo     Soap + Candle calculator
echo   ========================================
echo.

powershell -NoProfile -Command "try { (Invoke-WebRequest -UseBasicParsing http://127.0.0.1:4173/ -TimeoutSec 2).StatusCode | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if %ERRORLEVEL%==0 goto OPEN

if not exist "dist\index.html" (
  echo Building production bundle...
  call npm run build
  if errorlevel 1 (
    echo Build failed. Run: npm install
    pause
    exit /b 1
  )
)

echo Starting local server on http://127.0.0.1:4173 ...
start "AlexCraftServer" /MIN cmd /c "npx vite preview --host 127.0.0.1 --port 4173"
timeout /t 3 /nobreak >nul

:OPEN
echo Opening app...
start "" "http://127.0.0.1:4173/"
echo.
echo Tip: Press F1 in the app for the Craft Wiki.
echo      Install app / Add to Home Screen for desktop + mobile.
echo.
exit /b 0