@echo off
title Alex's Craft Calc
cd /d "C:\Users\Administrator\Projects\alien-craft-calc"
echo Starting Alex's Craft Calc...
powershell -NoProfile -Command "try { (Invoke-WebRequest -UseBasicParsing http://127.0.0.1:4173/ -TimeoutSec 2).StatusCode } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
  if not exist "dist\index.html" call npm run build
  start "AlexCraftServer" /MIN cmd /c "npx vite preview --host 127.0.0.1 --port 4173"
  timeout /t 3 /nobreak >nul
)
start "" "http://127.0.0.1:4173/"
