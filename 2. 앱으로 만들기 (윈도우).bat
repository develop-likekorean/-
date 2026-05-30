@echo off
chcp 65001 >nul
title 빼꼼 인덱스 - 윈도우 앱 만들기
REM 빼꼼 인덱스 - 윈도우 설치형 앱(.exe)으로 만들기 (더블클릭)
cd /d "%~dp0"

echo ===================================
echo    빼꼼 인덱스 - 윈도우 앱 만들기
echo ===================================
echo.

where npm >nul 2>nul
if %errorlevel% neq 0 (
  echo [!] Node.js 가 설치되어 있지 않아요.
  echo     https://nodejs.org 에서 LTS 버전을 설치한 뒤 다시 실행해주세요.
  echo.
  pause
  exit /b 1
)

REM 다른 OS(맥)에서 설치된 파일이 섞여 있으면 윈도우용으로 다시 설치
set NEED_INSTALL=0
if not exist "node_modules" set NEED_INSTALL=1
if not exist "node_modules\.platform-win" set NEED_INSTALL=1

if "%NEED_INSTALL%"=="1" (
  if exist "node_modules" (
    echo 윈도우용으로 새로 준비하는 중이에요. 기존 파일을 정리합니다...
    rmdir /s /q "node_modules"
  )
  if exist "package-lock.json" del /q "package-lock.json"
  echo 필요한 파일을 받는 중이에요 ^(2~3분^)...
  call npm install
  if %errorlevel% neq 0 (
    echo.
    echo [!] 설치 중 문제가 생겼어요. 위 메시지를 확인해주세요.
    pause
    exit /b 1
  )
  echo win> "node_modules\.platform-win"
)

echo.
echo 앱을 만드는 중이에요... (몇 분 걸릴 수 있어요)
call npm run build:win
if %errorlevel% neq 0 (
  echo.
  echo [!] 앱 만들기에 실패했어요. 위 메시지를 확인해주세요.
  pause
  exit /b 1
)

echo.
if exist "dist" (
  echo 완료! dist 폴더 안에 설치 파일(.exe)이 생겼어요.
  start "" "dist"
) else (
  echo [!] dist 폴더가 만들어지지 않았어요. 위 메시지를 확인해주세요.
)
pause
