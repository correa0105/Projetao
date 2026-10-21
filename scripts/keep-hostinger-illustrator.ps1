param(
  [string]$SettingsFile = (Join-Path $env:USERPROFILE '.ssh/alvorada-hostinger-worker.dpapi'),
  [string]$NodePath = '',
  [ValidateRange(10, 300)][int]$RetrySeconds = 20
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$stateDirectory = Join-Path $projectRoot '.local'
New-Item -ItemType Directory -Path $stateDirectory -Force | Out-Null
try {
  $guard = [System.IO.File]::Open((Join-Path $stateDirectory 'hostinger-illustrator-supervisor.lock'), 'OpenOrCreate', 'ReadWrite', 'None')
} catch [System.IO.IOException] {
  Write-Output 'O supervisor do ilustrador da VPS ja esta ativo.'
  exit 0
}

try {
  $secureSettings = ConvertTo-SecureString ([System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $SettingsFile)))
  try {
    $settingsText = [System.Net.NetworkCredential]::new('', $secureSettings).Password
    $settings = $settingsText | ConvertFrom-Json
  } finally {
    $settingsText = $null
    $secureSettings.Dispose()
  }
  if ($settings.LocalDatabasePort -ne 5437 -or $settings.RemoteDatabasePort -ne 5436) {
    throw 'Configuracao de portas inesperada.'
  }
  $env:DATABASE_URL = $settings.DatabaseUrl
  $env:BETTER_AUTH_URL = $settings.SiteOrigin
  $env:APP_ORIGIN = $settings.SiteOrigin
  $env:APP_SHARE_ORIGIN = $settings.SiteOrigin
  $nodeExecutable = if ($NodePath) { (Resolve-Path -LiteralPath $NodePath).Path } else { (Get-Command node -CommandType Application).Source }
  $sshExecutable = (Get-Command ssh -CommandType Application).Source
  $powerShellExecutable = (Get-Process -Id $PID).Path
  Set-Content -LiteralPath (Join-Path $stateDirectory 'hostinger-illustrator-supervisor.pid') -Value $PID
  $tunnel = $null
  $supervisor = $null
  # Recover the children after an outer supervisor restart; starting a second
  # tunnel would fail to bind its port while the surviving one is still healthy.
  $tunnelPidFile = Join-Path $stateDirectory 'hostinger-tunnel.pid'
  if (Test-Path -LiteralPath $tunnelPidFile) {
    $savedTunnelId = 0
    [int]::TryParse((Get-Content -LiteralPath $tunnelPidFile -Raw).Trim(), [ref]$savedTunnelId) | Out-Null
    if ($savedTunnelId -gt 0) {
      $candidate = Get-CimInstance Win32_Process -Filter "ProcessId = $savedTunnelId"
      if ($candidate -and $candidate.Name -eq 'ssh.exe' -and $candidate.CommandLine -match '127\.0\.0\.1:5437:127\.0\.0\.1:5436' -and $candidate.CommandLine.Contains('root@' + $settings.HostName)) {
        $tunnel = Get-Process -Id $savedTunnelId
      }
    }
  }
  $supervisorPidFile = Join-Path $stateDirectory 'hostinger-worker-supervisor.pid'
  if (Test-Path -LiteralPath $supervisorPidFile) {
    $savedSupervisorId = 0
    [int]::TryParse((Get-Content -LiteralPath $supervisorPidFile -Raw).Trim(), [ref]$savedSupervisorId) | Out-Null
    if ($savedSupervisorId -gt 0) {
      $candidate = Get-CimInstance Win32_Process -Filter "ProcessId = $savedSupervisorId"
      if ($candidate -and $candidate.Name -match '^(pwsh|powershell)\.exe$' -and $candidate.CommandLine -match 'keep-illustrator\.ps1') {
        $supervisor = Get-Process -Id $savedSupervisorId
      }
    }
  }
  $missingTunnelChecks = 0
  while ($true) {
    if ($tunnel) { $tunnel.Refresh() }
    if ($tunnel -and !$tunnel.HasExited) {
      $hasTunnelListener = [bool]([System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners() | Where-Object { $_.Port -eq 5437 })
      if ($hasTunnelListener) { $missingTunnelChecks = 0 } else { $missingTunnelChecks++ }
      if ($missingTunnelChecks -ge 2) {
        $stalledTunnel = Get-CimInstance Win32_Process -Filter "ProcessId = $($tunnel.Id)"
        if ($stalledTunnel -and $stalledTunnel.Name -eq 'ssh.exe' -and $stalledTunnel.CommandLine -match '127\.0\.0\.1:5437:127\.0\.0\.1:5436' -and $stalledTunnel.CommandLine.Contains('root@' + $settings.HostName)) {
          Stop-Process -Id $tunnel.Id
          $tunnel = $null
          Write-Output 'Tunel sem porta local; reconectando o ilustrador.'
        }
        $missingTunnelChecks = 0
      }
    }
    if (!$tunnel -or $tunnel.HasExited) {
      $arguments = @(
        '-N', '-L', '127.0.0.1:5437:127.0.0.1:5436',
        '-o', 'ExitOnForwardFailure=yes', '-o', 'BatchMode=yes',
        '-o', 'ConnectTimeout=15', '-o', 'ConnectionAttempts=1',
        '-o', 'ServerAliveInterval=20', '-o', 'ServerAliveCountMax=3',
        '-o', 'KexAlgorithms=curve25519-sha256', '-o', 'HostKeyAlgorithms=ssh-ed25519',
        '-o', ('"UserKnownHostsFile=' + $settings.KnownHostsFile + '"'),
        '-o', 'StrictHostKeyChecking=yes', '-i', ('"' + $settings.SshKeyFile + '"'),
        ('root@' + $settings.HostName)
      )
      $tunnel = Start-Process -FilePath $sshExecutable -ArgumentList $arguments -WindowStyle Hidden -RedirectStandardOutput (Join-Path $stateDirectory 'hostinger-tunnel.out.log') -RedirectStandardError (Join-Path $stateDirectory 'hostinger-tunnel.err.log') -PassThru
      $missingTunnelChecks = 0
      Set-Content -LiteralPath (Join-Path $stateDirectory 'hostinger-tunnel.pid') -Value $tunnel.Id
      Start-Sleep -Seconds 1
      $tunnel.Refresh()
      if ($tunnel.HasExited) {
        Write-Output 'Tunel SSH indisponivel; nova tentativa em breve.'
        Start-Sleep -Seconds $RetrySeconds
        continue
      }
    }
    if ($supervisor) { $supervisor.Refresh() }
    if (!$supervisor -or $supervisor.HasExited) {
      $workerSupervisor = Join-Path $PSScriptRoot 'keep-illustrator.ps1'
      $supervisor = Start-Process -FilePath $powerShellExecutable -ArgumentList @('-NoProfile', '-File', ('"' + $workerSupervisor + '"'), '-NodePath', ('"' + $nodeExecutable + '"')) -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $stateDirectory 'hostinger-worker-supervisor.out.log') -RedirectStandardError (Join-Path $stateDirectory 'hostinger-worker-supervisor.err.log') -PassThru
      Set-Content -LiteralPath (Join-Path $stateDirectory 'hostinger-worker-supervisor.pid') -Value $supervisor.Id
      Write-Output 'Supervisor do ilustrador conectado a VPS por SSH.'
    }
    Start-Sleep -Seconds $RetrySeconds
  }
} finally {
  $guard.Dispose()
}
