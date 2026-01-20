import {
  test,
  expect,
  ElectronApplication,
  Page,
} from '@playwright/test';
import * as path from 'path';
import {
  launchVSCode,
  sendChatMessage,
  waitForChatResponse,
  getChatResponseText,
  checkTerminalOpened,
  closeAllTerminals,
  screenshotDir,
} from './helpers';

/**
 * /passAgent 커맨드 E2E 테스트
 *
 * 실제 VS Code 인스턴스를 Electron으로 실행하고
 * Custom Agent를 선택한 후 @gemini /passAgent 기능을 테스트합니다.
 *
 * ⚠️ 주의:
 * - 실제 CLI를 호출하므로 API 비용이 발생합니다.
 * - Custom Agent가 미리 설정되어 있어야 합니다.
 * - claude는 /passAgent를 지원하지 않습니다.
 */
test.describe('PassAgent Command', () => {
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
   * Custom Agent (Test Agent)를 선택하여 새 Chat을 시작합니다.
   * Command Palette에서 'Chat: Open Chat (Test Agent)'를 실행합니다.
   */
  async function startNewChatWithTestAgent(): Promise<void> {
    // Command Palette 열기
    await page.keyboard.press('Control+Shift+P');
    await page.waitForTimeout(500);

    // 'Chat: Open Chat (Test Agent)' 입력
    await page.keyboard.type('Chat: Open Chat (Test Agent)');
    await page.waitForTimeout(500);
    await page.keyboard.press('Enter');

    // Chat이 열릴 때까지 대기
    await page.waitForTimeout(2000);
  }

  /**
   * 테스트: Gemini passAgent 커맨드 - Test Agent 선택 후 실행 및 handoff 확인
   *
   * Test Agent를 선택하고 @gemini /passAgent로 프롬프트를 전송하면
   * CLI가 호출되어 응답이 반환되고, /handoff를 실행하면
   * 터미널이 열리고 Test Agent 정보가 확인되어야 합니다.
   */
  test('테스트: Gemini passAgent 커맨드 - Test Agent 선택 후 실행 및 handoff 확인', async () => {
    // Test Agent로 새 Chat 시작
    await startNewChatWithTestAgent();

    // 스크린샷 - Test Agent 선택 확인
    await page.screenshot({
      path: path.join(screenshotDir, 'gemini-passAgent-test-agent-selected.png'),
    });

    // @gemini /passAgent로 테스트 프롬프트 전송
    await sendChatMessage(page, '@gemini /passAgent Say "Test Agent is working!" only.');

    // 팝업 창이 뜨는 경우 Enter로 닫기
    await page.keyboard.press('Enter');

    // 응답 대기
    await waitForChatResponse(page);

    // 스크린샷 - passAgent 실행 후
    await page.screenshot({
      path: path.join(screenshotDir, 'gemini-passAgent-executed.png'),
    });

    // 응답 확인 (정상적으로 CLI가 호출되어 응답이 있어야 함)
    const passAgentResponseText = await getChatResponseText(page);
    expect(passAgentResponseText.length).toBeGreaterThan(0);

    // /handoff 명령 실행
    await sendChatMessage(page, '@gemini /handoff');

    // 팝업 창이 뜨는 경우 Enter로 닫기
    await page.keyboard.press('Enter');

    await waitForChatResponse(page);

    // 스크린샷 - handoff 실행 후
    await page.screenshot({
      path: path.join(screenshotDir, 'gemini-passAgent-handoff-executed.png'),
    });

    // "Handoff Successful" 메시지 확인
    const handoffResponseText = await getChatResponseText(page);
    expect(handoffResponseText.toLowerCase()).toMatch(/handoff successful|interactive.*cli/i);

    // 터미널이 열렸는지 확인
    const terminalOpened = await checkTerminalOpened(page, 'Gemini CLI');
    expect(terminalOpened).toBe(true);

    // 터미널 스크린샷 저장 (Test Agent 정보 확인용)
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: path.join(screenshotDir, 'gemini-passAgent-terminal-content.png'),
    });
  });

  /**
   * 테스트: Claude passAgent 커맨드 - Test Agent에서 실행
   *
   * claude는 /passAgent를 지원하지 않지만,
   * 기본적으로 선택된 Agent에 대해 모두 pass 처리됩니다.
   */
  test('테스트: Claude passAgent 커맨드 - Test Agent에서 실행', async () => {
    // Test Agent로 새 Chat 시작
    await startNewChatWithTestAgent();

    // 스크린샷 - Test Agent 선택 확인
    await page.screenshot({
      path: path.join(screenshotDir, 'claude-passAgent-test-agent-selected.png'),
    });

    // @claude 테스트 프롬프트 전송
    await sendChatMessage(page, '@claude Say "OK" only.');

    // 응답 대기
    await waitForChatResponse(page);

    // 스크린샷 - passAgent 실행 후
    await page.screenshot({
      path: path.join(screenshotDir, 'claude-passAgent-executed.png'),
    });

    // 응답 확인 (정상적으로 pass 처리되어 응답이 있어야 함)
    const responseText = await getChatResponseText(page);
    expect(responseText.length).toBeGreaterThan(0);
  });
});

