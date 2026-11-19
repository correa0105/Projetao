param([switch]$NoOpen)
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$stateDirectory = Join-Path $projectRoot '.local'
$modeFile = Join-Path $stateDirectory 'localhost-mode.json'
if (!(Test-Path -LiteralPath $modeFile)) { throw 'O modo localhost ainda nao foi configurado. Nao altere o banco da VPS.' }
$mode = Get-Content -LiteralPath $modeFile -Raw | ConvertFrom-Json
$databaseLine = Get-Content -LiteralPath (Join-Path $projectRoot '.env') | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -Last 1
if (!$databaseLine) { throw 'DATABASE_URL ausente no .env.' }
$databaseUri = [Uri]($databaseLine.Substring(13).Trim('"', "'"))
if ($databaseUri.Host -notin @('localhost','127.0.0.1') -or $databaseUri.Port -ne 5436 -or $databaseUri.AbsolutePath.Trim('/') -ne $mode.database) {
  throw 'O .env nao aponta para o banco localhost esperado. Configuracao preservada.'
}
$nodeCommand = Get-Command node -CommandType Application -ErrorAction SilentlyContinue
$nodeExecutable = if ($nodeCommand) { $nodeCommand.Source } else { Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' }
if (!(Test-Path -LiteralPath $nodeExecutable)) { throw 'Node.js nao encontrado. Abra este projeto no Codex ou instale Node.js 24.' }
& docker info --format '{{.ServerVersion}}' *> $null
if ($LASTEXITCODE -ne 0) {
  $dockerExecutable = Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\Docker Desktop.exe'
  if (!(Test-Path -LiteralPath $dockerExecutable)) { throw 'Docker Desktop nao encontrado.' }
  Start-Process -FilePath $dockerExecutable -WindowStyle Hidden
  for ($attempt = 0; $attempt -lt 45; $attempt++) {
    Start-Sleep -Seconds 2
    & docker info --format '{{.ServerVersion}}' *> $null
    if ($LASTEXITCODE -eq 0) { break }
  }
  if ($LASTEXITCODE -ne 0) { throw 'O Docker ainda nao esta pronto. Aguarde e execute novamente.' }
}
# Start only existing data services; never restore or replace a database here.
& docker start alvorada-cinzenta-db | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel iniciar os servicos locais existentes.' }
& docker compose --project-directory $projectRoot -f (Join-Path $projectRoot 'compose.yaml') -f (Join-Path $projectRoot 'compose.localhost.yaml') up -d --no-deps translator
if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel iniciar o tradutor local.' }
& docker stop alvorada-cinzenta-app *> $null
$pidFile = Join-Path $stateDirectory 'localhost-services.json'
$saved = if (Test-Path -LiteralPath $pidFile) { Get-Content -LiteralPath $pidFile -Raw | ConvertFrom-Json } else { $null }
$services = @{}
foreach ($entry in @(
  @{name='backend'; port=3000; script=(Join-Path $projectRoot 'server/index.ts'); args=@('--watch','--watch-preserve-output','--import','tsx')},
  @{name='frontend'; port=5173; script=(Join-Path $projectRoot 'node_modules/vite/bin/vite.js'); args=@()}
)) {
  $previous = if ($saved) { $saved.($entry.name) } else { $null }
  $process = if ($previous) { Get-CimInstance Win32_Process -Filter "ProcessId = $previous" } else { $null }
  if ($process -and $process.Name -eq 'node.exe' -and $process.CommandLine.Contains($entry.script)) {
    $services[$entry.name] = $process.ProcessId
    continue
  }
  if (Get-NetTCPConnection -State Listen -LocalPort $entry.port -ErrorAction SilentlyContinue) {
    throw "A porta $($entry.port) esta em uso por outro processo. Nenhum processo desconhecido foi encerrado."
  }
  $arguments = @($entry.args) + @('"' + $entry.script + '"')
  if ($entry.name -eq 'frontend') { $arguments += @('--host','127.0.0.1') }
  $started = Start-Process -FilePath $nodeExecutable -ArgumentList $arguments -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $stateDirectory "localhost-$($entry.name).out.log") -RedirectStandardError (Join-Path $stateDirectory "localhost-$($entry.name).err.log") -PassThru
  $services[$entry.name] = $started.Id
  $services | ConvertTo-Json | Set-Content -LiteralPath $pidFile -Encoding utf8
}
$lastFailure = ''
for ($attempt = 0; $attempt -lt 20; $attempt++) {
  try {
    $health = Invoke-WebRequest -Uri 'http://localhost:5173/api/health' -UseBasicParsing -TimeoutSec 10
    $page = Invoke-WebRequest -Uri 'http://localhost:5173/' -UseBasicParsing -TimeoutSec 10
    if ($health.StatusCode -eq 200 -and $page.StatusCode -eq 200) {
      Write-Output 'Alvorada Cinzenta disponivel em http://localhost:5173. Alteracoes no codigo aparecem durante o desenvolvimento.'
      if (!$NoOpen) { Start-Process 'http://localhost:5173/' }
      exit 0
    }
  } catch { $lastFailure = $_.Exception.Message }
  Start-Sleep -Seconds 2
}
throw "A aplicacao ainda nao respondeu: $lastFailure. Consulte .local/localhost-backend.err.log e localhost-frontend.err.log."
