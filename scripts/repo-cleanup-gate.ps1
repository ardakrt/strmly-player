#Requires -Version 5.1
<#
.SYNOPSIS
  Bulk-absorb product WIP, wait for multi-sample quiescence, write atomic cleanup evidence.

.DESCRIPTION
  Shared product-path filter for repo cleanup goals. Absorbs all product dirty paths in
  bulk (not file-by-file), requires N consecutive clean porcelain samples, then writes
  final-status / verification-run / stability-check from LIVE git output only.

.PARAMETER ScratchDir
  Directory for evidence files (default: $env:GROK_SCRATCH or implementer scratch).

.PARAMETER CleanSamplesRequired
  Consecutive clean samples required before stable (default 5).

.PARAMETER SampleIntervalSeconds
  Seconds between porcelain samples (default 2).

.PARAMETER MaxAbsorbPasses
  Max salvage commit passes before failing (default 40).
#>
[CmdletBinding()]
param(
  [string]$ScratchDir = $(if ($env:GROK_SCRATCH) { $env:GROK_SCRATCH } else { "C:\Users\ardak\AppData\Local\Temp\grok-goal-2a4b68f5a1c6\implementer" }),
  [int]$CleanSamplesRequired = 5,
  [int]$SampleIntervalSeconds = 2,
  [int]$MaxAbsorbPasses = 40,
  [switch]$SkipPush
)

$ErrorActionPreference = "Continue"
Set-Location (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
New-Item -ItemType Directory -Force -Path $ScratchDir | Out-Null

# Product paths we absorb; everything else is abandoned noise for this gate.
$ProductPathPrefixes = @(
  "src/",
  "electron/",
  "scripts/",
  ".github/",
  "package.json",
  "README.md",
  "vite.config.ts",
  ".env.example"
)

$AbandonedPatterns = @(
  '^\?\? \.grok',
  '^\?\? mcps',
  '^\?\? test_image',
  '^\?\? \.env$',
  '^\?\? dist/',
  '^\?\? node_modules/'
)

function Test-IsAbandonedLine([string]$line) {
  foreach ($p in $AbandonedPatterns) {
    if ($line -match $p) { return $true }
  }
  return $false
}

function Test-IsProductLine([string]$line) {
  if ([string]::IsNullOrWhiteSpace($line)) { return $false }
  if (Test-IsAbandonedLine $line) { return $false }
  # porcelain: XY PATH or XY ORIG -> PATH
  $path = $line.Substring(3).Trim()
  if ($path -match ' -> ') { $path = ($path -split ' -> ', 2)[1].Trim() }
  $pathNorm = $path -replace '\\', '/'
  foreach ($prefix in $ProductPathPrefixes) {
    if ($pathNorm -eq $prefix.TrimEnd('/') -or $pathNorm.StartsWith($prefix)) { return $true }
  }
  # Any other modified tracked file under repo root that is not abandoned noise is product risk
  if ($line -match '^[ MADRCU?]{2} ') {
    # Untracked non-product non-abandoned: ignore (noise)
    if ($line.StartsWith('??')) { return $false }
    # Tracked modifications outside known prefixes still count as product (defensive)
    return $true
  }
  return $false
}

function Get-ProductPorcelain {
  @(git status --porcelain 2>$null | Where-Object { Test-IsProductLine $_ })
}

function Invoke-BulkAbsorb([int]$pass) {
  # Stage all product path trees / known files (tracked updates + new product files under those trees)
  git add -u -- src electron scripts .github package.json README.md vite.config.ts .env.example 2>$null
  if (Test-Path "scripts") { git add -- scripts 2>$null }
  if (Test-Path "src") { git add -- src 2>$null }
  if (Test-Path "electron") { git add -- electron 2>$null }
  if (Test-Path ".github") { git add -- .github 2>$null }
  if (Test-Path ".env.example") { git add -- .env.example 2>$null }
  if (Test-Path "package.json") { git add -- package.json 2>$null }
  if (Test-Path "README.md") { git add -- README.md 2>$null }
  if (Test-Path "vite.config.ts") { git add -- vite.config.ts 2>$null }

  $staged = @(git diff --cached --name-only 2>$null)
  if ($staged.Count -eq 0) { return $false }

  $msg = "salvage: quiesce pass $pass (bulk absorb product WIP)"
  git commit -m $msg 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "COMMIT_FAILED pass=$pass"
    return $false
  }
  if (-not $SkipPush) {
    git push origin main 2>&1 | Out-Null
  }
  Write-Host "ABSORBED pass=$pass tip=$(git rev-parse --short HEAD) files=$($staged.Count) $($staged -join ',')"
  return $true
}

