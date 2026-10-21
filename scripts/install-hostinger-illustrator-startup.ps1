param([string]$NodePath = '')
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$settings = Join-Path $env:USERPROFILE '.ssh/alvorada-hostinger-worker.dpapi'
if (!(Test-Path -LiteralPath $settings)) { throw 'Configure primeiro a conexao protegida do ilustrador.' }
$nodeExecutable = if ($NodePath) { (Resolve-Path -LiteralPath $NodePath).Path } else { (Get-Command node -CommandType Application).Source }
$shellExecutable = (Get-Process -Id $PID).Path
$supervisor = Join-Path $PSScriptRoot 'keep-hostinger-illustrator.ps1'
$arguments = '-NoProfile -WindowStyle Hidden -File "' + $supervisor + '" -NodePath "' + $nodeExecutable + '"'
# A console executable as the task action can flash a window before PowerShell
# processes -WindowStyle. WScript is windowless and starts the console hidden.
$launcher = Join-Path $projectRoot '.local/hostinger-illustrator-hidden.vbs'
New-Item -ItemType Directory -Path (Split-Path -Parent $launcher) -Force | Out-Null
$command = '"' + $shellExecutable + '" -NonInteractive ' + $arguments
$escapedCommand = $command.Replace('"', '""')
$escapedRoot = $projectRoot.Replace('"', '""')
$launcherSource = @"
Option Explicit
Dim shell, result
Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = "$escapedRoot"
result = shell.Run("$escapedCommand", 0, True)
WScript.Quit result
"@
# UTF-16 keeps project paths with accented/non-ASCII names intact in WSH.
[IO.File]::WriteAllText($launcher, $launcherSource, [Text.Encoding]::Unicode)
$windowlessHost = Join-Path $env:SystemRoot 'System32/wscript.exe'
if (!(Test-Path -LiteralPath $windowlessHost)) { throw 'Windows Script Host indisponivel; tarefa anterior preservada.' }
$action = New-ScheduledTaskAction -Execute $windowlessHost -Argument ('//B //NoLogo "' + $launcher + '"') -WorkingDirectory $projectRoot
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
