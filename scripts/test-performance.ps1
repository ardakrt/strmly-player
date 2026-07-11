$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$electronLog = Join-Path $env:TEMP "strmly-performance-electron.log"
$electronExe = Join-Path $projectRoot "node_modules\electron\dist\electron.exe"
if (-not (Test-Path $electronExe)) {
  $electronExe = Join-Path $projectRoot "node_modules\.bin\electron.cmd"
}

try {
  Push-Location $projectRoot
  # Vite-only production bundle for the Electron bench path. Full `npm run build`
  # (tsc -b && vite) remains the ship gate (D6); the bench needs a loadable dist/.
  npx vite build | Out-Host
  if ($LASTEXITCODE -ne 0) { throw "Vite production build failed with exit code $LASTEXITCODE." }
  if (-not (Test-Path (Join-Path $projectRoot "dist\index.html"))) {
    throw "dist/index.html missing after vite build."
  }

  $iterations = if ($env:STRMLY_PERF_ITERATIONS) { $env:STRMLY_PERF_ITERATIONS } else { "6" }
  $warmups = if ($env:STRMLY_PERF_WARMUPS) { $env:STRMLY_PERF_WARMUPS } else { "1" }

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
  Write-Host "Performance benchmark completed successfully."
} finally {
  Pop-Location
}
