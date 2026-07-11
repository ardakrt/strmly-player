$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$electronLog = Join-Path $env:TEMP "strmly-performance-electron.log"
$electronExe = Join-Path $projectRoot "node_modules\electron\dist\electron.exe"
if (-not (Test-Path $electronExe)) {
  $electronExe = Join-Path $projectRoot "node_modules\.bin\electron.cmd"
}

try {
  Push-Location $projectRoot
  # Full ship build (tsc -b && vite) — same gate as D6; do not soft-replace with vite-only.
  npm run build | Out-Host
  if ($LASTEXITCODE -ne 0) { throw "Production build failed with exit code $LASTEXITCODE." }
  if (-not (Test-Path (Join-Path $projectRoot "dist\index.html"))) {
    throw "dist/index.html missing after production build."
  }

  # Defaults match electron/main.js / performance-benchmark expectations (30 iters, 2 warmups).
  $iterations = if ($env:STRMLY_PERF_ITERATIONS) { $env:STRMLY_PERF_ITERATIONS } else { "30" }
  $warmups = if ($env:STRMLY_PERF_WARMUPS) { $env:STRMLY_PERF_WARMUPS } else { "2" }

  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $electronExe
  $psi.Arguments = "."
  $psi.WorkingDirectory = $projectRoot
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.CreateNoWindow = $true
  $psi.EnvironmentVariables["STRMLY_PERF_BENCH"] = "1"
  $psi.EnvironmentVariables["STRMLY_PERF_ITERATIONS"] = "$iterations"
  $psi.EnvironmentVariables["STRMLY_PERF_WARMUPS"] = "$warmups"

  $proc = New-Object System.Diagnostics.Process
  $proc.StartInfo = $psi
  [void]$proc.Start()
  $stdout = $proc.StandardOutput.ReadToEnd()
  $stderr = $proc.StandardError.ReadToEnd()
  $proc.WaitForExit()
  $combined = @($stdout, $stderr) -join "`n"
  $combined | Set-Content -Path $electronLog -Encoding UTF8
  Write-Host $combined

  if ($proc.ExitCode -ne 0) {
    throw "Performance benchmark failed with exit code $($proc.ExitCode)."
  }
  if ($combined -notmatch "STRMLY_PERF_RESULT=") {
    throw "Performance benchmark exited without producing results."
  }
  Write-Host "Performance benchmark completed successfully (iterations=$iterations warmups=$warmups)."
} finally {
  Pop-Location
}
