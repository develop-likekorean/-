// 맥(특히 Apple 실리콘)에서 서명 없는 앱이 실행 즉시 강제 종료되는 걸 막기 위해
// 빌드 후 앱에 ad-hoc(임시) 서명을 붙입니다. 정식 개발자 서명은 아니지만,
// 커널이 앱을 죽이지 않게 해줘서 "예기치 않게 종료" 크래시가 사라집니다.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;

  const productFilename = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, productFilename + '.app');

  if (!fs.existsSync(appPath)) {
    console.log('[after-pack] .app 을 찾지 못함, 건너뜀:', appPath);
    return;
  }

  console.log('[after-pack] ad-hoc 서명 적용:', appPath);
  try {
    execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' });
    console.log('[after-pack] ad-hoc 서명 완료');
  } catch (e) {
    console.error('[after-pack] 서명 실패:', e.message);
    throw e;
  }
};
