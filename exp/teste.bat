@echo off
title Delete folder
SET /A block = 15632879
:start
FOR /F "tokens=5 delims= " %%P IN ('netstat -a -n -o ^| findstr :8002') DO if %%P GTR 0 TaskKill.exe /F /PID %%P
start /B ganache-cli --fork https://eth-mainnet.g.alchemy.com/v2/5Mb-roNFwu4Y1uwSjykSuHoC8BYYLABy@%block% --unlock 0x28C6c06298d514Db089934071355E5743bf21d60 -p 8002 --db database/ethereum-fork-update -m `"please loud skin soccer slender invest thank brick blue shallow day ivory`"
SET /A block = block - 1  
timeout 10
goto start
exit