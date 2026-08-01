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

  $resultMatch = [regex]::Match($combined, 'STRMLY_PERF_RESULT=(\{[^\r\n]+\})')
  if (-not $resultMatch.Success) {
    if ($proc.ExitCode -ne 0) {
      throw "Performance benchmark failed with exit code $($proc.ExitCode)."
    }
    throw "Performance benchmark exited without producing results."
  }
  $result = $resultMatch.Groups[1].Value | ConvertFrom-Json
  $navigationPages = @($result.navigation.PSObject.Properties)
  if ($navigationPages.Count -lt 7) {
    throw "Performance benchmark did not measure every navigation page."
  }
  foreach ($page in $navigationPages) {
    $metrics = $page.Value
    if (@($metrics.samples).Count -ne [int]$iterations) {
      throw "Navigation sample count mismatch for $($page.Name)."
    }
    if ([double]$metrics.p95Ms -gt 60 -or [double]$metrics.maxMs -gt 100) {
      throw "Navigation performance regression on $($page.Name): p95=$($metrics.p95Ms)ms max=$($metrics.maxMs)ms."
    }
  }
  $requiredScrollablePages = @("Canli TV", "Sinema", "Diziler")
  foreach ($pageName in $requiredScrollablePages) {
    $page = $result.scroll.PSObject.Properties[$pageName]
    if ($null -eq $page -or [double]$page.Value.scrollRange -lt 1000) {
      throw "Performance benchmark did not exercise the $pageName catalog (scrollRange=$($page.Value.scrollRange))."
    }
  }
  $scrollablePages = @($result.scroll.PSObject.Properties | Where-Object { [double]$_.Value.scrollRange -gt 0 })
  foreach ($page in $scrollablePages) {
    $metrics = $page.Value
    if ([double]$metrics.p95FrameMs -gt 24 -or [double]$metrics.maxFrameMs -gt 80 -or [double]$metrics.missedFramePercent -gt 5) {
      throw "Scroll performance regression on $($page.Name): p95=$($metrics.p95FrameMs)ms max=$($metrics.maxFrameMs)ms missed=$($metrics.missedFramePercent)%."
    }
  }
  Write-Host "Performance benchmark completed successfully (iterations=$iterations warmups=$warmups)."
} finally {
  Pop-Location
}
