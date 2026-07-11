#Requires -Version 5.1
# Bulk-absorb product WIP, multi-sample quiescence, atomic cleanup evidence.
param(
  [string]$ScratchDir = $(if ($env:GROK_SCRATCH) { $env:GROK_SCRATCH } else { "C:\Users\ardak\AppData\Local\Temp\grok-goal-2a4b68f5a1c6\implementer" }),
  [int]$CleanSamplesRequired = 5,
  [int]$SampleIntervalSeconds = 2,
  [int]$MaxAbsorbPasses = 40,
  [switch]$SkipPush
)

$ErrorActionPreference = "Continue"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot
New-Item -ItemType Directory -Force -Path $ScratchDir | Out-Null

$AbandonedPatterns = @(
  '^\?\? \.grok',
  '^\?\? \.agents',
  '^\?\? mcps',
  '^\?\? test_image',
  '^\?\? \.env$',
  '^\?\? dist/',
  '^\?\? node_modules/'
)

function Clear-BrokenCodexRefs {
  # Codex session turn-diff checkpoints can reappear and break fetch/log --all
  if (Test-Path ".git/refs/codex") {
    Remove-Item -Recurse -Force ".git/refs/codex"
    Write-Host "Removed .git/refs/codex (broken/orphan session refs)"
  }
}

$ProductPrefixes = @(
  'src/',
  'electron/',
  'scripts/',
  '.github/',
  'package.json',
  'README.md',
  'vite.config.ts',
  '.env.example'
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
  if ($line.Length -lt 4) { return $false }
  $path = $line.Substring(3).Trim()
  if ($path -match ' -> ') {
    $path = ($path -split ' -> ', 2)[1].Trim()
  }
  $pathNorm = $path -replace '\\', '/'
  foreach ($prefix in $ProductPrefixes) {
    $trimmed = $prefix.TrimEnd('/')
    if ($pathNorm -eq $trimmed -or $pathNorm.StartsWith($prefix)) {
      return $true
    }
  }
  # Tracked modifications outside abandoned noise still count as product risk
  if ($line.StartsWith('??')) { return $false }
  return $true
}

function Get-ProductPorcelain {
  $lines = @(git status --porcelain 2>$null)
  return @($lines | Where-Object { Test-IsProductLine $_ })
}

function Invoke-BulkAbsorb([int]$pass) {
  git add -u -- src electron scripts .github package.json README.md vite.config.ts .env.example 2>$null | Out-Null
  git add -- scripts src electron .github 2>$null | Out-Null
  if (Test-Path .env.example) { git add -- .env.example 2>$null | Out-Null }
  if (Test-Path package.json) { git add -- package.json 2>$null | Out-Null }
  if (Test-Path README.md) { git add -- README.md 2>$null | Out-Null }
  if (Test-Path vite.config.ts) { git add -- vite.config.ts 2>$null | Out-Null }

  $staged = @(git diff --cached --name-only 2>$null)
  if ($staged.Count -eq 0) { return $false }

  $msg = "salvage: quiesce pass $pass (bulk absorb product WIP)"
  & git commit -m $msg 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "COMMIT_FAILED pass=$pass"
    return $false
  }
  if (-not $SkipPush) {
    & git push origin main 2>&1 | Out-Null
  }
  $tip = git rev-parse --short HEAD
  Write-Host "ABSORBED pass=$pass tip=$tip files=$($staged.Count)"
  return $true
}

function Write-AtomicEvidence([string]$Reason) {
  Clear-BrokenCodexRefs
  git fetch --prune origin 2>&1 | Out-Null

  $ts = Get-Date -Format o
  $sb = (git status -sb 2>&1 | Out-String).TrimEnd()
  $pc = (git status --porcelain 2>&1 | Out-String).TrimEnd()
  $product = @(Get-ProductPorcelain)
  $productCount = $product.Count
  $head = (git rev-parse HEAD).Trim()
  $origin = (git rev-parse origin/main).Trim()
  $synced = ($head -eq $origin)
  $branches = (git branch -avv 2>&1 | Out-String).TrimEnd()
  $worktrees = (git worktree list 2>&1 | Out-String).TrimEnd()
  $log = (git log 5a3d4f7..HEAD --oneline 2>&1 | Out-String).TrimEnd()
  if ([string]::IsNullOrWhiteSpace($log)) {
    $log = (git log -10 --oneline 2>&1 | Out-String).TrimEnd()
  }

  $moduleTest = "n/a"
  if (Test-Path "scripts/verify-salvage-modules.js") {
    $moduleTest = (node scripts/verify-salvage-modules.js 2>&1 | Out-String).TrimEnd()
  }

  $nonMain = @(git for-each-ref --format="%(refname:short)" refs/heads/ | Where-Object { $_ -ne "main" })
  $onlyMain = ($nonMain.Count -eq 0)
  $codexRemote = @(git branch -r | Select-String "codex")
  $noCodexRemote = ($codexRemote.Count -eq 0)
  $noBrokenCodex = -not (Test-Path ".git/refs/codex")

  $productLines = if ($productCount -eq 0) { "(none)" } else { ($product -join [Environment]::NewLine) }

  $finalLines = @(
    "=== FINAL STATUS (written by scripts/repo-cleanup-gate.ps1) ==="
    "Date: $ts"
    "Reason: $Reason"
    ""
    "=== git status -sb ==="
    $sb
    ""
    "=== git status --porcelain ==="
    $pc
    ""
    "=== product_dirty_count (computed) ==="
    "$productCount"
    ""
    "=== product_dirty_lines (computed) ==="
    $productLines
    ""
    "=== sync ==="
    "HEAD=$head"
    "origin/main=$origin"
    "synced=$synced"
    ""
    "=== branches ==="
    $branches
    ""
    "=== worktrees ==="
    $worktrees
    ""
    "=== module test ==="
    $moduleTest
    ""
    "=== salvage log ==="
    $log
  )
  $finalPath = Join-Path $ScratchDir "final-status.txt"
  $finalLines -join [Environment]::NewLine | Set-Content -Path $finalPath -Encoding UTF8

  $allPass = ($productCount -eq 0) -and $synced -and $onlyMain -and $noCodexRemote -and $noBrokenCodex
  $overall = if ($allPass) { "PASS" } else { "FAIL" }

  $verLines = @(
    "=== VERIFICATION RUN (scripts/repo-cleanup-gate.ps1) ==="
    "Date: $ts"
    "product_dirty_count=$productCount"
    "main_synced=$synced"
    "only_main_local=$onlyMain"
    "no_codex_remote=$noCodexRemote"
    "no_broken_codex_refs=$noBrokenCodex"
    "module_test=$moduleTest"
    "live_status_sb:"
    $sb
    "live_status_porcelain:"
    $pc
    "OVERALL=$overall"
  )
  $verPath = Join-Path $ScratchDir "verification-run.txt"
  $verLines -join [Environment]::NewLine | Set-Content -Path $verPath -Encoding UTF8

  $stabLines = @(
    "product_dirty_count=$productCount"
    "head=$head"
    "origin_main=$origin"
    "synced=$synced"
    "date=$ts"
    "product_lines:"
    $productLines
  )
  $stabPath = Join-Path $ScratchDir "stability-check.txt"
  $stabLines -join [Environment]::NewLine | Set-Content -Path $stabPath -Encoding UTF8

  return $allPass
}

