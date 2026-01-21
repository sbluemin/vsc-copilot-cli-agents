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
  screenshotDir,
} from './helpers';

/**
 * Auto Agent 캐싱 E2E 테스트
 *
 * Custom Agent 선택 시 modeInstructions가 자동으로 전달되고,
 * 동일 세션에서는 중복 전달되지 않는지 테스트합니다.
 *
 * ⚠️ 주의:
 * - 실제 CLI를 호출하므로 API 비용이 발생합니다.
 * - Custom Agent (Test Agent)가 미리 설정되어 있어야 합니다.
 */
test.describe('Auto Agent Instructions', () => {
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
   * Custom Agent (Test Agent)를 선택하여 새 Chat을 시작합니다.
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
   * 테스트: Gemini - Custom Agent 자동 적용 (passAgent 커맨드 없이)
   *
   * Test Agent를 선택하고 @gemini로 직접 프롬프트를 전송하면
   * modeInstructions가 자동으로 CLI에 전달되어야 합니다.
   */
  test('테스트: Gemini - Custom Agent 자동 적용', async () => {
    // Test Agent로 새 Chat 시작
    await startNewChatWithTestAgent();

    // 스크린샷 - Test Agent 선택 확인
    await page.screenshot({
      path: path.join(screenshotDir, 'gemini-autoAgent-selected.png'),
    });

    // @gemini로 직접 테스트 프롬프트 전송 (/passAgent 없이)
    await sendChatMessage(page, '@gemini Say "Auto Agent Working!" only.');

    // 팝업 창이 뜨는 경우 Enter로 닫기
    await page.keyboard.press('Enter');

    // 응답 대기
    await waitForChatResponse(page);

    // 스크린샷 - 응답 확인
    await page.screenshot({
      path: path.join(screenshotDir, 'gemini-autoAgent-response.png'),
    });

    // 응답 확인 (정상적으로 CLI가 호출되어 응답이 있어야 함)
    const responseText = await getChatResponseText(page);
    expect(responseText.length).toBeGreaterThan(0);
  });

  /**
   * 테스트: Codex - Custom Agent 자동 적용 (passAgent 커맨드 없이)
   *
   * Test Agent를 선택하고 @codex로 직접 프롬프트를 전송하면
   * modeInstructions가 자동으로 CLI에 전달되어야 합니다.
   */
  test('테스트: Codex - Custom Agent 자동 적용', async () => {
    // Test Agent로 새 Chat 시작
    await startNewChatWithTestAgent();

    // 스크린샷 - Test Agent 선택 확인
    await page.screenshot({
      path: path.join(screenshotDir, 'codex-autoAgent-selected.png'),
    });

    // @codex로 직접 테스트 프롬프트 전송 (/passAgent 없이)
    await sendChatMessage(page, '@codex Say "Auto Agent Working!" only.');

    // 팝업 창이 뜨는 경우 Enter로 닫기
    await page.keyboard.press('Enter');

    // 응답 대기
    await waitForChatResponse(page);

    // 스크린샷 - 응답 확인
    await page.screenshot({
      path: path.join(screenshotDir, 'codex-autoAgent-response.png'),
    });

    // 응답 확인 (정상적으로 CLI가 호출되어 응답이 있어야 함)
    const responseText = await getChatResponseText(page);
    expect(responseText.length).toBeGreaterThan(0);
  });

  /**
   * 테스트: Claude - Custom Agent 자동 적용 (기존 동작 유지)
   *
   * Claude는 이전에도 자동 적용되었으며, 변경 후에도 동일하게 동작해야 합니다.
   */
  test('테스트: Claude - Custom Agent 자동 적용', async () => {
    // Test Agent로 새 Chat 시작
    await startNewChatWithTestAgent();

    // 스크린샷 - Test Agent 선택 확인
    await page.screenshot({
      path: path.join(screenshotDir, 'claude-autoAgent-selected.png'),
    });

    // @claude로 테스트 프롬프트 전송
    await sendChatMessage(page, '@claude Say "Auto Agent Working!" only.');

    // 응답 대기
    await waitForChatResponse(page);

    // 스크린샷 - 응답 확인
    await page.screenshot({
      path: path.join(screenshotDir, 'claude-autoAgent-response.png'),
    });

    // 응답 확인
    const responseText = await getChatResponseText(page);
    expect(responseText.length).toBeGreaterThan(0);
  });

  /**
   * 테스트: Gemini - 동일 Agent에서 연속 대화 (중복 전달 방지)
   *
   * Test Agent 선택 후 첫 번째 대화에서 modeInstructions가 전달되고,
   * 두 번째 대화에서는 동일 Agent이므로 중복 전달되지 않아야 합니다.
   * (직접적인 검증은 어렵지만, 정상 동작 확인)
   */
  test('테스트: Gemini - 동일 Agent 연속 대화', async () => {
    // Test Agent로 새 Chat 시작
    await startNewChatWithTestAgent();

    // 첫 번째 메시지 전송
    await sendChatMessage(page, '@gemini First message. Say "First OK" only.');
    await page.keyboard.press('Enter');
    await waitForChatResponse(page);

    // 스크린샷 - 첫 번째 응답
    await page.screenshot({
      path: path.join(screenshotDir, 'gemini-autoAgent-first-response.png'),
    });

    const firstResponse = await getChatResponseText(page);
    expect(firstResponse.length).toBeGreaterThan(0);

    // 두 번째 메시지 전송 (동일 세션, 동일 Agent)
    await sendChatMessage(page, '@gemini Second message. Say "Second OK" only.');
    await page.keyboard.press('Enter');
    await waitForChatResponse(page);

    // 스크린샷 - 두 번째 응답
    await page.screenshot({
      path: path.join(screenshotDir, 'gemini-autoAgent-second-response.png'),
    });

    const secondResponse = await getChatResponseText(page);
    expect(secondResponse.length).toBeGreaterThan(0);
  });
});
