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
  checkTerminalOpened,
  closeAllTerminals,
  screenshotDir,
} from './helpers';

/**
 * /handoff 커맨드 E2E 테스트
 *
 * 실제 VS Code 인스턴스를 Electron으로 실행하고
 * @claude /handoff, @gemini /handoff, @codex /handoff 기능을 테스트합니다.
 *
 * ⚠️ 주의:
 * - 실제 CLI를 호출하므로 API 비용이 발생합니다.
 * - 터미널이 열리고 포커스가 전이되므로 테스트가 까다로울 수 있습니다.
 */
test.describe('Handoff Command', () => {
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

    // 테스트 후 열린 터미널 정리
    await closeAllTerminals(page);
  });

  /**
   * 테스트: Claude handoff 커맨드 - 세션 없이 실행
   *
   * 세션이 없는 상태에서 /handoff를 실행하면
   * "No Active Session" 에러 메시지가 표시되어야 합니다.
   */
  test('테스트: Claude handoff 커맨드 - 세션 없이 실행', async () => {
    // 새 Chat 시작 (세션 없는 상태 보장)
    await startNewChat(page);

    // /handoff 명령 실행 (세션 없이)
    await sendChatMessage(page, '@claude /handoff');

    // 팝업 창이 뜨는 경우 Enter로 닫기
    await page.keyboard.press('Enter');

    // 응답 대기
    await waitForChatResponse(page);

    // 스크린샷 저장
    await page.screenshot({
      path: path.join(screenshotDir, 'claude-handoff-no-session.png'),
    });

    // "No Active Session" 에러 메시지 확인
    const responseText = await getChatResponseText(page);
    expect(responseText.toLowerCase()).toMatch(/no active session|start a conversation/i);
  });

  /**
   * 테스트: Claude handoff 커맨드 - 세션 있을 때 실행
   *
   * 먼저 대화를 시작하여 세션을 생성한 후 /handoff를 실행하면
   * 터미널이 열리고 "Handoff Successful" 메시지가 표시되어야 합니다.
   */
  test('테스트: Claude handoff 커맨드 - 세션 있을 때 실행', async () => {
    // 새 Chat 시작
    await startNewChat(page);

    // 먼저 간단한 대화로 세션 생성
    await sendChatMessage(page, '@claude Say "OK" only.');
    await waitForChatResponse(page);

    // 스크린샷 - 세션 생성 확인
    await page.screenshot({
      path: path.join(screenshotDir, 'claude-handoff-session-created.png'),
    });

    // /handoff 명령 실행
    await sendChatMessage(page, '@claude /handoff');
    
    // 팝업 창이 뜨는 경우 Enter로 닫기
    await page.keyboard.press('Enter');

    await waitForChatResponse(page);

    // 스크린샷 - handoff 실행 후
    await page.screenshot({
      path: path.join(screenshotDir, 'claude-handoff-executed.png'),
    });

    // "Handoff Successful" 메시지 확인
    const responseText = await getChatResponseText(page);
    expect(responseText.toLowerCase()).toMatch(/handoff successful|interactive.*cli/i);

    // 터미널이 열렸는지 확인
    const terminalOpened = await checkTerminalOpened(page, 'Claude CLI');
    expect(terminalOpened).toBe(true);
  });

  /**
   * 테스트: Gemini handoff 커맨드 - 세션 없이 실행
   *
   * 세션이 없는 상태에서 /handoff를 실행하면
   * "No Active Session" 에러 메시지가 표시되어야 합니다.
   */
  test('테스트: Gemini handoff 커맨드 - 세션 없이 실행', async () => {
    // 새 Chat 시작
    await startNewChat(page);

    // /handoff 명령 실행 (세션 없이)
    await sendChatMessage(page, '@gemini /handoff');

    // 팝업 창이 뜨는 경우 Enter로 닫기
    await page.keyboard.press('Enter');

    // 응답 대기
    await waitForChatResponse(page);

    // 스크린샷 저장
    await page.screenshot({
      path: path.join(screenshotDir, 'gemini-handoff-no-session.png'),
    });

    // "No Active Session" 에러 메시지 확인
    const responseText = await getChatResponseText(page);
    expect(responseText.toLowerCase()).toMatch(/no active session|start a conversation/i);
  });

  /**
   * 테스트: Gemini handoff 커맨드 - 세션 있을 때 실행
   *
   * 먼저 대화를 시작하여 세션을 생성한 후 /handoff를 실행하면
   * 터미널이 열리고 "Handoff Successful" 메시지가 표시되어야 합니다.
   */
  test('테스트: Gemini handoff 커맨드 - 세션 있을 때 실행', async () => {
    // 새 Chat 시작
    await startNewChat(page);

    // 먼저 간단한 대화로 세션 생성
    await sendChatMessage(page, '@gemini Say "OK" only.');
    await waitForChatResponse(page);

    // 스크린샷 - 세션 생성 확인
    await page.screenshot({
      path: path.join(screenshotDir, 'gemini-handoff-session-created.png'),
    });

    // /handoff 명령 실행
    await sendChatMessage(page, '@gemini /handoff');

    // 팝업 창이 뜨는 경우 Enter로 닫기
    await page.keyboard.press('Enter');

    await waitForChatResponse(page);

    // 스크린샷 - handoff 실행 후
    await page.screenshot({
      path: path.join(screenshotDir, 'gemini-handoff-executed.png'),
    });

    // "Handoff Successful" 메시지 확인
    const responseText = await getChatResponseText(page);
    expect(responseText.toLowerCase()).toMatch(/handoff successful|interactive.*cli/i);

    // 터미널이 열렸는지 확인
    const terminalOpened = await checkTerminalOpened(page, 'Gemini CLI');
    expect(terminalOpened).toBe(true);
  });

  /**
   * 테스트: Codex handoff 커맨드 - 세션 없이 실행
   *
   * 세션이 없는 상태에서 /handoff를 실행하면
   * "No Active Session" 에러 메시지가 표시되어야 합니다.
   */
  test('테스트: Codex handoff 커맨드 - 세션 없이 실행', async () => {
    // 새 Chat 시작 (세션 없는 상태 보장)
    await startNewChat(page);

    // /handoff 명령 실행 (세션 없이)
    await sendChatMessage(page, '@codex /handoff');

    // 팝업 창이 뜨는 경우 Enter로 닫기
    await page.keyboard.press('Enter');

    // 응답 대기
    await waitForChatResponse(page);

    // 스크린샷 저장
    await page.screenshot({
      path: path.join(screenshotDir, 'codex-handoff-no-session.png'),
    });

    // "No Active Session" 에러 메시지 확인
    const responseText = await getChatResponseText(page);
    expect(responseText.toLowerCase()).toMatch(/no active session|start a conversation/i);
  });

  /**
   * 테스트: Codex handoff 커맨드 - 세션 있을 때 실행
   *
   * 먼저 대화를 시작하여 세션을 생성한 후 /handoff를 실행하면
   * 터미널이 열리고 "Handoff Successful" 메시지가 표시되어야 합니다.
   */
  test('테스트: Codex handoff 커맨드 - 세션 있을 때 실행', async () => {
    // 새 Chat 시작
    await startNewChat(page);

    // 먼저 간단한 대화로 세션 생성
    await sendChatMessage(page, '@codex Say "OK" only.');
    await waitForChatResponse(page);

    // 스크린샷 - 세션 생성 확인
    await page.screenshot({
      path: path.join(screenshotDir, 'codex-handoff-session-created.png'),
    });

    // /handoff 명령 실행
    await sendChatMessage(page, '@codex /handoff');

    // 팝업 창이 뜨는 경우 Enter로 닫기
    await page.keyboard.press('Enter');

    await waitForChatResponse(page);

    // 터미널이 열릴 때까지 잠시 대기
    await page.waitForTimeout(2000);

    // 스크린샷 - handoff 실행 후
    await page.screenshot({
      path: path.join(screenshotDir, 'codex-handoff-executed.png'),
    });

    // "Handoff Successful" 메시지 확인
    const responseText = await getChatResponseText(page);
    expect(responseText.toLowerCase()).toMatch(/handoff successful|interactive.*cli/i);

    // 터미널이 열렸는지 확인
    const terminalOpened = await checkTerminalOpened(page, 'Codex CLI');
    expect(terminalOpened).toBe(true);
  });
});
