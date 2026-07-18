@echo off
setlocal
chcp 65001 >nul
title Report Validation Status Compare

cd /d "%~dp0"

set "LATEST=.tmp\report-validation-status-latest.txt"
if not exist "%LATEST%" (
  echo [FAIL] Latest status capture file was not found.
  echo Run 리포트_상태캡처.bat first.
  echo.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$path = '%LATEST%';" ^
  "$lines = Get-Content -LiteralPath $path;" ^
  "$expected = [ordered]@{" ^
  "  'WEB status' = '200';" ^
  "  'API status' = '200';" ^
  "  'products' = '1';" ^
  "  'experiments' = '1';" ^
  "  'results' = '2';" ^
  "  'jobs' = '1';" ^
  "  'api accounts' = '2';" ^
  "  'logs' = '1';" ^
  "  'running experiments' = '1';" ^
  "  'up count' = '1';" ^
  "  'down count' = '1';" ^
  "  'average rank delta' = '-3.5'" ^
  "};" ^
  "$actual = @{};" ^
  "foreach ($line in $lines) { if ($line -match '^(.*?):\s*(.*)$') { $actual[$matches[1]] = $matches[2] } }" ^
  "$failed = $false;" ^
  "Write-Host 'Report validation status comparison';" ^
  "Write-Host ('Source: ' + $path);" ^
  "Write-Host '';" ^
  "foreach ($pair in $expected.GetEnumerator()) {" ^
  "  $name = $pair.Key;" ^
  "  $want = $pair.Value;" ^
  "  $got = if ($actual.ContainsKey($name)) { $actual[$name] } else { '<missing>' };" ^
  "  if ($got -eq $want) { Write-Host ('[OK]   ' + $name + ' = ' + $got) } else { Write-Host ('[DIFF] ' + $name + ' expected=' + $want + ' actual=' + $got); $failed = $true }" ^
  "}" ^
  "if ($failed) { exit 2 }"

if errorlevel 2 (
  echo.
  echo [WARN] Differences were found. Check whether the seed data or runtime state changed.
  echo.
  pause
  exit /b 0
)

if errorlevel 1 (
  echo.
  echo [FAIL] Status comparison failed.
  echo.
  pause
  exit /b 1
)

echo.
echo [DONE] Latest status matches the expected validation baseline.
echo.
pause
