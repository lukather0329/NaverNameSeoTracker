@echo off
setlocal
chcp 65001 >nul
title Report Validation Toolbox

cd /d "%~dp0"

:menu
cls
echo ==========================================
echo Report Validation Toolbox
echo Repo: %~dp0
echo ==========================================
echo.
echo 1. Start validation workspace
echo 2. Run smoke check
echo 3. Open operations guide
echo 4. Open manual validation log
echo 5. Cleanup validation processes
echo 6. Open local web app
echo 0. Exit
echo.
set /p choice=Select menu: 

if "%choice%"=="1" call "%~dp0리포트_수동검증_시작.bat"
if "%choice%"=="2" call "%~dp0리포트_스모크체크.bat"
if "%choice%"=="3" start "" "%~dp0docs\REPORT_VALIDATION_OPERATIONS.md"
if "%choice%"=="4" start "" "%~dp0REPORT_MANUAL_VALIDATION_LOG_2026-07-18.md"
if "%choice%"=="5" call "%~dp0리포트_수동검증_정리.bat"
if "%choice%"=="6" start "" "http://localhost:5173"
if "%choice%"=="0" exit /b 0

if not "%choice%"=="0" (
  echo.
  echo Done. Press any key to return to menu.
  pause >nul
  goto menu
)
