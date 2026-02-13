param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$taskFile = Join-Path $root 'task.json'
$progressFile = Join-Path $root 'progress.txt'

Write-Host '[init] project root:' $root

if (!(Test-Path $taskFile)) {
  throw "task.json not found: $taskFile"
}

$taskData = Get-Content -Raw -Path $taskFile | ConvertFrom-Json
$pending = @($taskData.tasks | Where-Object { $_.status -eq 'pending' } | Sort-Object priority, id)

Write-Host '[init] pending tasks:' $pending.Count
if ($pending.Count -gt 0) {
  $next = $pending[0]
  Write-Host '[init] next task:' "$($next.id) $($next.title)"
  Write-Host '[init] acceptance:'
  foreach ($a in $next.acceptance) { Write-Host ' -' $a }
} else {
  Write-Host '[init] no pending tasks.'
}

if (Test-Path $progressFile) {
  Write-Host '[init] progress file:' $progressFile
} else {
  Write-Host '[init] progress file missing, create one before work.'
}
