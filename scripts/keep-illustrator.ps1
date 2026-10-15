param(
  [int]$ExistingWorkerId = 0,
  [string]$NodePath = '',
  [ValidateRange(10, 300)][int]$RetrySeconds = 20
)

$ErrorActionPreference = 'Stop'
$illustratorRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$stateDir = Join-Path $illustratorRoot '.local'
New-Item -ItemType Directory -Path $stateDir -Force | Out-Null
# The open handle prevents two supervisors from restarting the same service.
try {
  $guard = [System.IO.File]::Open((Join-Path $stateDir 'illustrator-supervisor.lock'), 'OpenOrCreate', 'ReadWrite', 'None')
} catch [System.IO.IOException] {
  Write-Output 'O supervisor do ilustrador ja esta ativo.'
  exit 0
}

try {
  Set-Content -LiteralPath (Join-Path $stateDir 'illustrator-supervisor.pid') -Value $PID
  $nodeExe = if ($NodePath) { (Resolve-Path -LiteralPath $NodePath).Path } else { (Get-Command node -CommandType Application).Source }
  $workerScript = Join-Path $illustratorRoot 'scripts/character-art-worker.ts'
  $workerPidFile = Join-Path $stateDir 'illustrator-supervisor-worker.pid'
  $workerId = $ExistingWorkerId
  if (!$workerId -and (Test-Path -LiteralPath $workerPidFile)) {
    [int]::TryParse((Get-Content -LiteralPath $workerPidFile -Raw).Trim(), [ref]$workerId) | Out-Null
  }
  while ($true) {
    $worker = if ($workerId -gt 0) { Get-CimInstance Win32_Process -Filter "ProcessId = $workerId" } else { $null }
    $ours = $worker -and $worker.Name -eq 'node.exe' -and $worker.CommandLine -match 'scripts[\\/]character-art-worker\.ts'
    if (!$ours) {
      try {
        # Resolve the current installation each time, including after a Codex update.
        if (!$env:CODEX_BIN -or !(Test-Path -LiteralPath $env:CODEX_BIN)) {
          $codexCommand = Get-Command codex -CommandType Application -ErrorAction SilentlyContinue
          if ($codexCommand) { $env:CODEX_BIN = $codexCommand.Source }
          else {
            $installed = Get-ChildItem -LiteralPath (Join-Path $env:LOCALAPPDATA 'OpenAI/Codex/bin') -Directory | ForEach-Object { Get-Item -LiteralPath (Join-Path $_.FullName 'codex.exe') -ErrorAction SilentlyContinue } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
            if (!$installed) { throw 'Codex CLI indisponivel.' }
            $env:CODEX_BIN = $installed.FullName
          }
        }
        $stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
        $logPrefix = Join-Path $stateDir ('illustrator-supervised-' + $stamp)
        $worker = Start-Process -FilePath $nodeExe -ArgumentList @('--import', 'tsx', ('"' + $workerScript + '"')) -WorkingDirectory $illustratorRoot -WindowStyle Hidden -RedirectStandardOutput ($logPrefix + '.out.log') -RedirectStandardError ($logPrefix + '.err.log') -PassThru
        $workerId = $worker.Id
        Write-Output "$(Get-Date -Format o) Ilustrador iniciado: PID $workerId."
      } catch {
        $workerId = 0
        Write-Output "$(Get-Date -Format o) Ilustrador indisponivel; nova tentativa em $RetrySeconds segundos."
      }
    }
    if ($workerId -gt 0) { Set-Content -LiteralPath $workerPidFile -Value $workerId }
    Start-Sleep -Seconds $RetrySeconds
  }
} finally {
  $guard.Dispose()
}
