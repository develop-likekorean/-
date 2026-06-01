// 맥(특히 Apple 실리콘)에서 서명 없는/잘못 서명된 앱이 실행 즉시 크래시 나는 걸 막습니다.
// Electron(V8)은 JIT 권한이 있는 서명이 필요해요. 그래서 앱 내부 구성요소를
// "안쪽부터 바깥쪽 순서"로, JIT 권한(entitlements)을 담아 ad-hoc 서명합니다.
// (정식 개발자 서명은 아니지만, 커널이 앱을 죽이지 않게 만들어 크래시를 없앱니다.)
const { execFileSync, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);
  if (!fs.existsSync(appPath)) {
    console.log('[after-pack] .app 을 찾지 못함, 건너뜀:', appPath);
    return;
  }

  const entitlements = path.join(__dirname, 'entitlements.mac.plist');

  const sign = (target) => {
    execFileSync('codesign', [
      '--force',
      '--timestamp=none',
      '--options', 'runtime',
      '--entitlements', entitlements,
      '--sign', '-',
      target
    ], { stdio: 'inherit' });
  };

  console.log('[after-pack] ad-hoc 서명 시작:', appPath);

  // 1) 모든 .dylib (가장 안쪽 먼저)
  let dylibs = [];
  try {
    dylibs = execSync(`find "${appPath}" -name '*.dylib'`).toString().trim().split('\n').filter(Boolean);
  } catch (e) {}
  for (const d of dylibs) sign(d);

  const fwDir = path.join(appPath, 'Contents', 'Frameworks');
  if (fs.existsSync(fwDir)) {
    // 2) 프레임워크들 (Electron Framework 등)
    for (const e of fs.readdirSync(fwDir)) {
      if (e.endsWith('.framework')) sign(path.join(fwDir, e));
    }
    // 3) 헬퍼 앱들 (내부 실행파일 → 헬퍼 앱 순서)
    for (const e of fs.readdirSync(fwDir)) {
      if (e.endsWith('.app')) {
        const inner = path.join(fwDir, e, 'Contents', 'MacOS', e.replace(/\.app$/, ''));
        if (fs.existsSync(inner)) sign(inner);
        sign(path.join(fwDir, e));
      }
    }
  }

  // 4) 마지막으로 메인 앱
  sign(appPath);
  console.log('[after-pack] ad-hoc 서명 완료 (JIT 권한 포함)');
};
