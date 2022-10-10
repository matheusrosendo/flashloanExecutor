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

::se initial block  15632879, 15631145, 15631117, 15630809 ->(-5) 15628757
SET /A block = 15630809

:start
echo ethereum_fork_update: Fork networ, Deploy flashloaner SC, call arbitrageur, execute flashloaner script

::kills process runing on port 8002
FOR /F "tokens=5 delims= " %%P IN ('netstat -a -n -o ^| findstr :8002') DO if %%P GTR 0 TaskKill.exe /F /PID %%P

:: delete last blockchain database fork
@RD /S /Q "E:\Dev\Estudos\BlockchainDev\FlashLoans\flashloaner\database\ethereum-fork-update"

::creates fork
start /B ganache-cli --fork https://eth-mainnet.g.alchemy.com/v2/5Mb-roNFwu4Y1uwSjykSuHoC8BYYLABy@15629430 --unlock 0x28C6c06298d514Db089934071355E5743bf21d60 -i 10 -p 8002 --db database/ethereum-fork-update -m `"please loud skin soccer slender invest thank brick blue shallow day ivory`"
timeout 8

:: execute arbitrageur bot
::cd E:\Dev\Estudos\BlockchainDev\FlashLoans\botArbitrage 
::node .\Main.js 1 3 4 0

:: verify if any new file exists in input folder
cd E:\Dev\Estudos\BlockchainDev\FlashLoans\flashloaner\ethereum_fork_update\FlashloanInput
for /f %%A in ('dir /a-d-s-h /b ^| find /v /c ""') do set cnt=%%A
:: get back to main folder
cd E:\Dev\Estudos\BlockchainDev\FlashLoans\flashloaner\

if %cnt% GTR 0 (    

    ::execute deploy
    truffle migrate --reset --network ethereum_fork_update 
            
    cd E:\Dev\Estudos\BlockchainDev\FlashLoans\flashloaner
    :: put some funds on wallet
    node .\Flashloaner.js 1 ethereum_fork_update 
    :: put check smart contract balance
    node .\Flashloaner.js 3 ethereum_fork_update 
    :: execute flashloan
    node .\Flashloaner.js 8 ethereum_fork_update ethereum_fork_update\FlashloanInput 
    :: withdraw profit
    ::node .\Flashloaner.js 5 ethereum_fork_update
    :: put check smart contract balance
    node .\Flashloaner.js 3 ethereum_fork_update
    :: put check account balance
    :: node .\Flashloaner.js 4 ethereum_fork_update
)
SET /A block = block - 1  

pause