@echo off
setlocal
chcp 65001 >nul
title Report Smoke Check

cd /d "%~dp0"

echo.
echo ==========================================
echo Report smoke check
echo Date: 2026-07-18
echo Repo: %~dp0
echo ==========================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$webUrl = 'http://localhost:5173';" ^
  "$apiUrl = 'http://localhost:4300/api/snapshot';" ^
  "$web = Invoke-WebRequest -Uri $webUrl -UseBasicParsing -TimeoutSec 5;" ^
  "$api = Invoke-WebRequest -Uri $apiUrl -UseBasicParsing -TimeoutSec 5;" ^
  "$json = $api.Content | ConvertFrom-Json;" ^
  "Write-Host ('WEB status: ' + [int]$web.StatusCode);" ^
  "Write-Host ('API status: ' + [int]$api.StatusCode);" ^
  "Write-Host ('products: ' + $json.products.Count);" ^
  "Write-Host ('experiments: ' + $json.experiments.Count);" ^
  "Write-Host ('results: ' + $json.results.Count);" ^
  "Write-Host ('jobs: ' + $json.jobs.Count);" ^
  "Write-Host ('api accounts: ' + $json.apiAccounts.Count);" ^
  "Write-Host ('logs: ' + $json.logs.Count);" ^
  "$running = @($json.experiments | Where-Object { $_.status -eq 'RUNNING' }).Count;" ^
  "$up = @($json.results | Where-Object { $_.movement -eq 'UP' }).Count;" ^
  "$down = @($json.results | Where-Object { $_.movement -eq 'DOWN' }).Count;" ^
  "$avg = 0;" ^
  "if (@($json.results).Count -gt 0) { $avg = [Math]::Round((($json.results | Measure-Object -Property delta -Average).Average), 2) }" ^
  "Write-Host ('running experiments: ' + $running);" ^
  "Write-Host ('up count: ' + $up);" ^
  "Write-Host ('down count: ' + $down);" ^
  "Write-Host ('average rank delta: ' + $avg);"

if errorlevel 1 (
  echo.
  echo [FAIL] Smoke check failed.
  echo Make sure npm run dev is running before retrying.
  pause
  exit /b 1
)

echo.
echo [DONE] Smoke check passed.
echo.
pause
