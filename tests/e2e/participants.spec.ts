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
  sendChatMessage,
  waitForChatResponse,
  getChatResponseText,
  screenshotDir,
  startNewChat,
} from './helpers';

/**
 * Chat Participant E2E 테스트
 *
 * 실제 VS Code 인스턴스를 Electron으로 실행하고
 * @claude, @gemini 채팅 기능을 테스트합니다.
 *
 * ⚠️ 주의: 실제 CLI를 호출하므로 API 비용이 발생합니다.
 */
test.describe('Chat Participants', () => {
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
   * 테스트: Claude 기본 프롬프트 테스트
   *
   * @claude에게 간단한 질문을 하고 응답을 확인합니다.
   */
  test('테스트: Claude 기본 프롬프트 테스트', async () => {
    // 새 Chat 시작
    await startNewChat(page);

    // 테스트 프롬프트 전송
    const testPrompt = 'Say "Hello Claude" and nothing else.';
    await sendChatMessage(page, `@claude ${testPrompt}`);

    // 응답 대기 및 확인
    await waitForChatResponse(page);

    // 스크린샷 저장
    await page.screenshot({
      path: path.join(screenshotDir, 'claude-basic-prompt.png'),
    });

    // 응답에 "Hello"가 포함되어 있는지 확인
    const responseText = await getChatResponseText(page);
    expect(responseText.toLowerCase()).toContain('hello');
  });

  /**
   * 테스트: Gemini 기본 프롬프트 테스트
   *
   * @gemini에게 간단한 질문을 하고 응답을 확인합니다.
   */
  test('테스트: Gemini 기본 프롬프트 테스트', async () => {
    // 새 Chat 시작
    await startNewChat(page);

    // 테스트 프롬프트 전송
    const testPrompt = 'Say "Hello Gemini" and nothing else.';
    await sendChatMessage(page, `@gemini ${testPrompt}`);

    // 응답 대기 및 확인
    await waitForChatResponse(page);

    // 스크린샷 저장
    await page.screenshot({
      path: path.join(screenshotDir, 'gemini-basic-prompt.png'),
    });

    // 응답에 "Hello"가 포함되어 있는지 확인
    const responseText = await getChatResponseText(page);
    expect(responseText.toLowerCase()).toContain('hello');
  });
});
