# Registers a Task Scheduler task that runs scripts\start.cmd at logon of the current user.
# Run from any directory:  powershell -ExecutionPolicy Bypass -File scripts\install-autostart.ps1
# Remove with:             scripts\uninstall-autostart.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$taskName = 'devilray'
$startCmd = Join-Path $root 'scripts\start.cmd'

if (-not (Test-Path $startCmd)) { throw "not found: $startCmd" }
if (-not (Test-Path (Join-Path $root 'apps\api\dist\main.js'))) {
  Write-Warning "apps\api\dist not built yet. Run 'pnpm build' first or the task will fail at logon."
}

$action   = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c `"$startCmd`"" -WorkingDirectory $root
$trigger  = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$trigger.Delay = 'PT30S'   # give Docker Desktop a head start
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -MultipleInstances IgnoreNew -StartWhenAvailable -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
Write-Host "registered task '$taskName' (at logon, +30s) -> $startCmd"
Write-Host "run now:   Start-ScheduledTask -TaskName $taskName"
Write-Host "status:    Get-ScheduledTask -TaskName $taskName | Get-ScheduledTaskInfo"
