@echo off
set netwokd=EthereumForkUpdate3
set port=8005
set mainFolder=flashloanerDev

set databaseFound=false
for /d /r "E:\Dev\Estudos\BlockchainDev\FlashLoans\%mainFolder%\Networks\%netwokd%\" %%a in (*) do if /i "%%~nxa"=="teste" set "databaseFound=true"
if %databaseFound% == true (
    @RD /S /Q "E:\Dev\Estudos\BlockchainDev\FlashLoans\%mainFolder%\Networks\%netwokd%\teste"
) else (
    echo "database NOT found"
)
