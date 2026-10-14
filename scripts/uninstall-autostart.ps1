$ErrorActionPreference = 'SilentlyContinue'
Unregister-ScheduledTask -TaskName 'devilray' -Confirm:$false
Write-Host "removed task 'devilray' (if it existed)"
