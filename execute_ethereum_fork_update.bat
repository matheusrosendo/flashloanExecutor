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
start /B npm run ethereum_fork_update 
start /B truffle migrate --reset --network ethereum_fork_update 
timeout 30
:: execute arbitrageur bot
cd E:\Dev\Estudos\BlockchainDev\FlashLoans\botArbitrage 
node .\Main.js 1 3 4 0

cd E:\Dev\Estudos\BlockchainDev\FlashLoans\flashloaner
:: put some funds on wallet
::node .\Flashloaner.js 1 ethereum_fork_update 
:: put check smart contract balance
::node .\Flashloaner.js 3 ethereum_fork_update 
:: execute flashloan
node .\Flashloaner.js 8 ethereum_fork_update\FlashloanInput 
:: withdraw profit
node .\Flashloaner.js 5 ethereum_fork_update
:: put check smart contract balance
node .\Flashloaner.js 3 ethereum_fork_update
:: put check account balance
node .\Flashloaner.js 4 ethereum_fork_update

timeout %loop%
if %loop% GTR 0 goto start
exit