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
SET /A block = 15629429

:start
echo ethereum_fork_update: Fork networ, Deploy flashloaner SC, call arbitrageur, execute flashloaner script

::kills process runing on port 8002
FOR /F "tokens=5 delims= " %%P IN ('netstat -a -n -o ^| findstr :8002') DO if %%P GTR 0 TaskKill.exe /F /PID %%P

:: delete last blockchain database fork
@RD /S /Q "E:\Dev\Estudos\BlockchainDev\FlashLoans\flashloaner\database\ethereum-fork-update"

::creates fork
start /B ganache-cli --fork https://eth-mainnet.g.alchemy.com/v2/5Mb-roNFwu4Y1uwSjykSuHoC8BYYLABy@%block% --unlock 0x28C6c06298d514Db089934071355E5743bf21d60 -p 8002 --db database/ethereum-fork-update -m "please loud skin soccer slender invest thank brick blue shallow day ivory"
timeout 8

:: get back to main folder
cd E:\Dev\Estudos\BlockchainDev\FlashLoans\flashloaner\
    
::execute deploy
start /B truffle migrate --reset --network ethereum_fork_update 
      
cd E:\Dev\Estudos\BlockchainDev\FlashLoans\flashloaner
:: put some funds on wallet
node .\Flashloaner.js 1 ethereum_fork_update 
:: put check smart contract balance
node .\Flashloaner.js 3 ethereum_fork_update 
    
pause
exit