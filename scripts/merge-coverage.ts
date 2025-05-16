/**
 * 合併單元測試和端對端測試的覆蓋率報告
 * 此腳本基於 https://github.com/facebook/jest/issues/2418#issuecomment-478932514
 */
import * as fs from 'fs-extra';
import { createReporter } from 'istanbul-api';
import { createCoverageMap } from 'istanbul-lib-coverage';

async function main() {
  try {
    console.log('開始合併覆蓋率報告...');

    // 確保目錄存在
    if (!fs.existsSync('./coverage/unit')) {
      console.warn('單元測試覆蓋率報告不存在，將繼續使用端對端測試覆蓋率');
    }

    if (!fs.existsSync('./coverage/e2e')) {
      console.warn('端對端測試覆蓋率報告不存在，將繼續使用單元測試覆蓋率');
    }

    // 建立覆蓋率數據映射
    const map = createCoverageMap({});

    // 讀取並合併單元測試報告
    try {
      if (fs.existsSync('./coverage/unit/coverage-final.json')) {
        const unitCoverage = fs.readJsonSync('./coverage/unit/coverage-final.json');
        map.merge(unitCoverage);
        console.log('已合併單元測試覆蓋率報告');
      }
    } catch (err) {
      console.error('讀取單元測試覆蓋率報告失敗:', err);
    }

    // 讀取並合併E2E測試報告
    try {
      if (fs.existsSync('./coverage/e2e/coverage-final.json')) {
        const e2eCoverage = fs.readJsonSync('./coverage/e2e/coverage-final.json');
        map.merge(e2eCoverage);
        console.log('已合併端對端測試覆蓋率報告');
      }
    } catch (err) {
      console.error('讀取端對端測試覆蓋率報告失敗:', err);
    }

    // 生成最終的覆蓋率報告
    const reporter = createReporter();
    await reporter.addAll(['json', 'lcov', 'text', 'html']);
    reporter.write(map);
    console.log('已創建合併後的覆蓋率報告在 ./coverage 目錄中');
  } catch (err) {
    console.error('合併覆蓋率報告過程中發生錯誤:', err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
