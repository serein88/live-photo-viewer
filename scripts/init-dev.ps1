param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$taskFile = Join-Path $root 'task.md'
$progressFile = Join-Path $root 'progress.md'

Write-Host '[init] project root:' $root

if (!(Test-Path $taskFile)) {
  throw "task.md not found: $taskFile"
}

$lines = Get-Content -Path $taskFile

function Get-SectionRows {
  param(
    [string[]]$AllLines,
    [string]$SectionName
  )

  $start = ($AllLines | Select-String -Pattern ("^## " + [regex]::Escape($SectionName) + "$") | Select-Object -First 1).LineNumber
  if (-not $start) { return @() }

  $end = ($AllLines | Select-String -Pattern '^## ' | Where-Object { $_.LineNumber -gt $start } | Select-Object -First 1).LineNumber
  if (-not $end) { $end = $AllLines.Length + 1 }

  $part = $AllLines[($start)..($end - 2)]
  $rows = @()

  foreach ($line in $part) {
    $m = [regex]::Match($line, '^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*$')
    if (-not $m.Success) { continue }

    $id = $m.Groups[1].Value.Trim()
    $name = $m.Groups[2].Value.Trim()
    $priority = $m.Groups[3].Value.Trim()
    $status = $m.Groups[4].Value.Trim()

    if ($id -eq '任务编号' -or $id -eq '---' -or $id -eq '暂无') { continue }

    $rows += [PSCustomObject]@{
      Id = $id
      Name = $name
      Priority = $priority
      Status = $status
    }
  }

  return $rows
}

$inProgress = @(Get-SectionRows -AllLines $lines -SectionName '进行中' | Where-Object { $_.Status -eq '进行中' })
$pending = @(Get-SectionRows -AllLines $lines -SectionName '待进行（按优先级）' | Where-Object { $_.Status -eq '待进行' })
if ($pending.Count -eq 0) {
  $pending = @(Get-SectionRows -AllLines $lines -SectionName '待进行' | Where-Object { $_.Status -eq '待进行' })
}

Write-Host '[init] in-progress tasks:' $inProgress.Count
if ($inProgress.Count -gt 0) {
  $next = $inProgress[0]
  Write-Host '[init] continue task:' "$($next.Id) $($next.Name)"
} else {
  Write-Host '[init] pending tasks:' $pending.Count
  if ($pending.Count -gt 0) {
    $next = $pending[0]
    Write-Host '[init] next task:' "$($next.Id) $($next.Name)"
  } else {
    Write-Host '[init] no pending tasks.'
  }
}
Write-Host '[init] read details in task.md'

if (Test-Path $progressFile) {
  Write-Host '[init] progress file:' $progressFile
} else {
  Write-Host '[init] progress file missing, create one before work.'
}
