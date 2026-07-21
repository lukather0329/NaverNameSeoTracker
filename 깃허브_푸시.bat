@echo off
if /i not "%~1"=="_utf8" (
  chcp 65001 >nul
  cmd /c ""%~f0" _utf8"
  exit /b %errorlevel%
)
setlocal enabledelayedexpansion
title Git Push

cd /d "%~dp0"

where git >nul 2>nul
if errorlevel 1 goto :err_no_git

if not exist ".git\HEAD" goto :err_no_repo

git remote get-url origin >nul 2>nul
if errorlevel 1 goto :err_no_remote

for /f "delims=" %%i in ('git branch --show-current 2^>nul') do set CURRENT_BRANCH=%%i
if "%CURRENT_BRANCH%"=="" goto :err_no_branch

echo.
git status --short
echo.
set /p COMMIT_MESSAGE=커밋 메시지를 입력하세요 ^(비우면 자동 메시지 사용^):
if "%COMMIT_MESSAGE%"=="" set COMMIT_MESSAGE=chore: update local changes

git add .
git diff --cached --quiet
if errorlevel 1 goto :do_commit
goto :no_changes

:do_commit
git commit -m "%COMMIT_MESSAGE%"
if errorlevel 1 goto :err_commit_failed
goto :after_commit

:no_changes
echo [안내] 커밋할 변경사항이 없어 push만 진행합니다.

:after_commit
echo.
echo [진행] origin/%CURRENT_BRANCH% 로 push 합니다...
git push origin %CURRENT_BRANCH%
if errorlevel 1 goto :err_push_failed

echo.
echo [완료] GitHub push가 끝났습니다.
pause
exit /b 0

:err_no_git
echo [오류] Git이 설치되어 있지 않거나 PATH에 없습니다.
pause
exit /b 1

:err_no_repo
echo [오류] 현재 폴더는 정상적인 Git 저장소가 아닙니다.
echo        먼저 git init 또는 원격 저장소 clone이 필요합니다.
pause
exit /b 1

:err_no_remote
echo [오류] origin 원격 저장소가 설정되어 있지 않습니다.
echo        예: git remote add origin https://github.com/USER/REPO.git
pause
exit /b 1

:err_no_branch
echo [오류] 현재 브랜치를 확인할 수 없습니다.
pause
exit /b 1

:err_commit_failed
echo.
echo [실패] commit 중 오류가 발생했습니다.
pause
exit /b 1

:err_push_failed
echo.
echo [실패] push 중 오류가 발생했습니다.
echo        원격 변경사항이 있으면 먼저 pull 후 다시 시도하세요.
pause
exit /b 1