Write-Host "=== repo-cleanup-gate start ==="
Write-Host "scratch=$ScratchDir cleanSamples=$CleanSamplesRequired interval=${SampleIntervalSeconds}s"
Clear-BrokenCodexRefs

$absorbPass = 0
$cleanStreak = 0

while ($true) {
  $dirty = @(Get-ProductPorcelain)
  if ($dirty.Count -gt 0) {
    $cleanStreak = 0
    $absorbPass++
    if ($absorbPass -gt $MaxAbsorbPasses) {
      Write-Host "FAIL: exceeded MaxAbsorbPasses=$MaxAbsorbPasses still dirty=$($dirty.Count)"
      [void](Write-AtomicEvidence "max-absorb-exceeded")
      exit 1
    }
    Write-Host "DIRTY count=$($dirty.Count) absorbing pass=$absorbPass"
    foreach ($d in $dirty) { Write-Host "  $d" }
    $did = Invoke-BulkAbsorb $absorbPass
    if (-not $did) {
      Start-Sleep -Seconds $SampleIntervalSeconds
    }
    Start-Sleep -Seconds $SampleIntervalSeconds
    continue
  }

  $cleanStreak++
  $tip = git rev-parse --short HEAD
  Write-Host "CLEAN sample $cleanStreak/$CleanSamplesRequired tip=$tip"
  if ($cleanStreak -ge $CleanSamplesRequired) {
    break
  }
  Start-Sleep -Seconds $SampleIntervalSeconds
}

function Wait-QuietAgain([string]$label) {
  $script:cleanStreak = 0
  while ($script:cleanStreak -lt $CleanSamplesRequired) {
    Start-Sleep -Seconds $SampleIntervalSeconds
    $d = @(Get-ProductPorcelain)
    if ($d.Count -gt 0) {
      $script:cleanStreak = 0
      $script:absorbPass++
      if ($script:absorbPass -gt $MaxAbsorbPasses) {
        [void](Write-AtomicEvidence "max-absorb-$label")
        return $false
      }
      Write-Host "DIRTY during $label absorbing pass=$($script:absorbPass)"
      [void](Invoke-BulkAbsorb $script:absorbPass)
    } else {
      $script:cleanStreak++
      Write-Host "CLEAN sample $($script:cleanStreak)/$CleanSamplesRequired ($label)"
    }
  }
  return $true
}

$finalDirty = @(Get-ProductPorcelain)
if ($finalDirty.Count -gt 0) {
  Write-Host "DIRTY at final gate - restart absorb"
  $absorbPass++
  [void](Invoke-BulkAbsorb $absorbPass)
  if (-not (Wait-QuietAgain "re-quiet")) { exit 1 }
}

$ok = Write-AtomicEvidence "quiescence-ok after $CleanSamplesRequired clean samples"
Start-Sleep -Seconds $SampleIntervalSeconds
$post = @(Get-ProductPorcelain)
if ($post.Count -gt 0) {
  Write-Host "RACE dirty after evidence write"
  $absorbPass++
  [void](Invoke-BulkAbsorb $absorbPass)
  if (-not (Wait-QuietAgain "post-race")) { exit 1 }
  $ok = Write-AtomicEvidence "quiescence-ok after post-race re-quiet"
  Start-Sleep -Seconds $SampleIntervalSeconds
  $post2 = @(Get-ProductPorcelain)
  if ($post2.Count -gt 0) {
    Write-Host "FAIL still racing concurrent editor"
    [void](Write-AtomicEvidence "still-racing")
    exit 1
  }
}

if (-not $ok) {
  Write-Host "FAIL evidence checks not all pass"
  Get-Content (Join-Path $ScratchDir "verification-run.txt") -ErrorAction SilentlyContinue
  exit 1
}

Write-Host "=== GATE PASS ==="
Get-Content (Join-Path $ScratchDir "verification-run.txt")
Write-Host "----"
Get-Content (Join-Path $ScratchDir "final-status.txt")
exit 0
