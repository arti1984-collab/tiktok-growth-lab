@echo off
setlocal
set "TARGET=%~1"
set "SOURCE=%~2"
set "RELAUNCH=%~3"
set "LOG=%~dpn0.log"
set /a TRIES=0
:wait
set /a TRIES+=1
if %TRIES% gtr 180 goto end
rem ping statt timeout: timeout verweigert umgeleitete Eingabe, und ohne Pause
rem waere die Schleife in einer Sekunde durch, bevor die App beendet ist.
%SystemRoot%\System32\ping.exe -n 2 127.0.0.1 >nul
copy /y "%SOURCE%" "%TARGET%" >>"%LOG%" 2>&1
if errorlevel 1 goto wait
if /i "%RELAUNCH%"=="1" start "" "%TARGET%"
del "%SOURCE%" >>"%LOG%" 2>&1
:end
del "%~f0" >nul 2>&1 & exit /b 0
