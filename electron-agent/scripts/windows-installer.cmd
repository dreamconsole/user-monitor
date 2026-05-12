@echo off
setlocal EnableExtensions
if not "%~1"=="" (
  set "INSTALLER_MSI=%~f1"
) else (
  cd /d "%~dp0"
  set "INSTALLER_MSI="
  for %%F in ("User Monitor Agent*.msi") do set "INSTALLER_MSI=%%~fF"
)
if not defined INSTALLER_MSI (
  echo No MSI found. Either:
  echo   - Put this script in the same folder as "User Monitor Agent*.msi", or
  echo   - Drag-and-drop the MSI file onto this script.
  pause
  exit /b 1
)
echo Installing elevated: %INSTALLER_MSI%
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process msiexec.exe -Verb RunAs -Wait -ArgumentList @('/i', $env:INSTALLER_MSI); exit $LASTEXITCODE"
exit /b %ERRORLEVEL%
