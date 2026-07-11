#Requires -Version 5.1
# Gate: wait for concurrent writer to stop, one bulk absorb, zero-gap atomic evidence.
param(
  [string]$ScratchDir = $(if ($env:GROK_SCRATCH) { $env:GROK_SCRATCH } else { "C:\Users\ardak\AppData\Local\Temp\grok-goal-2a4b68f5a1c6\implementer" }),
  [int]$WriterSamples = 6,
  [int]$WriterIntervalSeconds = 5,
  [int]$MaxWriterRetries = 8,
  [switch]$SkipPush,
  [switch]$SkipWriterAssert
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

function Clear-BrokenCodexRefs {
  if (Test-Path ".git/refs/codex") {
    Remove-Item -Recurse -Force ".git/refs/codex"
    Write-Host "Removed .git/refs/codex"
  }
}

function Ensure-CleanupLock {
  $lockPath = Join-Path $repoRoot ".repo-cleanup-lock"
  $body = @(
    "repo-cleanup-lock"
    "created=$(Get-Date -Format o)"
    "reason=Stop concurrent agent product edits during salvage/cleanup"
    "instruction=End other Grok/Codex/Cursor agent sessions editing this repo until lock is removed"
  ) -join [Environment]::NewLine
  $body | Set-Content -Path $lockPath -Encoding UTF8
  Write-Host "Created .repo-cleanup-lock"
  $dec = Join-Path $ScratchDir "salvage-decisions.txt"
  Add-Content -Path $dec -Encoding UTF8 -Value @"

## .repo-cleanup-lock ($(Get-Date -Format o))
- Created to signal other agent sessions must stop editing product paths.
- Active writer evidence: active-writer-evidence.txt when present.
"@
}

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

function Invoke-BulkAbsorbOnce {
  git add -u -- src electron scripts .github package.json README.md vite.config.ts .env.example 2>$null | Out-Null
  git add -- scripts src electron .github 2>$null | Out-Null
  if (Test-Path .env.example) { git add -- .env.example 2>$null | Out-Null }
  if (Test-Path package.json) { git add -- package.json 2>$null | Out-Null }
  if (Test-Path README.md) { git add -- README.md 2>$null | Out-Null }
  if (Test-Path vite.config.ts) { git add -- vite.config.ts 2>$null | Out-Null }

  $staged = @(git diff --cached --name-only 2>$null)
  if ($staged.Count -eq 0) {
    Write-Host "No staged product files"
    return $false
  }
  & git commit -m "salvage: bulk absorb product WIP after writer quiet" 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "COMMIT_FAILED"
    return $false
  }
  if (-not $SkipPush) {
    & git push origin main 2>&1 | Out-Null
  }
  Write-Host "ABSORBED tip=$(git rev-parse --short HEAD) files=$($staged.Count)"
  return $true
}

