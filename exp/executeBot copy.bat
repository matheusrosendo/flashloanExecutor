@echo off
title test script
::SET /A loop = 0
if "%~1"=="" (
    SET /A loop = 0
    echo one time execution script
) else (
    SET /A loop = %1
    ::if %loop% > 0 ( echo repeat script every %loop% seconds) ELSE ( echo one time execution script)
)

:start
echo do something...
timeout %loop%
if %loop% GTR 0 goto start
pause