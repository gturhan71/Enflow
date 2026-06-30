@echo off
rem Enflow - Windows baslatma/yeniden-baslatma sarmalayicisi
rem Frontend (3000) + Backend (3002) surecini run.cjs ile yonetir.
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo [HATA] Node.js bulunamadi. Once kurulumu calistirin: install\install.bat
  pause
  exit /b 1
)

if not exist "%~dp0run.cjs" (
  echo [HATA] run.cjs bulunamadi ^(%~dp0^). Depo eksik klonlanmis olabilir.
  pause
  exit /b 1
)

node run.cjs
pause
