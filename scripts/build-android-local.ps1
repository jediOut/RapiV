param(
  [string]$App = "cliente-frontend",
  [string]$Profile = "google-play-test",
  [string]$Image = "rapiv-android-build:local",
  [switch]$RebuildImage,
  [switch]$NonInteractive
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$dockerfile = Join-Path $repoRoot "docker\android-build.Dockerfile"
$appPath = Join-Path $repoRoot $App
$easJson = Join-Path $appPath "eas.json"
$packageLock = Join-Path $appPath "package-lock.json"
$appEnvFile = Join-Path $appPath ".env"
$artifactsDir = Join-Path $repoRoot "artifacts\android\$App"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outputName = "$App-$Profile-$timestamp.aab"
$containerOutput = "/workspace/artifacts/android/$App/$outputName"
$hostExpoDir = Join-Path $env:USERPROFILE ".expo"

if (-not (Test-Path $dockerfile)) {
  throw "No existe el Dockerfile: $dockerfile"
}

if (-not (Test-Path $appPath)) {
  throw "No existe la app: $appPath"
}

if (-not (Test-Path $easJson)) {
  throw "La app no tiene eas.json: $easJson"
}

if (-not (Test-Path $packageLock)) {
  throw "La app no tiene package-lock.json. Este flujo usa npm ci para builds reproducibles."
}

New-Item -ItemType Directory -Force -Path $artifactsDir | Out-Null

docker version | Out-Null

$imageExists = $false
$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
docker image inspect $Image *> $null
$inspectExitCode = $LASTEXITCODE
$ErrorActionPreference = $previousErrorActionPreference
if ($inspectExitCode -eq 0) {
  $imageExists = $true
}

if ($RebuildImage -or -not $imageExists) {
  docker build `
    --file $dockerfile `
    --tag $Image `
    $repoRoot

  if ($LASTEXITCODE -ne 0) {
    throw "No se pudo construir la imagen Docker $Image"
  }
}

$appVolumeName = "rapiv_$($App -replace '[^a-zA-Z0-9_.-]', '_')_node_modules"
$dockerArgs = @(
  "run",
  "--rm",
  "-t",
  "--workdir", "/workspace/$App",
  "--volume", "$($repoRoot):/workspace",
  "--volume", "$($appVolumeName):/workspace/$App/node_modules",
  "--volume", "rapiv_android_npm_cache:/root/.npm",
  "--volume", "rapiv_android_gradle_cache:/root/.gradle",
  "--volume", "rapiv_android_ndk:/opt/android-sdk/ndk",
  "--volume", "rapiv_android_cmake:/opt/android-sdk/cmake",
  "--env", "NODE_ENV=production",
  "--env", "EAS_LOCAL_BUILD_WORKINGDIR=/tmp/eas-local-build",
  "--env", "EAS_LOCAL_BUILD_ARTIFACTS_DIR=/workspace/artifacts/android/$App"
)

if (Test-Path $hostExpoDir) {
  $dockerArgs += @("--volume", "$($hostExpoDir):/root/.expo")
}

if ($env:EXPO_TOKEN) {
  $dockerArgs += @("--env", "EXPO_TOKEN=$($env:EXPO_TOKEN)")
}

$appEnv = @{}
if (Test-Path $appEnvFile) {
  foreach ($line in Get-Content $appEnvFile) {
    if ($line -match "^\s*#" -or $line -notmatch "=") {
      continue
    }

    $key, $value = $line -split "=", 2
    $key = $key.Trim()
    $value = $value.Trim().Trim('"').Trim("'")

    if ($key) {
      $appEnv[$key] = $value
    }
  }
}

foreach ($requiredLocalEnv in @("GOOGLE_MAPS_ANDROID_API_KEY")) {
  $hostEnvValue = [Environment]::GetEnvironmentVariable($requiredLocalEnv)
  if ($hostEnvValue) {
    $dockerArgs += @("--env", "$requiredLocalEnv=$hostEnvValue")
  } elseif ($appEnv.ContainsKey($requiredLocalEnv) -and $appEnv[$requiredLocalEnv]) {
    $dockerArgs += @("--env", "$requiredLocalEnv=$($appEnv[$requiredLocalEnv])")
  }
}

if ($env:CI) {
  $NonInteractive = $true
}

$easFlags = @(
  "build",
  "--platform", "android",
  "--profile", $Profile,
  "--local",
  "--output", $containerOutput
)

if ($NonInteractive) {
  $easFlags += "--non-interactive"
}

function ConvertTo-BashSingleQuoted([string]$Value) {
  return "'" + ($Value -replace "'", "'\''") + "'"
}

$quotedEasFlags = ($easFlags | ForEach-Object { ConvertTo-BashSingleQuoted $_ }) -join " "
$containerCommand = "set -euo pipefail; echo App: $(ConvertTo-BashSingleQuoted $App); echo Profile: $(ConvertTo-BashSingleQuoted $Profile); echo Output: $(ConvertTo-BashSingleQuoted $containerOutput); npm ci --prefer-offline; npx eas-cli $quotedEasFlags"

$dockerArgs += @($Image, "bash", "-lc", $containerCommand)

docker @dockerArgs

if ($LASTEXITCODE -ne 0) {
  throw "El build Android local fallo dentro del contenedor"
}

$hostOutput = Join-Path $artifactsDir $outputName
if (-not (Test-Path $hostOutput)) {
  throw "El build termino, pero no encontre el artefacto esperado: $hostOutput"
}

Write-Host ""
Write-Host "Build Android local listo:"
Write-Host $hostOutput
