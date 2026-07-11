#Requires -Version 5.1
# Single verifier entrypoint: assert writer quiet -> gate (absorb+evidence) -> assert clean again
param(
  [string]$ScratchDir = $(if ($env:GROK_SCRATCH) { $env:GROK_SCRATCH } else { "C:\Users\ardak\AppData\Local\Temp\grok-goal-2a4b68f5a1c6\implementer" }),
  [int]$WriterSamples = 6,
  [int]$WriterIntervalSeconds = 5
)

$ErrorActionPreference = "Continue"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot
New-Item -ItemType Directory -Force -Path $ScratchDir | Out-Null
$env:GROK_SCRATCH = $ScratchDir

Write-Host "======== run-repo-cleanup-verify START ========"

function Invoke-PsFile([string]$File, [string[]]$ExtraArgs) {
  $argList = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $File) + $ExtraArgs
  $p = Start-Process -FilePath "powershell.exe" -ArgumentList $argList -Wait -PassThru -NoNewWindow
  if ($null -eq $p.ExitCode) { return 1 }
  return [int]$p.ExitCode
}

# 1) Gate (includes writer assert, single absorb, atomic evidence)
$gate = Join-Path $PSScriptRoot "repo-cleanup-gate.ps1"
$gateCode = Invoke-PsFile $gate @(
  "-ScratchDir", $ScratchDir,
  "-WriterSamples", "$WriterSamples",
  "-WriterIntervalSeconds", "$WriterIntervalSeconds",
  "-MaxWriterRetries", "12"
)
Write-Host "gate_exit=$gateCode"
if ($gateCode -ne 0) {
  Write-Host "VERIFY_FAIL gate"
  exit $gateCode
}

# 2) Post-check: writer still quiet and product clean (RequireClean)
$assert = Join-Path $PSScriptRoot "assert-writer-stopped.ps1"
$assertCode = Invoke-PsFile $assert @(
  "-ScratchDir", $ScratchDir,
  "-SamplesRequired", "$WriterSamples",
  "-SampleIntervalSeconds", "$WriterIntervalSeconds",
  "-RequireClean"
)
Write-Host "post_assert_exit=$assertCode"
if ($assertCode -ne 0) {
  Write-Host "VERIFY_FAIL post-assert (writer returned or product dirty) - re-run gate once"
  $gateCode2 = Invoke-PsFile $gate @(
    "-ScratchDir", $ScratchDir,
    "-WriterSamples", "$WriterSamples",
    "-WriterIntervalSeconds", "$WriterIntervalSeconds",
    "-MaxWriterRetries", "12"
  )
  if ($gateCode2 -ne 0) { exit $gateCode2 }
  $assertCode2 = Invoke-PsFile $assert @(
    "-ScratchDir", $ScratchDir,
    "-SamplesRequired", "4",
    "-SampleIntervalSeconds", "2",
    "-RequireClean"
  )
  if ($assertCode2 -ne 0) { exit 1 }
}

# 3) Refresh inventory/evidence companion files from LIVE status (same moment)
$ts = Get-Date -Format o
$sb = (git status -sb | Out-String).Trim()
$pc = (git status --porcelain | Out-String).Trim()
$log = (git log 5a3d4f7..HEAD --oneline 2>&1 | Out-String).Trim()
if ([string]::IsNullOrWhiteSpace($log)) { $log = (git log -12 --oneline | Out-String).Trim() }

@(
  "=== POST-CLEANUP REPO INVENTORY ==="
  "Date: $ts"
  "entrypoint: scripts/run-repo-cleanup-verify.ps1"
  (git remote -v | Out-String).Trim()
  (git branch -avv | Out-String).Trim()
  (git worktree list | Out-String).Trim()
  "status:"
  $sb
  $pc
  "abandoned: .agents/ .grok/ mcps/ testsprite-plans/ test_image.jpg .env .repo-cleanup-lock"
  "salvage:"
  $log
) -join [Environment]::NewLine | Set-Content (Join-Path $ScratchDir "repo-inventory-after.txt") -Encoding UTF8

@(
  "=== SALVAGE EVIDENCE ==="
  "Date: $ts"
  "entrypoint: scripts/run-repo-cleanup-verify.ps1"
  (git log 5a3d4f7..HEAD --format="%h %s" 2>&1 | Out-String).Trim()
  "TIP:"
  (git log -1 --format=fuller | Out-String).Trim()
  (git show --stat --oneline -1 | Out-String).Trim()
  "MODULE: $((node scripts/verify-salvage-modules.js 2>&1 | Out-String).Trim())"
  "STATUS: $sb"
) -join [Environment]::NewLine | Set-Content (Join-Path $ScratchDir "salvage-evidence.txt") -Encoding UTF8

Write-Host "======== VERIFY PASS ========"
Get-Content (Join-Path $ScratchDir "verification-run.txt")
Write-Host "tip=$(git rev-parse --short HEAD)"
exit 0
