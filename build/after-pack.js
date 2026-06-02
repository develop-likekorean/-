// 맥(특히 Apple 실리콘)에서 서명 없는/잘못 서명된 앱이 실행 즉시 크래시 나는 걸 막습니다.
// Electron(V8)은 JIT 권한이 있는 서명이 필요해요. 앱 안의 "모든 실행 바이너리(Mach-O)"를
// 안쪽부터 바깥쪽 순서로, JIT 권한(entitlements)을 담아 ad-hoc 서명합니다.
// (.dylib 뿐 아니라 chrome_crashpad_handler 같은 숨은 실행파일까지 전부 포함)
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

  const byDepthDesc = (a, b) => b.length - a.length; // 경로가 긴(깊은) 것 먼저

  console.log('[after-pack] ad-hoc 서명 시작:', appPath);

  // 1) 모든 Mach-O 실행 바이너리(.dylib + crashpad 등 실행파일)를 깊은 것부터 서명
  const allFiles = execSync(`find "${appPath}" -type f`).toString().split('\n').filter(Boolean);
  const machos = [];
  for (const f of allFiles) {
    try {
      if (/Mach-O/.test(execSync(`file -b "${f}"`).toString())) machos.push(f);
    } catch (e) {}
  }
  machos.sort(byDepthDesc);
  for (const m of machos) sign(m);

  // 2) 번들(.framework / 헬퍼 .app)을 깊은 것부터 서명
  const bundles = execSync(`find "${appPath}" \\( -name '*.framework' -o -name '*.app' \\)`)
    .toString().split('\n').filter(Boolean).filter((p) => p !== appPath);
  bundles.sort(byDepthDesc);
  for (const b of bundles) sign(b);

  // 3) 마지막으로 메인 앱
  sign(appPath);
  console.log('[after-pack] ad-hoc 서명 완료 (JIT 권한 포함)');
};
