@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ========================================
echo   liver_check - 环境安装与构建
echo ========================================
echo.

where node >nul 2>nul
if errorlevel 1 goto nonode

for /f "delims=" %%v in ('node -p "process.versions.node"') do set "NODEV=%%v"
echo Node.js: %NODEV%
echo.

echo [1/2] npm install ...
call npm install
if errorlevel 1 goto failinstall

echo.
echo [2/2] npm run build ...
call npm run build
if errorlevel 1 goto failbuild

echo.
if exist "packages\coding-agent\dist\cli.js" (
  echo [OK] 构建完成，现在可以运行 run-medical-agent.bat
) else (
  echo [WARN] 构建结束但未找到 packages\coding-agent\dist\cli.js，请检查上方日志
)
echo.
pause
exit /b

:nonode
echo [ERROR] 未检测到 Node.js。
echo         本项目需要 Node.js 22.19.0 或更高版本：https://nodejs.org/
echo.
pause
exit /b 1

:failinstall
echo.
echo [ERROR] npm install 失败，请检查网络或代理设置后重试。
echo.
pause
exit /b 1

:failbuild
echo.
echo [ERROR] npm run build 失败，请检查上方日志。
echo.
pause
exit /b 1
