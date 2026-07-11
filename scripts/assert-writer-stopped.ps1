#Requires -Version 5.1
# Detect concurrent product writers.
# Exit codes:
#   0 = product clean for SamplesRequired consecutive identical samples
#   2 = product dirty but STABLE (no motion) for SamplesRequired samples (safe to absorb)
#   1 = ACTIVE writer (product porcelain changed while HEAD unchanged) or timeout
param(
  [string]$ScratchDir = $(if ($env:GROK_SCRATCH) { $env:GROK_SCRATCH } else { "C:\Users\ardak\AppData\Local\Temp\grok-goal-2a4b68f5a1c6\implementer" }),
  [int]$SamplesRequired = 6,
  [int]$SampleIntervalSeconds = 5,
  [switch]$RequireClean
)

$ErrorActionPreference = "Continue"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot
New-Item -ItemType Directory -Force -Path $ScratchDir | Out-Null

$AbandonedPatterns = @(
  '^\?\? \.grok', '^\?\? \.agents', '^\?\? mcps', '^\?\? testsprite-plans',
  '^\?\? test_image', '^\?\? \.env$', '^\?\? \.repo-cleanup-lock$',
  '^\?\? dist/', '^\?\? node_modules/'
)
$ProductPrefixes = @('src/', 'electron/', 'scripts/', '.github/', 'package.json', 'README.md', 'vite.config.ts', '.env.example')

function Test-IsProductLine([string]$line) {
  if ([string]::IsNullOrWhiteSpace($line)) { return $false }
  foreach ($p in $AbandonedPatterns) { if ($line -match $p) { return $false } }
  if ($line.Length -lt 4) { return $false }
  $path = $line.Substring(3).Trim()
  if ($path -match ' -> ') { $path = ($path -split ' -> ', 2)[1].Trim() }
  $pathNorm = $path -replace '\\', '/'
  foreach ($prefix in $ProductPrefixes) {
    $t = $prefix.TrimEnd('/')
    if ($pathNorm -eq $t -or $pathNorm.StartsWith($prefix)) { return $true }
  }
  if ($line.StartsWith('??')) { return $false }
  return $true
}

function Get-ProductPorcelain {
  return @(git status --porcelain 2>$null | Where-Object { Test-IsProductLine $_ })
}

function Write-ActiveWriterEvidence([string]$reason, $product, $prev, $curr, $history) {
  $procs = @(Get-Process -ErrorAction SilentlyContinue | Where-Object {
    $_.ProcessName -match 'codex|claude|Cursor|Code'
  } | Select-Object ProcessName, Id, @{n='MB';e={[math]::Round($_.WS/1MB,1)}})
  $lines = @(
    "=== ACTIVE WRITER EVIDENCE ==="
    "Date: $(Get-Date -Format o)"
    "Reason: $reason"
    "HEAD: $(git rev-parse HEAD)"
    "Previous: $prev"
    "Current: $curr"
    "Product lines:"
    ($product -join [Environment]::NewLine)
    "Processes:"
    (($procs | Format-Table -AutoSize | Out-String).Trim())
    "History:"
    ($history -join [Environment]::NewLine)
  )
  $path = Join-Path $ScratchDir "active-writer-evidence.txt"
  $lines -join [Environment]::NewLine | Set-Content -Path $path -Encoding UTF8
  Write-Host "wrote $path"
}

$headBaseline = (git rev-parse HEAD).Trim()
$prevSnap = $null
$stable = 0
$history = New-Object System.Collections.Generic.List[string]
$maxLoops = $SamplesRequired * 4

Write-Host "=== assert-writer-stopped samples=$SamplesRequired interval=${SampleIntervalSeconds}s requireClean=$RequireClean ==="

for ($i = 1; $i -le $maxLoops; $i++) {
  $head = (git rev-parse HEAD).Trim()
  $product = @(Get-ProductPorcelain)
  $snap = ($product -join "|")
  $history.Add("[$(Get-Date -Format o)] head=$($head.Substring(0,7)) dirty=$($product.Count)")

  if ($head -ne $headBaseline) {
    # Our process may have committed; reset baseline (not a concurrent writer)
    $headBaseline = $head
    $prevSnap = $null
    $stable = 0
    Write-Host "sample ${i}: HEAD moved - reset"
    Start-Sleep -Seconds $SampleIntervalSeconds
    continue
  }

  if ($null -ne $prevSnap -and $snap -ne $prevSnap) {
    Write-Host "sample ${i}: MOTION (porcelain changed, HEAD fixed) ACTIVE_WRITER"
    Write-ActiveWriterEvidence "porcelain-changed-head-fixed" $product $prevSnap $snap $history
    exit 1
  }

  if ($null -eq $prevSnap) {
    $prevSnap = $snap
    $stable = 1
    Write-Host "sample ${i}: baseline dirty=$($product.Count) stable=1"
  } else {
    $stable++
    Write-Host "sample ${i}: identical dirty=$($product.Count) stable=$stable/$SamplesRequired"
  }

  if ($stable -ge $SamplesRequired) {
    if ($product.Count -eq 0) {
      Write-Host "WRITER_STOPPED clean"
      exit 0
    }
    if (-not $RequireClean) {
      Write-Host "WRITER_PAUSED stable-dirty count=$($product.Count) (safe to absorb)"
      exit 2
    }
    Write-Host "stable dirty but RequireClean - keep waiting"
    # keep looping; if no motion, will stay here until timeout with dirty
  }

  $prevSnap = $snap
  Start-Sleep -Seconds $SampleIntervalSeconds
}

$product = @(Get-ProductPorcelain)
Write-ActiveWriterEvidence "timeout" $product $prevSnap $prevSnap $history
Write-Host "WRITER_NOT_STOPPED timeout"
exit 1
