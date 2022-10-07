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
echo EthereumForkUpdate: Fork networ, Deploy flashloaner SC, call arbitrageur, execute flashloaner script

::kills process runing on port 8001
FOR /F "tokens=5 delims= " %%P IN ('netstat -a -n -o ^| findstr :8001') DO if %%P GTR 0 TaskKill.exe /F /PID %%P

:: delete last blockchain database fork
@RD /S /Q "E:\Dev\Estudos\BlockchainDev\FlashLoans\flashloaner\Networks\EthereumForkUpdate\database"

::creates fork
start /B ganache-cli --fork https://eth-mainnet.g.alchemy.com/v2/5Mb-roNFwu4Y1uwSjykSuHoC8BYYLABy --unlock 0x28C6c06298d514Db089934071355E5743bf21d60 -p 8001 --db Networks/EthereumForkUpdate/database -m "please loud skin soccer slender invest thank brick blue shallow day ivory"
timeout 10

:: execute arbitrageur bot
cd E:\Dev\Estudos\BlockchainDev\FlashLoans\botArbitrage 
node .\Arbitrageur.js 1 2 4 0 EthereumForkUpdate

:: verify if any new file exists in input folder
echo "verifing new files on Networks\EthereumForkUpdate\FlashloanInput..."
cd E:\Dev\Estudos\BlockchainDev\FlashLoans\flashloaner\Networks\EthereumForkUpdate\FlashloanInput
for /f %%A in ('dir /a-d-s-h /b ^| find /v /c ""') do set cnt=%%A

:: get back to main folder
cd E:\Dev\Estudos\BlockchainDev\FlashLoans\flashloaner\

if %cnt% GTR 0 (    

    ::execute deploy
    start /B truffle migrate --reset --network EthereumForkUpdate 
    timeout 30
        
    cd E:\Dev\Estudos\BlockchainDev\FlashLoans\flashloaner
    :: put some funds on wallet
    node .\Flashloaner.js 1 EthereumForkUpdate 
    :: put check smart contract balance
    node .\Flashloaner.js 3 EthereumForkUpdate 
    :: execute flashloan
    node .\Flashloaner.js 8 EthereumForkUpdate Networks\EthereumForkUpdate\FlashloanInput 
    :: withdraw profit
    node .\Flashloaner.js 5 EthereumForkUpdate
    :: put check smart contract balance
    node .\Flashloaner.js 3 EthereumForkUpdate
    :: put check account balance
    node .\Flashloaner.js 4 EthereumForkUpdate
)
timeout %loop%
if %loop% GTR 0 goto start
exit