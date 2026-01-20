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
 * /session 커맨드 E2E 테스트
 *
 * 실제 VS Code 인스턴스를 Electron으로 실행하고
 * @claude /session, @gemini /session, @codex /session 기능을 테스트합니다.
 *
 * 테스트 시나리오:
 * - 세션 없이 실행: "No Active Session" 메시지 표시
 * - 세션 있을 때 실행: "Current Session" 정보 표시
 */
test.describe('Session Command', () => {
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
   * 테스트: Claude session 커맨드 - 세션 없이 실행
   *
   * 세션이 없는 상태에서 /session을 실행하면
   * "No Active Session" 메시지가 표시되어야 합니다.
   */
  test('테스트: Claude session 커맨드 - 세션 없이 실행', async () => {
    // 새 Chat 시작 (세션 없는 상태 보장)
    await startNewChat(page);

    // /session 명령 실행 (세션 없이)
    await sendChatMessage(page, '@claude /session');

    // 팝업 창이 뜨는 경우 Enter로 닫기
    await page.keyboard.press('Enter');

    // 응답 대기
    await waitForChatResponse(page);

    // 스크린샷 저장
    await page.screenshot({
      path: path.join(screenshotDir, 'claude-session-no-session.png'),
    });

    // "No Active Session" 메시지 확인
    const responseText = await getChatResponseText(page);
    expect(responseText.toLowerCase()).toMatch(/no active session|start a conversation/i);
  });

  /**
   * 테스트: Claude session 커맨드 - 세션 있을 때 실행
   *
   * 먼저 대화를 시작하여 세션을 생성한 후 /session을 실행하면
   * "Current Session" 정보가 표시되어야 합니다.
   */
  test('테스트: Claude session 커맨드 - 세션 있을 때 실행', async () => {
    // 새 Chat 시작
    await startNewChat(page);

    // 먼저 간단한 대화로 세션 생성
    await sendChatMessage(page, '@claude Say "OK" only.');
    await waitForChatResponse(page);

    // 스크린샷 - 세션 생성 확인
    await page.screenshot({
      path: path.join(screenshotDir, 'claude-session-created.png'),
    });

    // /session 명령 실행
    await sendChatMessage(page, '@claude /session');

    // 팝업 창이 뜨는 경우 Enter로 닫기
    await page.keyboard.press('Enter');

    await waitForChatResponse(page);

    // 스크린샷 - session 실행 후
    await page.screenshot({
      path: path.join(screenshotDir, 'claude-session-executed.png'),
    });

    // "Current Session" 정보 확인 (Session ID, CLI 이름 등)
    const responseText = await getChatResponseText(page);
    expect(responseText.toLowerCase()).toMatch(/current session|session id/i);
    expect(responseText.toLowerCase()).toContain('claude');
  });

  /**
   * 테스트: Gemini session 커맨드 - 세션 없이 실행
   *
   * 세션이 없는 상태에서 /session을 실행하면
   * "No Active Session" 메시지가 표시되어야 합니다.
   */
  test('테스트: Gemini session 커맨드 - 세션 없이 실행', async () => {
    // 새 Chat 시작
    await startNewChat(page);

    // /session 명령 실행 (세션 없이)
    await sendChatMessage(page, '@gemini /session');

    // 팝업 창이 뜨는 경우 Enter로 닫기
    await page.keyboard.press('Enter');

    // 응답 대기
    await waitForChatResponse(page);

    // 스크린샷 저장
    await page.screenshot({
      path: path.join(screenshotDir, 'gemini-session-no-session.png'),
    });

    // "No Active Session" 메시지 확인
    const responseText = await getChatResponseText(page);
    expect(responseText.toLowerCase()).toMatch(/no active session|start a conversation/i);
  });

  /**
   * 테스트: Gemini session 커맨드 - 세션 있을 때 실행
   *
   * 먼저 대화를 시작하여 세션을 생성한 후 /session을 실행하면
   * "Current Session" 정보가 표시되어야 합니다.
   */
  test('테스트: Gemini session 커맨드 - 세션 있을 때 실행', async () => {
    // 새 Chat 시작
    await startNewChat(page);

    // 먼저 간단한 대화로 세션 생성
    await sendChatMessage(page, '@gemini Say "OK" only.');
    await waitForChatResponse(page);

    // 스크린샷 - 세션 생성 확인
    await page.screenshot({
      path: path.join(screenshotDir, 'gemini-session-created.png'),
    });

    // /session 명령 실행
    await sendChatMessage(page, '@gemini /session');

    // 팝업 창이 뜨는 경우 Enter로 닫기
    await page.keyboard.press('Enter');

    await waitForChatResponse(page);

    // 스크린샷 - session 실행 후
    await page.screenshot({
      path: path.join(screenshotDir, 'gemini-session-executed.png'),
    });

    // "Current Session" 정보 확인 (Session ID, CLI 이름 등)
    const responseText = await getChatResponseText(page);
    expect(responseText.toLowerCase()).toMatch(/current session|session id/i);
    expect(responseText.toLowerCase()).toContain('gemini');
  });

  /**
   * 테스트: Codex session 커맨드 - 세션 없이 실행
   *
   * 세션이 없는 상태에서 /session을 실행하면
   * "No Active Session" 메시지가 표시되어야 합니다.
   */
  test('테스트: Codex session 커맨드 - 세션 없이 실행', async () => {
    // 새 Chat 시작 (세션 없는 상태 보장)
    await startNewChat(page);

    // /session 명령 실행 (세션 없이)
    await sendChatMessage(page, '@codex /session');

    // 팝업 창이 뜨는 경우 Enter로 닫기
    await page.keyboard.press('Enter');

    // 응답 대기
    await waitForChatResponse(page);

    // 스크린샷 저장
    await page.screenshot({
      path: path.join(screenshotDir, 'codex-session-no-session.png'),
    });

    // "No Active Session" 메시지 확인
    const responseText = await getChatResponseText(page);
    expect(responseText.toLowerCase()).toMatch(/no active session|start a conversation/i);
  });

  /**
   * 테스트: Codex session 커맨드 - 세션 있을 때 실행
   *
   * 먼저 대화를 시작하여 세션을 생성한 후 /session을 실행하면
   * "Current Session" 정보가 표시되어야 합니다.
   */
  test('테스트: Codex session 커맨드 - 세션 있을 때 실행', async () => {
    // 새 Chat 시작
    await startNewChat(page);

    // 먼저 간단한 대화로 세션 생성
    await sendChatMessage(page, '@codex Say "OK" only.');
    await waitForChatResponse(page);

    // 스크린샷 - 세션 생성 확인
    await page.screenshot({
      path: path.join(screenshotDir, 'codex-session-created.png'),
    });

    // /session 명령 실행
    await sendChatMessage(page, '@codex /session');

    // 팝업 창이 뜨는 경우 Enter로 닫기
    await page.keyboard.press('Enter');

    await waitForChatResponse(page);

    // 스크린샷 - session 실행 후
    await page.screenshot({
      path: path.join(screenshotDir, 'codex-session-executed.png'),
    });

    // "Current Session" 정보 확인 (Session ID, CLI 이름 등)
    const responseText = await getChatResponseText(page);
    expect(responseText.toLowerCase()).toMatch(/current session|session id/i);
    expect(responseText.toLowerCase()).toContain('codex');
  });
});