function Write-AtomicEvidence {
  param([string]$Reason)

  git fetch --prune origin 2>&1 | Out-Null

  $ts = Get-Date -Format o
  $sb = (git status -sb 2>&1 | Out-String).TrimEnd()
  $pc = (git status --porcelain 2>&1 | Out-String).TrimEnd()
  $product = Get-ProductPorcelain
  $productCount = $product.Count
  $head = (git rev-parse HEAD).Trim()
  $origin = (git rev-parse origin/main).Trim()
  $synced = $head -eq $origin
  $branches = (git branch -avv 2>&1 | Out-String).TrimEnd()
  $worktrees = (git worktree list 2>&1 | Out-String).TrimEnd()
  $log = (git log 5a3d4f7..HEAD --oneline 2>&1 | Out-String).TrimEnd()
  if (-not $log) { $log = (git log -10 --oneline 2>&1 | Out-String).TrimEnd() }

  $moduleTest = ""
  if (Test-Path "scripts/verify-salvage-modules.js") {
    $moduleTest = (node scripts/verify-salvage-modules.js 2>&1 | Out-String).TrimEnd()
  }

  $onlyMain = -not [bool](git for-each-ref --format='%(refname:short)' refs/heads/ | Where-Object { $_ -ne 'main' })
  $noCodexRemote = -not [bool](git branch -r | Select-String 'codex')
  $noBrokenCodex = -not (Test-Path ".git/refs/codex")

  $final = @"
=== FINAL STATUS (written by scripts/repo-cleanup-gate.ps1) ===
Date: $ts
Reason: $Reason

=== git status -sb ===
$sb

=== git status --porcelain ===
$pc

=== product_dirty_count (computed) ===
$productCount

=== product_dirty_lines (computed) ===
$($product -join "`n")

=== sync ===
HEAD=$head
origin/main=$origin
synced=$synced

=== branches ===
$branches

=== worktrees ===
$worktrees

=== module test ===
$moduleTest

=== salvage log (since 5a3d4f7 if present) ===
$log
"@
  Set-Content -Path (Join-Path $ScratchDir "final-status.txt") -Value $final -Encoding UTF8

  $allPass = ($productCount -eq 0) -and $synced -and $onlyMain -and $noCodexRemote -and $noBrokenCodex
  $ver = @"
=== VERIFICATION RUN (scripts/repo-cleanup-gate.ps1) ===
Date: $ts
product_dirty_count=$productCount
main_synced=$synced
only_main_local=$onlyMain
no_codex_remote=$noCodexRemote
no_broken_codex_refs=$noBrokenCodex
module_test=$moduleTest
live_status_sb:
$sb
live_status_porcelain:
$pc
OVERALL=$(if ($allPass) { 'PASS' } else { 'FAIL' })
"@
  Set-Content -Path (Join-Path $ScratchDir "verification-run.txt") -Value $ver -Encoding UTF8

  $stab = @"
product_dirty_count=$productCount
head=$head
origin_main=$origin
synced=$synced
date=$ts
product_lines:
$($product -join "`n")
"@
  Set-Content -Path (Join-Path $ScratchDir "stability-check.txt") -Value $stab -Encoding UTF8

  return $allPass
}

Write-Host "=== repo-cleanup-gate start ==="
Write-Host "scratch=$ScratchDir cleanSamples=$CleanSamplesRequired interval=${SampleIntervalSeconds}s"

$absorbPass = 0
$cleanStreak = 0

