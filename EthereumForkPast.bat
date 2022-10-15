@echo off
title Fork Deploy flashloaner Arbitrageur Flashloaner script
set netwokd=EthereumForkPast
set port=8100
set mainFolder=flashloaner


::set initial block
SET /A block = 15735900  
::set initial block
SET /A step = -1

:: sets to 1 minute loop if none parater passed
if "%~1"=="" (
    SET /A loop = 60
    echo one time execution script
) else (
    SET /A loop = %1
    echo repeat script every %1 seconds
)
:start
echo %netwokd%: Fork networ, Deploy flashloaner SC, call arbitrageur, execute flashloaner script

::kills process runing on port %port%
FOR /F "tokens=5 delims= " %%P IN ('netstat -a -n -o ^| findstr :%port%') DO if %%P GTR 0 TaskKill.exe /F /PID %%P


::creates folder structure if it does not exists
if not exist "E:\Dev\Estudos\BlockchainDev\FlashLoans\%mainFolder%\Networks\%netwokd%\" mkdir E:\Dev\Estudos\BlockchainDev\FlashLoans\%mainFolder%\Networks\%netwokd%\
if not exist "E:\Dev\Estudos\BlockchainDev\FlashLoans\%mainFolder%\Networks\%netwokd%\FlashloanInput" mkdir E:\Dev\Estudos\BlockchainDev\FlashLoans\%mainFolder%\Networks\%netwokd%\FlashloanInput
if not exist "E:\Dev\Estudos\BlockchainDev\FlashLoans\%mainFolder%\Networks\%netwokd%\FlashloanOutput" mkdir E:\Dev\Estudos\BlockchainDev\FlashLoans\%mainFolder%\Networks\%netwokd%\FlashloanOutput

:: try to find a database folder and delete it in this case
if exist "E:\Dev\Estudos\BlockchainDev\FlashLoans\%mainFolder%\Networks\%netwokd%\database" @RD /S /Q "E:\Dev\Estudos\BlockchainDev\FlashLoans\%mainFolder%\Networks\%netwokd%\database"

::creates fork
start /B ganache-cli --fork https://eth-mainnet.g.alchemy.com/v2/5Mb-roNFwu4Y1uwSjykSuHoC8BYYLABy@%block% --unlock 0x28C6c06298d514Db089934071355E5743bf21d60 -p %port% --db Networks/%netwokd%/database -m "please loud skin soccer slender invest thank brick blue shallow day ivory"
timeout 10

:: execute arbitrageur bot
cd ..\botArbitrage 
node .\Arbitrageur.js 1 2 3 4 0 %netwokd%

:: verify if any new file exists in input folder
echo "verifing new files on Networks\%netwokd%\FlashloanInput..."
cd E:\Dev\Estudos\BlockchainDev\FlashLoans\%mainFolder%\Networks\%netwokd%\FlashloanInput
for /f %%A in ('dir /a-d-s-h /b ^| find /v /c ""') do set cnt=%%A

:: get back to main folder
cd E:\Dev\Estudos\BlockchainDev\FlashLoans\%mainFolder%\

if %cnt% GTR 0 (    

    ::execute deploy
    start /B truffle migrate --reset --network %netwokd% 
    timeout 30
        
    cd E:\Dev\Estudos\BlockchainDev\FlashLoans\%mainFolder%
    :: put some funds on wallet
    node .\Flashloaner.js 1 %netwokd% 
    :: put check smart contract balance
    node .\Flashloaner.js 3 %netwokd% 
    :: execute flashloan
    node .\Flashloaner.js 8 %netwokd% Networks\%netwokd%\FlashloanInput 
    :: withdraw profit
    node .\Flashloaner.js 5 %netwokd%
    :: put check smart contract balance
    node .\Flashloaner.js 3 %netwokd%
    :: put check account balance
    node .\Flashloaner.js 4 %netwokd%
)
SET /A block = block + step
timeout %loop%
if %loop% GTR 0 goto start
exit