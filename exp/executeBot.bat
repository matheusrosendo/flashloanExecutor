@echo off
title test script
::SET /A loop = 0
if "%~1"=="" (
    SET /A loop = 0
    echo one time execution script
) else (
    SET /A loop = %1
    echo repeat script every %1 seconds
)

:start
echo do something...
timeout %loop%
if %loop% GTR 0 goto start
pause