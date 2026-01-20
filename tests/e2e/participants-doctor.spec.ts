import {
  test,
  expect,
  ElectronApplication,
  Page,
} from '@playwright/test';
import * as path from 'path';
import {
  launchVSCode,
  openChatView,
  startNewChat,
  sendChatMessage,
  waitForChatResponse,
  getChatResponseText,
  screenshotDir,
} from './helpers';

/**
 * /doctor 커맨드 E2E 테스트
 *
 * 실제 VS Code 인스턴스를 Electron으로 실행하고
 * @claude /doctor, @gemini /doctor, @codex /doctor 기능을 테스트합니다.
 *
 * /doctor 커맨드는 CLI 설치 상태를 확인하고 health report를 출력합니다.
 * 정상적인 경우 '✅' 또는 'installed' 메시지가 표시되고,
 * 설치되지 않은 경우 '❌' 또는 설치 가이드가 표시됩니다.
 */
test.describe('Doctor Command', () => {
  let electronApp: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    // VS Code 실행 (공통 헬퍼 사용)
    const result = await launchVSCode();
    electronApp = result.electronApp;
    page = result.page;
  });

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  test.afterEach(async ({}, testInfo) => {
    // 테스트 실패 시 스크린샷 저장
    if (testInfo.status !== 'passed') {
      // 테스트 제목에서 파일명으로 사용 불가능한 문자 제거
      const sanitizedTitle = testInfo.title
        .replace(/\s+/g, '-')
        .replace(/[\/\\:*?"<>|]/g, '_');
      const screenshotPath = path.join(
        screenshotDir,
        `${sanitizedTitle}-failure.png`
      );
      await page.screenshot({ path: screenshotPath });
    }
  });

  /**
   * 테스트: Claude /doctor 커맨드 - Health Report 출력 확인
   *
   * /doctor 커맨드를 실행하면 CLI 설치 상태에 대한 health report가 출력되어야 합니다.
   * - CLI가 설치된 경우: '✅', 'installed', 'healthy' 등의 메시지
   * - CLI가 미설치인 경우: '❌', 'not installed', 설치 가이드 메시지
   *
   * ⚠️ 에러 메시지가 출력되면 테스트 실패로 처리합니다.
   */
  test('테스트: Claude /doctor 커맨드 - Health Report 출력 확인', async () => {
    // 새 Chat 시작
    await startNewChat(page);

    // /doctor 명령 실행
    await sendChatMessage(page, '@claude /doctor');

    // 팝업 창이 뜨는 경우 Enter로 닫기
    await page.keyboard.press('Enter');

    // 응답 대기
    await waitForChatResponse(page);

    // 스크린샷 저장
    await page.screenshot({
      path: path.join(screenshotDir, 'claude-doctor-result.png'),
    });

    // 응답 텍스트 가져오기
    const responseText = await getChatResponseText(page);

    // 에러 메시지가 출력되면 테스트 실패
    // doctor.ts의 에러 메시지 패턴: "❌ **Error during health check:**"
    const hasError = /error during health check/i.test(responseText);
    expect(hasError).toBe(false);

    // Health Report가 정상적으로 출력되었는지 확인
    // 설치 여부와 관계없이 health report 포맷이 출력되어야 함
    const hasHealthReport = (
      // 설치된 경우
      /✅|installed|healthy|available/i.test(responseText) ||
      // 미설치인 경우 (가이드 포함)
      /❌|not installed|not found|install|npm|npx/i.test(responseText) ||
      // CLI 이름이 포함된 경우
      /claude/i.test(responseText)
    );

    expect(hasHealthReport).toBe(true);
  });

  /**
   * 테스트: Gemini /doctor 커맨드 - Health Report 출력 확인
   *
   * /doctor 커맨드를 실행하면 CLI 설치 상태에 대한 health report가 출력되어야 합니다.
   * - CLI가 설치된 경우: '✅', 'installed', 'healthy' 등의 메시지
   * - CLI가 미설치인 경우: '❌', 'not installed', 설치 가이드 메시지
   *
   * ⚠️ 에러 메시지가 출력되면 테스트 실패로 처리합니다.
   */
  test('테스트: Gemini /doctor 커맨드 - Health Report 출력 확인', async () => {
    // 새 Chat 시작
    await startNewChat(page);

    // /doctor 명령 실행
    await sendChatMessage(page, '@gemini /doctor');

    // 팝업 창이 뜨는 경우 Enter로 닫기
    await page.keyboard.press('Enter');

    // 응답 대기
    await waitForChatResponse(page);

    // 스크린샷 저장
    await page.screenshot({
      path: path.join(screenshotDir, 'gemini-doctor-result.png'),
    });

    // 응답 텍스트 가져오기
    const responseText = await getChatResponseText(page);

    // 에러 메시지가 출력되면 테스트 실패
    // doctor.ts의 에러 메시지 패턴: "❌ **Error during health check:**"
    const hasError = /error during health check/i.test(responseText);
    expect(hasError).toBe(false);

    // Health Report가 정상적으로 출력되었는지 확인
    // 설치 여부와 관계없이 health report 포맷이 출력되어야 함
    const hasHealthReport = (
      // 설치된 경우
      /✅|installed|healthy|available/i.test(responseText) ||
      // 미설치인 경우 (가이드 포함)
      /❌|not installed|not found|install|npm|npx/i.test(responseText) ||
      // CLI 이름이 포함된 경우
      /gemini/i.test(responseText)
    );

    expect(hasHealthReport).toBe(true);
  });

  /**
   * 테스트: Codex /doctor 커맨드 - Health Report 출력 확인
   *
   * /doctor 커맨드를 실행하면 CLI 설치 상태에 대한 health report가 출력되어야 합니다.
   * - CLI가 설치된 경우: '✅', 'installed', 'healthy' 등의 메시지
   * - CLI가 미설치인 경우: '❌', 'not installed', 설치 가이드 메시지
   *
   * ⚠️ 에러 메시지가 출력되면 테스트 실패로 처리합니다.
   */
  test('테스트: Codex /doctor 커맨드 - Health Report 출력 확인', async () => {
    // 새 Chat 시작
    await startNewChat(page);

    // /doctor 명령 실행
    await sendChatMessage(page, '@codex /doctor');

    // 팝업 창이 뜨는 경우 Enter로 닫기
    await page.keyboard.press('Enter');

    // 응답 대기
    await waitForChatResponse(page);

    // 스크린샷 저장
    await page.screenshot({
      path: path.join(screenshotDir, 'codex-doctor-result.png'),
    });

    // 응답 텍스트 가져오기
    const responseText = await getChatResponseText(page);

    // 에러 메시지가 출력되면 테스트 실패
    const hasError = /error during health check/i.test(responseText);
    expect(hasError).toBe(false);

    // Health Report가 정상적으로 출력되었는지 확인
    const hasHealthReport = (
      // 설치된 경우
      /✅|installed|healthy|available/i.test(responseText) ||
      // 미설치인 경우 (가이드 포함)
      /❌|not installed|not found|install|npm|npx/i.test(responseText) ||
      // CLI 이름이 포함된 경우
      /codex/i.test(responseText)
    );

    expect(hasHealthReport).toBe(true);
  });
});
