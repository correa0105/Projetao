param([string]$NodePath = '')
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$settings = Join-Path $env:USERPROFILE '.ssh/alvorada-hostinger-worker.dpapi'
if (!(Test-Path -LiteralPath $settings)) { throw 'Configure primeiro a conexao protegida do ilustrador.' }
$nodeExecutable = if ($NodePath) { (Resolve-Path -LiteralPath $NodePath).Path } else { (Get-Command node -CommandType Application).Source }
$shellExecutable = (Get-Process -Id $PID).Path
$supervisor = Join-Path $PSScriptRoot 'keep-hostinger-illustrator.ps1'
$arguments = '-NoProfile -WindowStyle Hidden -File "' + $supervisor + '" -NodePath "' + $nodeExecutable + '"'
$action = New-ScheduledTaskAction -Execute $shellExecutable -Argument $arguments -WorkingDirectory $projectRoot
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$triggers = @(
  (New-ScheduledTaskTrigger -AtLogOn -User $identity),
  (New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1))
)
$options = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1)
$principal = New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName 'Alvorada-Hostinger-Ilustrador' -Action $action -Trigger $triggers -Settings $options -Principal $principal -Description 'Mantem o ilustrador e seu tunel SSH ativos; recupera encerramentos e inicia ao entrar no Windows. Credenciais protegidas por DPAPI.' -Force | Out-Null
Start-ScheduledTask -TaskName 'Alvorada-Hostinger-Ilustrador'
Write-Output 'Inicializacao e recuperacao automatica do ilustrador configuradas.'
