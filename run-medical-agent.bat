@echo off
chcp 65001 >nul
setlocal

REM ============================================================
REM  肝病用药智能决策 Agent - 启动器
REM  功能与原版一致：GUI / CLI 两种模式，CLI 三选一
REM  注意：本脚本不内置任何 API Key，CLI 模式需要你自己的
REM        DEEPSEEK_API_KEY 环境变量（GUI 模式在页面里填）
REM ============================================================

echo ========================================
echo   Med Agent - Select Mode
echo ========================================
echo   1 - GUI Mode    (Web Interface)
echo   2 - CLI Mode    (Command Line)
echo ========================================

set /p C="Select (1/2): "

if "%C%"=="1" goto gui
if "%C%"=="2" goto cli
echo Invalid choice
pause
exit /b

:gui
REM GUI 模式无需环境变量：首次打开页面时在页面里填入自己的 API Key
start "" "%~dp0medical-agent.html"
exit /b

:cli
REM CLI 模式必须有 Key，否则直接给出设置说明
if not defined DEEPSEEK_API_KEY goto nokey

echo ========================================
echo   CLI Mode - Select Function
echo ========================================
echo   1 - Drug Hepatotoxicity Check
echo   2 - Child-Pugh Score
echo   3 - Liver Drug Query
echo ========================================

set /p C="Select (1/2/3): "

if "%C%"=="1" goto r1
if "%C%"=="2" goto r2
if "%C%"=="3" goto r3
echo Invalid
pause
exit /b

:r1
echo.
echo --- Drug Hepatotoxicity Check ---
echo Enter drug name (English):
set /p DRUG=
echo Enter daily dose (mg):
set /p DOSE=
echo Enter Child-Pugh score (5-15):
set /p CP=
set TASK=You are a drug hepatotoxicity checker. Use the LiverTox knowledge base. When user provides drug name: %DRUG%, daily dose: %DOSE% mg, Child-Pugh score: %CP%, calculate hepatotoxicity risk and dose adjustment. Reply in Chinese with clear format.
goto run

:r2
echo.
echo --- Child-Pugh Score ---
echo Enter Bilirubin (umol/L):
set /p BILI=
echo Enter Albumin (g/L):
set /p ALB=
echo Enter PT prolongation (sec):
set /p PT=
echo Enter Ascites (none/mild/moderate):
set /p ASC=
echo Enter Encephalopathy (none/1-2/3-4):
set /p ENC=
set TASK=You are a Child-Pugh score calculator. Calculate score and grade for: Bilirubin %BILI% umol/L, Albumin %ALB% g/L, PT prolongation %PT% sec, Ascites %ASC%, Encephalopathy %ENC%. Reply in Chinese with grade (A/B/C) and dose recommendations.
goto run

:r3
echo.
echo --- Liver Drug Query ---
echo Enter indication (chronic_hepatitis_b / chronic_hepatitis_c / liver_protection / cirrhosis / cholestasis / fatty_liver):
set /p IND=
echo Enter Child-Pugh grade (A/B/C or skip):
set /p GRADE=
set TASK=You are a liver drug query assistant. Find recommended drugs for indication: %IND%, Child-Pugh grade: %GRADE%. Reply in Chinese with drug list and usage.
goto run

:run
cd /d "%~dp0"
if not exist "packages\coding-agent\dist\cli.js" goto nobuild
node packages\coding-agent\dist\cli.js --model deepseek-v4-pro --system-prompt "%TASK%" --print
pause
exit /b

:nobuild
echo.
echo [ERROR] CLI 尚未构建：packages\coding-agent\dist\cli.js 不存在
echo         请先双击运行同一目录下的 setup.bat（安装依赖并构建）
echo.
pause
exit /b 1

:nokey
echo.
echo [ERROR] 未检测到 DEEPSEEK_API_KEY 环境变量
echo.
echo   CLI 模式需要你自己申请并配置 DeepSeek API Key
echo   （本仓库不内置任何 Key）。
echo.
echo   申请地址: https://platform.deepseek.com/api_keys
echo.
echo   设置方法（任选其一）：
echo     1) 临时（只对当前窗口有效）：
echo          set DEEPSEEK_API_KEY=sk-你的key
echo          然后重新运行 run-medical-agent.bat
echo     2) 永久（推荐）：
echo          Win+R 输入 sysdm.cpl 回车
echo          高级 - 环境变量 - 用户变量 - 新建
echo          变量名: DEEPSEEK_API_KEY
echo          变量值: 你的 API Key
echo          确定后重新打开本脚本
echo.
echo   提示：GUI 模式不需要这个环境变量，直接在网页里填 Key 即可。
echo.
pause
exit /b 1
