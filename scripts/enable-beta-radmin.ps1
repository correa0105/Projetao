param([string]$RadminIp)
$ErrorActionPreference = 'Stop'
$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) { throw 'Execute este script como Administrador para liberar o firewall do beta.' }
if (-not $RadminIp) { $RadminIp = Get-NetIPAddress -InterfaceAlias 'Radmin VPN' -AddressFamily IPv4 | Where-Object {$_.IPAddress -like '26.*'} | Select-Object -First 1 -ExpandProperty IPAddress }
if (-not $RadminIp -or $RadminIp -notmatch '^26\.\d{1,3}\.\d{1,3}\.\d{1,3}$') { throw 'Ative o Radmin VPN primeiro.' }
$rule = 'Alvorada-Beta-Radmin-3000'
if (Get-NetFirewallRule -Name $rule -ErrorAction SilentlyContinue) { Remove-NetFirewallRule -Name $rule }
New-NetFirewallRule -Name $rule -DisplayName 'Alvorada Beta - Radmin TCP 3000' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000 -LocalAddress $RadminIp -RemoteAddress '26.0.0.0/8' -InterfaceAlias 'Radmin VPN' -Profile Any | Out-Null
Write-Host "Beta liberado na rede Radmin: http://${RadminIp}:3000"
