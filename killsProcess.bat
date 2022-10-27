@echo off
title Fork Deploy flashloaner Arbitrageur Flashloaner script
set port=8007

::kills process runing on port %port%
FOR /F "tokens=5 delims= " %%P IN ('netstat -a -n -o ^| findstr :%port%') DO if %%P GTR 0 TaskKill.exe /F /PID %%P
pause
exit