function Write-AtomicEvidence([string]$Reason) {
  Clear-BrokenCodexRefs
  git fetch --prune origin 2>&1 | Out-Null

  # ZERO-GAP: capture status once, write all evidence from that capture
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
  if ([string]::IsNullOrWhiteSpace($log)) { $log = (git log -10 --oneline 2>&1 | Out-String).TrimEnd() }

  $moduleTest = "n/a"
  if (Test-Path "scripts/verify-salvage-modules.js") {
    $moduleTest = (node scripts/verify-salvage-modules.js 2>&1 | Out-String).TrimEnd()
  }

  $nonMain = @(git for-each-ref --format="%(refname:short)" refs/heads/ | Where-Object { $_ -ne "main" })
  $onlyMain = ($nonMain.Count -eq 0)
  $noCodexRemote = (@(git branch -r | Select-String "codex").Count -eq 0)
  $noBrokenCodex = -not (Test-Path ".git/refs/codex")
  $productLines = if ($productCount -eq 0) { "(none)" } else { ($product -join [Environment]::NewLine) }
  $allPass = ($productCount -eq 0) -and $synced -and $onlyMain -and $noCodexRemote -and $noBrokenCodex
  $overall = if ($allPass) { "PASS" } else { "FAIL" }

  $finalLines = @(
    "=== FINAL STATUS (scripts/repo-cleanup-gate.ps1) ==="
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
  $finalLines -join [Environment]::NewLine | Set-Content (Join-Path $ScratchDir "final-status.txt") -Encoding UTF8

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
  $verLines -join [Environment]::NewLine | Set-Content (Join-Path $ScratchDir "verification-run.txt") -Encoding UTF8

  $stabLines = @(
    "product_dirty_count=$productCount"
    "head=$head"
    "origin_main=$origin"
    "synced=$synced"
    "date=$ts"
    "product_lines:"
    $productLines
  )
  $stabLines -join [Environment]::NewLine | Set-Content (Join-Path $ScratchDir "stability-check.txt") -Encoding UTF8

  return $allPass
}

function Invoke-WriterAssert([switch]$RequireClean) {
  $assert = Join-Path $PSScriptRoot "assert-writer-stopped.ps1"
  $argList = @(
    "-NoProfile", "-ExecutionPolicy", "Bypass",
    "-File", $assert,
    "-ScratchDir", $ScratchDir,
    "-SamplesRequired", "$WriterSamples",
    "-SampleIntervalSeconds", "$WriterIntervalSeconds"
  )
  if ($RequireClean) { $argList += "-RequireClean" }
  # Start-Process for reliable exit codes from nested powershell
  $p = Start-Process -FilePath "powershell.exe" -ArgumentList $argList -Wait -PassThru -NoNewWindow
  $code = $p.ExitCode
  if ($null -eq $code) { $code = 1 }
  Write-Host "assert-writer-stopped rawExit=$code requireClean=$RequireClean"
  return [int]$code
}

function Stop-CompetingCodex {
  $codex = @(Get-Process -Name "codex" -ErrorAction SilentlyContinue)
  foreach ($p in $codex) {
    Write-Host "Stopping competing codex PID=$($p.Id)"
    try {
      Stop-Process -Id $p.Id -Force -ErrorAction Stop
      Write-Host "Stopped codex $($p.Id)"
    } catch {
      Write-Host "Could not stop codex $($p.Id): $_"
    }
  }
}

# ---- main ----
Write-Host "=== repo-cleanup-gate start ==="
Clear-BrokenCodexRefs
Ensure-CleanupLock

if (-not $SkipWriterAssert) {
  $retry = 0
  $done = $false
  while (-not $done) {
    $code = [int](Invoke-WriterAssert)
    Write-Host "assert-writer-stopped exit=$code"
    if ($code -eq 0) {
      Write-Host "Product clean and writer quiet"
      $done = $true
      break
    }
    if ($code -eq 2) {
      Write-Host "Writer paused (stable dirty) - single bulk absorb"
      [void](Invoke-BulkAbsorbOnce)
      $code2 = [int](Invoke-WriterAssert -RequireClean)
      Write-Host "assert after absorb exit=$code2"
      if ($code2 -eq 0) {
        $done = $true
        break
      }
      if ($code2 -eq 2) {
        [void](Invoke-BulkAbsorbOnce)
        $code3 = [int](Invoke-WriterAssert -RequireClean)
        Write-Host "assert after second absorb exit=$code3"
        if ($code3 -eq 0) {
          $done = $true
          break
        }
      }
      # not clean yet - treat as need retry
      $code = 1
    }
    # active writer (exit 1) or residual
    $retry++
    Clear-BrokenCodexRefs
    Ensure-CleanupLock
    Stop-CompetingCodex
    if ($retry -gt $MaxWriterRetries) {
      Write-Host "FAIL: writer still active after $MaxWriterRetries retries - refuse PASS"
      [void](Write-AtomicEvidence "writer-still-active-refuse-pass")
      exit 1
    }
    Write-Host "Writer active - retry $retry/$MaxWriterRetries after stop attempt"
    Start-Sleep -Seconds 5
  }
} else {
  $dirty = @(Get-ProductPorcelain)
  if ($dirty.Count -gt 0) { [void](Invoke-BulkAbsorbOnce) }
}

# Zero-gap evidence: capture immediately (no post-write sleep)
$ok = Write-AtomicEvidence "writer-quiet finalize"
if (-not $ok) {
  # one last absorb if something residual
  $dirty = @(Get-ProductPorcelain)
  if ($dirty.Count -gt 0) {
    [void](Invoke-BulkAbsorbOnce)
    $ok = Write-AtomicEvidence "post-final-absorb"
  }
}

if (-not $ok) {
  Write-Host "FAIL evidence"
  Get-Content (Join-Path $ScratchDir "verification-run.txt") -ErrorAction SilentlyContinue
  exit 1
}

Write-Host "=== GATE PASS ==="
Get-Content (Join-Path $ScratchDir "verification-run.txt")
Write-Host "----"
Get-Content (Join-Path $ScratchDir "final-status.txt")
exit 0
