#!/bin/bash
# 빼꼼 인덱스 - 맥에서 실행하기 (더블클릭)
cd "$(dirname "$0")"

echo "=============================="
echo "   빼꼼 인덱스 실행 준비 중..."
echo "=============================="
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
  echo "필요한 파일을 받는 중이에요 (1~2분 걸릴 수 있어요)..."
  npm install || { echo "[!] 설치 실패. 위 메시지를 확인해주세요."; read -n 1 -s -r -p "닫으려면 키를 누르세요..."; exit 1; }
  touch "node_modules/.platform-mac"
fi

echo ""
echo "실행합니다! 화면 오른쪽 가장자리를 확인하세요."
npm start
