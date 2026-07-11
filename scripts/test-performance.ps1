$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$viteLog = Join-Path $env:TEMP "strmly-performance-vite.log"
$viteErrorLog = Join-Path $env:TEMP "strmly-performance-vite-error.log"
$electronLog = Join-Path $env:TEMP "strmly-performance-electron.log"
$vite = $null
$port = 5187

try {
  Push-Location $projectRoot
  npm run build | Out-Host
  Remove-Item $viteLog, $viteErrorLog -ErrorAction SilentlyContinue
  $vite = Start-Process -FilePath "npm.cmd" -ArgumentList "run", "dev", "--", "--host", "localhost", "--port", "$port", "--strictPort" -PassThru -WindowStyle Hidden -RedirectStandardOutput $viteLog -RedirectStandardError $viteErrorLog

  $deadline = (Get-Date).AddSeconds(30)
  do {
    try {
      $response = Invoke-WebRequest -Uri "http://localhost:$port" -UseBasicParsing -TimeoutSec 1
      if ($response.StatusCode -eq 200) { break }
    } catch { Start-Sleep -Milliseconds 200 }
  } while ((Get-Date) -lt $deadline)

  if (-not $response -or $response.StatusCode -ne 200) { throw "Vite did not start within 30 seconds." }

  $env:STRMLY_PERF_BENCH = "1"
  $env:STRMLY_DEV_SERVER_URL = "http://localhost:$port"
  $env:STRMLY_PERF_ITERATIONS = if ($env:STRMLY_PERF_ITERATIONS) { $env:STRMLY_PERF_ITERATIONS } else { "12" }
  $env:STRMLY_PERF_WARMUPS = if ($env:STRMLY_PERF_WARMUPS) { $env:STRMLY_PERF_WARMUPS } else { "2" }
  $previousErrorAction = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  & "$projectRoot\node_modules\.bin\electron.cmd" . 2>&1 | Tee-Object -FilePath $electronLog
  $ErrorActionPreference = $previousErrorAction
  if ($LASTEXITCODE -ne 0) { throw "Performance benchmark failed with exit code $LASTEXITCODE." }
} finally {
  Remove-Item Env:STRMLY_PERF_BENCH -ErrorAction SilentlyContinue
  Remove-Item Env:STRMLY_DEV_SERVER_URL -ErrorAction SilentlyContinue
  Remove-Item Env:STRMLY_PERF_ITERATIONS -ErrorAction SilentlyContinue
  Remove-Item Env:STRMLY_PERF_WARMUPS -ErrorAction SilentlyContinue
  if ($vite -and -not $vite.HasExited) { & taskkill.exe /PID $vite.Id /T /F 2>$null | Out-Null }
  Pop-Location
}
