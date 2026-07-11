$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$electronLog = Join-Path $env:TEMP "strmly-performance-electron.log"

try {
  Push-Location $projectRoot
  npm run build | Out-Host

  $env:STRMLY_PERF_BENCH = "1"
  $env:STRMLY_PERF_ITERATIONS = if ($env:STRMLY_PERF_ITERATIONS) { $env:STRMLY_PERF_ITERATIONS } else { "12" }
  $env:STRMLY_PERF_WARMUPS = if ($env:STRMLY_PERF_WARMUPS) { $env:STRMLY_PERF_WARMUPS } else { "2" }
  $previousErrorAction = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  & "$projectRoot\node_modules\.bin\electron.cmd" . 2>&1 | Tee-Object -FilePath $electronLog
  $ErrorActionPreference = $previousErrorAction
  if ($LASTEXITCODE -ne 0) { throw "Performance benchmark failed with exit code $LASTEXITCODE." }
} finally {
  Remove-Item Env:STRMLY_PERF_BENCH -ErrorAction SilentlyContinue
  Remove-Item Env:STRMLY_PERF_ITERATIONS -ErrorAction SilentlyContinue
  Remove-Item Env:STRMLY_PERF_WARMUPS -ErrorAction SilentlyContinue
  Pop-Location
}
