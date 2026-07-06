@echo off
REM register-chat-cron.cmd — arm the AI-chat cron: 4 runs/day via Windows Task Scheduler.
REM Run this ONCE. Spends real CELO afterward. Undo with unregister-chat-cron.cmd.

set PS=powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-chat-cron.ps1"

echo Registering GhostPay AI-chat cron (4x/day: 00:00 06:00 12:00 18:00)...

schtasks /create /f /tn "GhostPay\ChatCron-00" /tr "%PS%" /sc DAILY /st 00:00
schtasks /create /f /tn "GhostPay\ChatCron-06" /tr "%PS%" /sc DAILY /st 06:00
schtasks /create /f /tn "GhostPay\ChatCron-12" /tr "%PS%" /sc DAILY /st 12:00
schtasks /create /f /tn "GhostPay\ChatCron-18" /tr "%PS%" /sc DAILY /st 18:00

echo.
echo Done. Verify:  schtasks /query /tn "GhostPay\ChatCron-12"
echo Test one now:  schtasks /run /tn "GhostPay\ChatCron-12"
