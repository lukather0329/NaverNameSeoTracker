@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title Report Manual Validation Start

cd /d "%~dp0"

where git >nul 2>nul
if errorlevel 1 (
  echo [오류] Git이 설치되어 있지 않거나 PATH에 없습니다.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [오류] npm이 설치되어 있지 않거나 PATH에 없습니다.
  pause
  exit /b 1
)

if not exist ".git\HEAD" (
  echo [오류] 현재 폴더가 올바른 Git 저장소가 아닙니다.
  pause
  exit /b 1
)

echo.
echo ==========================================
echo 리포트 수동 검증 준비를 시작합니다.
echo 대상 브랜치: feature/reports
echo ==========================================
echo.

git checkout feature/reports
if errorlevel 1 (
  echo [실패] feature/reports 브랜치로 전환하지 못했습니다.
  pause
  exit /b 1
)

git pull origin feature/reports
if errorlevel 1 (
  echo [실패] origin/feature/reports 최신 내용을 가져오지 못했습니다.
  pause
  exit /b 1
)

echo.
echo [1/5] npm install
call npm install
if errorlevel 1 (
  echo [실패] npm install 중 오류가 발생했습니다.
  pause
  exit /b 1
)

echo.
echo [2/5] prisma generate
call npm run prisma:generate
if errorlevel 1 (
  echo [실패] prisma generate 중 오류가 발생했습니다.
  echo        로컬 dev 서버가 켜져 있다면 종료 후 다시 시도해 주세요.
  pause
  exit /b 1
)

echo.
echo [3/5] prisma seed
call npm run prisma:seed
if errorlevel 1 (
  echo [실패] prisma seed 중 오류가 발생했습니다.
  pause
  exit /b 1
)

echo.
echo [4/5] build
call npm run build
if errorlevel 1 (
  echo [실패] build 중 오류가 발생했습니다.
  pause
  exit /b 1
)

echo.
echo [5/5] dev 서버 시작
start "NaverNameSeoTracker Dev" cmd /k "cd /d %~dp0 && npm run dev"

echo.
echo [완료] 수동 검증 준비가 끝났습니다.
echo.
echo 다음 순서로 확인하세요.
echo   1. 브라우저에서 http://localhost:5173 열기
echo   2. 리포트 메뉴 확인
echo   3. API 계정 메뉴 확인
echo   4. REPORT_MANUAL_VALIDATION_LOG_2026-07-18.md 체크
echo.
echo 참고 문서
echo   - docs\REPORT_MANUAL_VALIDATION_QUICKSTART.md
echo   - REPORT_MERGE_CHECKLIST.md
echo   - REPORT_MANUAL_VALIDATION_LOG_2026-07-18.md
echo.
pause
