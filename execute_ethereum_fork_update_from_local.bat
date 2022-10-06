@echo off
title Fork Deploy flashloaner Arbitrageur Flashloaner script

:: sets to 1 minute loop if none parater passed
if "%~1"=="" (
    SET /A loop = 60
    echo one time execution script
) else (
    SET /A loop = %1
    echo repeat script every %1 seconds
)
:start
echo ethereum_fork_update: Fork networ, Deploy flashloaner SC, call arbitrageur, execute flashloaner script

::kills process runing on port 8002
FOR /F "tokens=5 delims= " %%P IN ('netstat -a -n -o ^| findstr :8002') DO if %%P GTR 0 TaskKill.exe /F /PID %%P

:: delete last blockchain database fork
@RD /S /Q "E:\Dev\Estudos\BlockchainDev\FlashLoans\flashloaner\database\ethereum-fork-update"

::creates fork
start /B npm run ethereum_fork_update 
timeout 10

:: execute arbitrageur bot
cd E:\Dev\Estudos\BlockchainDev\FlashLoans\botArbitrage 
node .\Main.js 1 3 4 0

:: verify if any new file exists in input folder
cd E:\Dev\Estudos\BlockchainDev\FlashLoans\flashloaner\ethereum_fork_update\FlashloanInput
for /f %%A in ('dir /a-d-s-h /b ^| find /v /c ""') do set cnt=%%A
:: get back to main folder
cd E:\Dev\Estudos\BlockchainDev\FlashLoans\flashloaner\

if %cnt% GTR 0 (    

    ::execute deploy
    start /B truffle migrate --reset --network ethereum_fork_update 
    timeout 30
        
    cd E:\Dev\Estudos\BlockchainDev\FlashLoans\flashloaner
    :: put some funds on wallet
    node .\Flashloaner.js 1 ethereum_fork_update 
    :: put check smart contract balance
    node .\Flashloaner.js 3 ethereum_fork_update 
    :: execute flashloan
    node .\Flashloaner.js 8 ethereum_fork_update ethereum_fork_update\FlashloanInput 
    :: withdraw profit
    node .\Flashloaner.js 5 ethereum_fork_update
    :: put check smart contract balance
    node .\Flashloaner.js 3 ethereum_fork_update
    :: put check account balance
    node .\Flashloaner.js 4 ethereum_fork_update
)
timeout %loop%
if %loop% GTR 0 goto start
exit