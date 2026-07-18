@echo off
setlocal
chcp 65001 >nul
title Report Manual Validation Cleanup

cd /d "%~dp0"

echo.
echo ==========================================
echo Report manual validation cleanup
echo Repo: %~dp0
echo ==========================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$repo = [System.IO.Path]::GetFullPath('%~dp0');" ^
  "$patterns = @('npm run dev','concurrently','vite','tsx watch src/server.ts');" ^
  "$targets = Get-CimInstance Win32_Process | Where-Object { $cmd = $_.CommandLine; $cmd -and $cmd.Contains($repo) -and (($patterns | Where-Object { $cmd.Contains($_) }).Count -gt 0) };" ^
  "$count = 0;" ^
  "foreach ($p in $targets) { try { Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop; $count++ } catch {} }" ^
  "Write-Host ('Stopped processes: ' + $count);"

if errorlevel 1 (
  echo [FAIL] Cleanup command failed.
  pause
  exit /b 1
)

echo.
echo [DONE] Cleanup finished.
echo You can now rerun validation or Prisma commands safely.
echo.
pause
