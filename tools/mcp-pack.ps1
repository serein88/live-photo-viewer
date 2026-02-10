param(
  [Parameter(Mandatory=$true)][string]$Dir,
  [string]$Out = "$PSScriptRoot\\..\\mcp-bundle.json",
  [int]$ChunkMB = 60,
  [int]$MaxFiles = 0
)

if (-not (Test-Path -Path $Dir -PathType Container)) {
  Write-Error "Directory not found: $Dir"
  exit 1
}

$extToMime = @{
  '.jpg' = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.png' = 'image/png'
  '.heic' = 'image/heic'
  '.heif' = 'image/heif'
  '.webp' = 'image/webp'
  '.gif' = 'image/gif'
  '.mov' = 'video/quicktime'
  '.mp4' = 'video/mp4'
}

function Write-Bundle([object[]]$Items, [string]$OutPath) {
  $payload = [PSCustomObject]@{
    version = 1
    generatedAt = [DateTimeOffset]::UtcNow.ToString('o')
    files = $Items
  }
  $payload | ConvertTo-Json -Depth 4 | Set-Content -Path $OutPath -Encoding UTF8
  Write-Host "Wrote bundle: $OutPath (files: $($Items.Count))"
}

function Estimate-ItemSize([string]$Name, [string]$B64) {
  return $B64.Length + ($Name.Length * 2) + 256
}

$maxBytes = if ($ChunkMB -gt 0) { $ChunkMB * 1024 * 1024 } else { 0 }
$files = Get-ChildItem -Path $Dir -File
$current = @()
$currentSize = 0
$bundleIndex = 0
$total = 0

foreach ($f in $files) {
  $ext = $f.Extension.ToLowerInvariant()
  $mime = $extToMime[$ext]
  if (-not $mime) { continue }
  if ($MaxFiles -gt 0 -and $total -ge $MaxFiles) { break }

  $bytes = [System.IO.File]::ReadAllBytes($f.FullName)
  $b64 = [System.Convert]::ToBase64String($bytes)
  $lastMs = [int64]([DateTimeOffset]$f.LastWriteTimeUtc).ToUnixTimeMilliseconds()

  $item = [PSCustomObject]@{
    name = $f.Name
    type = $mime
    lastModified = $lastMs
    data = $b64
  }

  $itemSize = Estimate-ItemSize -Name $f.Name -B64 $b64
  if ($maxBytes -gt 0 -and ($currentSize + $itemSize) -gt $maxBytes -and $current.Count -gt 0) {
    $bundleIndex++
    $outPath = if ($bundleIndex -eq 1) { $Out } else {
      $base = if ($Out.ToLowerInvariant().EndsWith('.json')) { $Out.Substring(0, $Out.Length - 5) } else { $Out }
      "$base-$bundleIndex.json"
    }
    Write-Bundle -Items $current -OutPath $outPath
    $current = @()
    $currentSize = 0
  }

  $current += $item
  $currentSize += $itemSize
  $total++
}

if ($current.Count -gt 0) {
  $bundleIndex++
  $outPath = if ($bundleIndex -eq 1) { $Out } else {
    $base = if ($Out.ToLowerInvariant().EndsWith('.json')) { $Out.Substring(0, $Out.Length - 5) } else { $Out }
    "$base-$bundleIndex.json"
  }
  Write-Bundle -Items $current -OutPath $outPath
}
