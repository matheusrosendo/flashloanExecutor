@echo off
title investigate owner


::kills process runing on port 8009
FOR /F "tokens=5 delims= " %%P IN ('netstat -a -n -o ^| findstr :8002') DO if %%P GTR 0 TaskKill.exe /F /PID %%P

:: delete last blockchain database fork
@RD /S /Q "E:\Dev\Estudos\BlockchainDev\FlashLoans\flashloaner\database\ethereum-fork-update"

::creates fork
:: start /B ganache-cli --fork https://eth-mainnet.g.alchemy.com/v2/5Mb-roNFwu4Y1uwSjykSuHoC8BYYLABy@15629430 --unlock 0x28C6c06298d514Db089934071355E5743bf21d60 -i 10 -p 8002 --db database/ethereum-fork-update4 -m `"please loud skin soccer slender invest thank brick blue shallow day ivory`"
start /B ganache-cli --fork https://eth-mainnet.g.alchemy.com/v2/5Mb-roNFwu4Y1uwSjykSuHoC8BYYLABy@15629430 --unlock 0x28C6c06298d514Db089934071355E5743bf21d60 -p 8002 --db database/ethereum-fork-update -m "please loud skin soccer slender invest thank brick blue shallow day ivory"
::npm run ethereum_fork_update 
pause