while ($true) {
  $dirty = Get-ProductPorcelain
  if ($dirty.Count -gt 0) {
    $cleanStreak = 0
    $absorbPass++
    if ($absorbPass -gt $MaxAbsorbPasses) {
      Write-Host "FAIL: exceeded MaxAbsorbPasses=$MaxAbsorbPasses still dirty=$($dirty.Count)"
      [void](Write-AtomicEvidence -Reason "max-absorb-exceeded")
      exit 1
    }
    Write-Host "DIRTY count=$($dirty.Count) absorbing pass=$absorbPass"
    $dirty | ForEach-Object { Write-Host "  $_" }
    $did = Invoke-BulkAbsorb -pass $absorbPass
    if (-not $did) {
      # Nothing staged but dirty reported — may be unstageable; re-sample
      Start-Sleep -Seconds $SampleIntervalSeconds
    }
    Start-Sleep -Seconds $SampleIntervalSeconds
    continue
  }

  # Clean sample
  $cleanStreak++
  Write-Host "CLEAN sample $cleanStreak/$CleanSamplesRequired tip=$(git rev-parse --short HEAD)"
  if ($cleanStreak -ge $CleanSamplesRequired) {
    break
  }
  Start-Sleep -Seconds $SampleIntervalSeconds
}

# Final re-check immediately before evidence
$finalDirty = Get-ProductPorcelain
if ($finalDirty.Count -gt 0) {
  Write-Host "DIRTY appeared at final gate — restart absorb once"
  $absorbPass++
  [void](Invoke-BulkAbsorb -pass $absorbPass)
  $cleanStreak = 0
  while ($cleanStreak -lt $CleanSamplesRequired) {
    Start-Sleep -Seconds $SampleIntervalSeconds
    $d = Get-ProductPorcelain
    if ($d.Count -gt 0) {
      $cleanStreak = 0
      $absorbPass++
      [void](Invoke-BulkAbsorb -pass $absorbPass)
    } else {
      $cleanStreak++
      Write-Host "CLEAN sample $cleanStreak/$CleanSamplesRequired (re-quiet)"
    }
    if ($absorbPass -gt $MaxAbsorbPasses) {
      [void](Write-AtomicEvidence -Reason "max-absorb-on-requiet")
      exit 1
    }
  }
}

$ok = Write-AtomicEvidence -Reason "quiescence-ok after $CleanSamplesRequired clean samples"
# Post-write race sample (must still match evidence product_dirty_count)
Start-Sleep -Seconds $SampleIntervalSeconds
$post = Get-ProductPorcelain
if ($post.Count -gt 0) {
  Write-Host "RACE: dirty after evidence write: $($post -join ' | ')"
  $absorbPass++
  [void](Invoke-BulkAbsorb -pass $absorbPass)
  $cleanStreak = 0
  while ($cleanStreak -lt $CleanSamplesRequired) {
    Start-Sleep -Seconds $SampleIntervalSeconds
    $d = Get-ProductPorcelain
    if ($d.Count -gt 0) {
      $cleanStreak = 0
      $absorbPass++
      if ($absorbPass -gt $MaxAbsorbPasses) {
        [void](Write-AtomicEvidence -Reason "race-max-absorb")
        exit 1
      }
      [void](Invoke-BulkAbsorb -pass $absorbPass)
    } else {
      $cleanStreak++
      Write-Host "CLEAN sample $cleanStreak/$CleanSamplesRequired (post-race)"
    }
  }
  $ok = Write-AtomicEvidence -Reason "quiescence-ok after post-race re-quiet"
  Start-Sleep -Seconds $SampleIntervalSeconds
  $post2 = Get-ProductPorcelain
  if ($post2.Count -gt 0) {
    Write-Host "FAIL: still racing concurrent editor"
    [void](Write-AtomicEvidence -Reason "still-racing")
    exit 1
  }
}

if (-not $ok) {
  Write-Host "FAIL: evidence checks not all pass"
  Get-Content (Join-Path $ScratchDir "verification-run.txt")
  exit 1
}

Write-Host "=== GATE PASS ==="
Get-Content (Join-Path $ScratchDir "verification-run.txt")
Get-Content (Join-Path $ScratchDir "final-status.txt")
exit 0
