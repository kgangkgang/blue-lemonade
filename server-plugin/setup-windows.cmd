@echo off
chcp 65001 >nul
title Blue Lemonade ZIP helper
where node >nul 2>nul
if errorlevel 1 (
    echo Node.js를 찾지 못했어요. 실리태번을 실행하는 PC에서 다시 열어 주세요.
    pause
    exit /b 1
)
node "%~dp0setup.mjs"
echo.
pause
