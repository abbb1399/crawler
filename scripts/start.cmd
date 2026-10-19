@echo off
rem Starts infra + API + web in production mode. Used by the logon task (install-autostart.ps1),
rem but also fine to run by hand. Logs go to storage\logs\.
setlocal
cd /d "%~dp0.."
if not exist storage\logs mkdir storage\logs

rem Docker Desktop may still be starting right after logon.
set /a tries=0
:waitdocker
docker info >nul 2>&1
if %errorlevel%==0 goto dockerok
set /a tries+=1
if %tries% geq 60 (
  echo [%date% %time%] docker not ready after 5 minutes, giving up >> storage\logs\start.log
  exit /b 1
)
timeout /t 5 /nobreak >nul
goto waitdocker

:dockerok
echo [%date% %time%] starting >> storage\logs\start.log
call docker compose up -d >> storage\logs\start.log 2>&1
call pnpm --filter api db:deploy >> storage\logs\start.log 2>&1

rem Hidden console windows: a visible (even minimized) window can be closed by hand, and closing
rem it sends CTRL_CLOSE to node, which kills the API. Use stop.cmd to stop these.
powershell -NoProfile -Command "Start-Process -WindowStyle Hidden -FilePath cmd.exe -ArgumentList '/c pnpm --filter api start >> storage\logs\api.log 2>&1'"
powershell -NoProfile -Command "Start-Process -WindowStyle Hidden -FilePath cmd.exe -ArgumentList '/c pnpm --filter web start >> storage\logs\web.log 2>&1'"
echo [%date% %time%] api+web launched >> storage\logs\start.log
endlocal
