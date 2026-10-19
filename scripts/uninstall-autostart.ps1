$ErrorActionPreference = 'SilentlyContinue'
Unregister-ScheduledTask -TaskName 'trawler' -Confirm:$false
Write-Host "removed task 'trawler' (if it existed)"
