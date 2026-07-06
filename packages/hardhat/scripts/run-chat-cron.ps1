# run-chat-cron.ps1 — one cron cycle of on-chain AI-chat txs (fresh wallets).
# Called by Windows Task Scheduler 4x/day. Logs to logs\chat-cron-YYYYMMDD.log.
# Requires PRIVATE_KEY (main funding wallet) in packages\hardhat\.env
#
# Manual test with a single wallet:
#   $env:WALLETS_MIN=1; $env:WALLETS_MAX=1; powershell -File scripts\run-chat-cron.ps1

$ErrorActionPreference = "Continue"
$hardhatDir = Split-Path -Parent $PSScriptRoot   # ...\packages\hardhat
Set-Location $hardhatDir

$logDir = Join-Path $hardhatDir "logs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
$stamp = Get-Date -Format "yyyyMMdd"
$log = Join-Path $logDir "chat-cron-$stamp.log"

$start = Get-Date
Add-Content $log "`n===== cycle start $($start.ToString('yyyy-MM-dd HH:mm:ss')) ====="

# Run the cycle; tee output to the daily log.
& npx hardhat run scripts/chat-cron.ts --network celo *>&1 | Tee-Object -FilePath $log -Append
$code = $LASTEXITCODE

$end = Get-Date
Add-Content $log "===== cycle end   $($end.ToString('yyyy-MM-dd HH:mm:ss')) (exit $code) ====="
exit $code
