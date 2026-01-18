import {
  test,
  expect,
  _electron as electron,
  ElectronApplication,
  Page,
} from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import {
  getVSCodePath,
  openChatView,
  sendChatMessage,
  waitForChatResponse,
  getChatResponseText,
  screenshotDir,
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
    // 스크린샷 디렉토리 생성
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    // VS Code 실행 경로 (시스템에 따라 수정 필요)
    const vscodePath = getVSCodePath();

    // 테스트용 임시 사용자 데이터 디렉토리
    const userDataDir = path.join(__dirname, '.vscode-test-user-data');

    // VS Code 실행
    electronApp = await electron.launch({
      executablePath: vscodePath,
      args: [
        // 익스텐션 개발 호스트 모드
        '--extensionDevelopmentPath=' + path.resolve(__dirname, '../..'),
        "--profile=dev-vsc-copilot-cli",
        // 사용자 데이터 디렉토리 분리
        '--user-data-dir=' + userDataDir,
        // 테스트용 워크스페이스 열기
        path.resolve(__dirname, '../../.vscode/extensionDevTestWorkspace')
      ],
      timeout: 60_000,
    });

    // 첫 번째 윈도우 가져오기
    page = await electronApp.firstWindow();

    // VS Code가 완전히 로드될 때까지 대기
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(5000); // 추가 로딩 시간
  });

  test.afterAll(async () => {
    // 앱 종료
    if (electronApp) {
      await electronApp.close();
    }
  });

  test.afterEach(async ({}, testInfo) => {
    // 테스트 실패 시 스크린샷 저장
    if (testInfo.status !== 'passed') {
      const screenshotPath = path.join(
        screenshotDir,
        `${testInfo.title.replace(/\s+/g, '-')}-failure.png`
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
    // Chat 뷰 열기
    await openChatView(page);

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
    // Chat 뷰 열기
    await openChatView(page);

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
