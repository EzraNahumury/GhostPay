@echo off
REM unregister-chat-cron.cmd — disarm the AI-chat cron (delete all 4 scheduled tasks).

schtasks /delete /f /tn "GhostPay\ChatCron-00"
schtasks /delete /f /tn "GhostPay\ChatCron-06"
schtasks /delete /f /tn "GhostPay\ChatCron-12"
schtasks /delete /f /tn "GhostPay\ChatCron-18"
echo Done. AI-chat cron disarmed.
