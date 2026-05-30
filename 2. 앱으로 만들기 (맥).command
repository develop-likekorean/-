#!/bin/bash
# 빼꼼 인덱스 - 맥 설치형 앱(.dmg)으로 만들기 (더블클릭)
cd "$(dirname "$0")"

echo "==================================="
echo "   빼꼼 인덱스 - 맥 앱 만들기"
echo "==================================="
echo ""

if ! command -v npm &> /dev/null; then
  echo "[!] Node.js 가 설치되어 있지 않아요."
  echo "    https://nodejs.org 에서 LTS 버전을 설치한 뒤 다시 실행해주세요."
  echo ""
  read -n 1 -s -r -p "아무 키나 누르면 닫힙니다..."
  exit 1
fi

# 다른 OS(윈도우)에서 설치된 파일이 섞여 있으면 맥용으로 다시 설치
if [ ! -f "node_modules/.platform-mac" ]; then
  if [ -d "node_modules" ]; then
    echo "맥용으로 새로 준비하는 중이에요. 기존 파일을 정리합니다..."
    rm -rf node_modules
  fi
  [ -f "package-lock.json" ] && rm -f package-lock.json
  echo "필요한 파일을 받는 중이에요 (1~2분)..."
  npm install || { echo "[!] 설치 실패. 위 메시지를 확인해주세요."; read -n 1 -s -r -p "닫으려면 키를 누르세요..."; exit 1; }
  touch "node_modules/.platform-mac"
fi

echo ""
echo "앱을 만드는 중이에요... (몇 분 걸릴 수 있어요)"
npm run build:mac || { echo "[!] 앱 만들기 실패. 위 메시지를 확인해주세요."; read -n 1 -s -r -p "닫으려면 키를 누르세요..."; exit 1; }

echo ""
if [ -d "dist" ]; then
  echo "완료! dist 폴더 안에 '빼꼼 인덱스.dmg' 가 생겼어요."
  echo "그 파일을 열어서 응용 프로그램 폴더로 드래그하면 설치됩니다."
  open dist 2>/dev/null
else
  echo "[!] dist 폴더가 만들어지지 않았어요. 위 메시지를 확인해주세요."
fi
read -n 1 -s -r -p "아무 키나 누르면 닫힙니다..."
