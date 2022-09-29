@echo off
title Fork Deploy flashloaner Arbitrageur Flashloaner script
if "%~1"=="" (
    SET /A loop = 0
    echo one time execution script
) else (
    SET /A loop = %1
    echo repeat script every %1 seconds
)
:start
echo making fork and after, making deploy by truffle
::kills process runing on port 8002
FOR /F "tokens=5 delims= " %%P IN ('netstat -a -n -o ^| findstr :8002') DO if %%P GTR 0 TaskKill.exe /F /PID %%P
start npm run ethereum_fork_update 
start /B truffle migrate --reset --network ethereum_fork_update 
timeout 25
cd E:\Dev\Estudos\BlockchainDev\FlashLoans\botArbitrage 
node .\Main.js 1 3 4 0

cd E:\Dev\Estudos\BlockchainDev\FlashLoans\flashloaner
node .\CallExp.js 1 "E:\Dev\Estudos\BlockchainDev\FlashLoans\botArbitrage\Ethereum_files\FlashloanInput\flashpath_2022-28-09_19-52.json"
node .\CallExp.js 3 "E:\Dev\Estudos\BlockchainDev\FlashLoans\botArbitrage\Ethereum_files\FlashloanInput\flashpath_2022-28-09_19-52.json"

timeout %loop%
if %loop% GTR 0 goto start
pause