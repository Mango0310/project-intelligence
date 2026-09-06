@echo off
chcp 65001 >nul
title Project Intelligence 本地平台
cd /d "%~dp0app"
echo.
echo 正在启动 Project Intelligence...
echo 启动后请打开 http://localhost:3000/
echo 关闭此窗口会停止平台。
echo.
npm run dev
pause
