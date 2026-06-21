param(
  [string]$InstanceId,
  [string]$Bucket,
  [string]$Region = "us-east-1",
  [string]$ApiUrl,
  [switch]$UseDomain
)

$ErrorActionPreference = "Stop"

if (-not $InstanceId) {
  $InstanceId = (terraform -chdir=infra/staging-lite output -raw staging_instance_id).Trim()
}

if (-not $Bucket) {
  $Bucket = (terraform -chdir=infra/staging-lite output -raw deploy_artifacts_bucket_name).Trim()
}

if (-not $ApiUrl) {
  $ApiUrl = (terraform -chdir=infra/staging-lite output -raw staging_api_url).Trim()
}

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$artifactDir = Join-Path $root ".deploy"
$stamp = Get-Date -Format "yyyyMMddHHmmss"
$artifactName = "rapiv-$stamp.tgz"
$artifactPath = Join-Path $artifactDir $artifactName
$s3Key = "staging/$artifactName"
$aws = "C:\Program Files\Amazon\AWSCLIV2\aws.exe"

if (-not (Test-Path $artifactDir)) {
  New-Item -ItemType Directory -Path $artifactDir | Out-Null
}

Push-Location $root
try {
  git ls-files --cached --others --exclude-standard |
    Where-Object { $_ -notlike ".deploy/*" } |
    tar -czf $artifactPath -T -

  & $aws s3 cp $artifactPath "s3://$Bucket/$s3Key" --region $Region
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to upload deploy artifact to S3"
  }

  $artifactUrl = & $aws s3 presign "s3://$Bucket/$s3Key" --expires-in 3600 --region $Region
  if ($LASTEXITCODE -ne 0 -or -not $artifactUrl) {
    throw "Failed to create presigned deploy artifact URL"
  }

  $composeFiles = "-f docker-compose.staging.yml"
  $upCommands = @("sudo docker compose $composeFiles up -d backend caddy")

  if (-not $UseDomain) {
    $composeFiles = "-f docker-compose.staging.yml -f docker-compose.staging-ip.yml"
    $upCommands = @(
      "sudo docker compose $composeFiles stop caddy || true",
      "sudo docker compose $composeFiles rm -f caddy || true",
      "sudo docker compose $composeFiles up -d backend"
    )
  }

  $remoteScript = @(
    "set -eu",
    "APP_DIR=/opt/rapiv",
    "RELEASE=/tmp/rapiv-release-$stamp",
    "ARTIFACT=/tmp/$artifactName",
    "sudo mkdir -p `$RELEASE",
    "curl -fL '$artifactUrl' -o `$ARTIFACT",
    "sudo tar -xzf `$ARTIFACT -C `$RELEASE",
    "if [ -f `$APP_DIR/deploy/staging.env ]; then sudo mkdir -p `$RELEASE/deploy; sudo cp `$APP_DIR/deploy/staging.env `$RELEASE/deploy/staging.env; fi",
    "sudo rsync -a --delete --exclude deploy/staging.env `$RELEASE/ `$APP_DIR/",
    "cd `$APP_DIR",
    "sudo docker compose $composeFiles build backend",
    "sudo docker compose $composeFiles --profile tools run --rm migrate"
  ) + $upCommands + @(
    "for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30; do if sudo docker exec rapiv_staging_backend wget -qO- http://127.0.0.1:3000/api/health; then exit 0; fi; sleep 2; done",
    "sudo docker compose $composeFiles logs --tail=120 backend",
    "exit 1"
  )

  $parameterPath = Join-Path $artifactDir "ssm-params-$stamp.json"
  $parameterJson = @{ commands = $remoteScript } | ConvertTo-Json -Depth 3 -Compress
  [System.IO.File]::WriteAllText(
    $parameterPath,
    $parameterJson,
    [System.Text.UTF8Encoding]::new($false)
  )
  $comment = "RapiV staging deploy $stamp"

  $commandId = & $aws ssm send-command `
    --region $Region `
    --instance-ids $InstanceId `
    --document-name "AWS-RunShellScript" `
    --comment $comment `
    --parameters "file://$parameterPath" `
    --query "Command.CommandId" `
    --output text

  if ($LASTEXITCODE -ne 0 -or -not $commandId) {
    throw "Failed to start SSM deploy command"
  }

  Write-Host "SSM command: $commandId"

  for ($i = 0; $i -lt 90; $i++) {
    $status = & $aws ssm get-command-invocation `
      --region $Region `
      --command-id $commandId `
      --instance-id $InstanceId `
      --query "Status" `
      --output text

    if ($status -ne "InProgress" -and $status -ne "Pending" -and $status -ne "Delayed") {
      break
    }

    Start-Sleep -Seconds 10
  }

  $status = & $aws ssm get-command-invocation `
    --region $Region `
    --command-id $commandId `
    --instance-id $InstanceId `
    --query "Status" `
    --output text

  & $aws ssm get-command-invocation `
    --region $Region `
    --command-id $commandId `
    --instance-id $InstanceId `
    --query "StandardOutputContent" `
    --output text

  if ($status -ne "Success") {
    & $aws ssm get-command-invocation `
      --region $Region `
      --command-id $commandId `
      --instance-id $InstanceId `
      --query "StandardErrorContent" `
      --output text
    throw "Deploy failed with SSM status $status"
  }

  Write-Host "Deploy succeeded: $ApiUrl/health"
}
finally {
  Pop-Location
}
