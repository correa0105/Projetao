$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$pidFile = Join-Path $projectRoot '.local/localhost-services.json'
if (Test-Path -LiteralPath $pidFile) {
  $saved = Get-Content -LiteralPath $pidFile -Raw | ConvertFrom-Json
  foreach ($name in @('backend','frontend')) {
    $serviceId = $saved.$name
    if (!$serviceId) { continue }
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $serviceId"
    if ($process -and $process.Name -eq 'node.exe' -and $process.CommandLine.Contains($projectRoot)) {
      & taskkill /PID $serviceId /T /F | Out-Null
    }
  }
}
Write-Output 'Frontend e backend locais parados. O banco, os volumes e os backups continuam preservados.'
