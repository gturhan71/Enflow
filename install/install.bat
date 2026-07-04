@echo off
setlocal enabledelayedexpansion
rem ============================================================================
rem  Enflow - Windows kurulum girisi (cift-tik). Erisim/yetki kontrol eder,
rem  PowerShell calistirma politikasini kendi icinde Bypass ile asar ve
rem  install.ps1'i cagirir (o da Node/git'i winget veya portatif ile saglar).
rem ============================================================================
cd /d "%~dp0"
echo.
echo  ==== Enflow Kurulum (Windows) ====
echo.
echo  Not: Kurulum sihirbazinda "PostgreSQL kullanilsin mi?" secilirse ve sistemde
echo       PostgreSQL yoksa winget ile otomatik kurulur; "enflow" veritabani + DB
echo       kullanicisi (dbadmin) sifresiyle olusturulur (mevcutsa mevcut superuser
echo       bilgileri kullanilir). Varsayilan secim SQLite'tir (harici DB gerekmez).
echo.

rem --- Yonetici hakki (bilgi; portatif mod admin gerektirmez) ---
net session >nul 2>&1
if "%errorlevel%"=="0" (
  echo  [Erisim] Yonetici hakki : VAR  ^(sistem geneli kurulum mumkun^)
) else (
  echo  [Erisim] Yonetici hakki : YOK
  echo           Sistem geneli Node/git kurulumu icin bu dosyaya sag tik -^> "Yonetici olarak calistir".
  echo           Yetki yoksa kurulum yine de PORTATIF modda devam eder ^(admin gerekmez^).
)

rem --- PowerShell var mi ---
where powershell >nul 2>&1
if errorlevel 1 (
  echo  [HATA] PowerShell bulunamadi. Windows 10 veya uzeri gereklidir.
  pause
  exit /b 1
)
echo  [Erisim] PowerShell      : VAR

rem --- install.ps1 mevcut mu ---
if not exist "%~dp0install.ps1" (
  echo  [HATA] install.ps1 bulunamadi ^(%~dp0^).
  pause
  exit /b 1
)

echo.
echo  Kurulum baslatiliyor ^(ExecutionPolicy Bypass^)...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" %*
set "RC=%errorlevel%"

echo.
if "%RC%"=="0" (
  echo  [TAMAM] Kurulum tamamlandi.
) else (
  echo  [HATA] Kurulum hata ile bitti ^(kod %RC%^). Yukaridaki mesajlari kontrol edin.
)
pause
exit /b %RC%
