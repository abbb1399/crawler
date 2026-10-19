@echo off
rem Stops the API and web started by start.cmd. Containers keep running.
rem Only processes LISTENING on exactly :3000 / :3001 are touched (findstr /C: keeps each
rem pattern intact; without it findstr splits on spaces and ".*LISTENING" would match everything).
setlocal
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /R /C:"TCP .*:3000 .*LISTENING" /C:"TCP .*:3001 .*LISTENING"') do (
  echo stopping pid %%p
  taskkill /F /T /PID %%p >nul 2>&1
)
echo stopped
endlocal
