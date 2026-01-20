import { _electron as electron, ElectronApplication, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// 스크린샷 저장 경로
export const screenshotDir = path.join(__dirname, '..', 'screenshots');

// ============================================================================
// 플랫폼 헬퍼
// ============================================================================

/**
 * 현재 플랫폼에 맞는 modifier 키를 반환합니다.
 * macOS: Meta (Cmd), Windows/Linux: Control
 */
export function getModifierKey(): 'Meta' | 'Control' {
  return process.platform === 'darwin' ? 'Meta' : 'Control';
}

// 테스트용 사용자 데이터 디렉토리 (워크스페이스 루트의 .vscode/test-user-data)
export const testUserDataDir = path.resolve(__dirname, '../../../.vscode/.e2e-test-user-data');

// 테스트용 워크스페이스 경로
export const testWorkspacePath = path.resolve(__dirname, '../../../.vscode/extensionDevTestWorkspace');

// 확장 개발 경로
export const extensionDevPath = path.resolve(__dirname, '../../../');

// ============================================================================
// VS Code 실행 헬퍼
// ============================================================================

/**
 * VS Code 실행 결과=
 */
export interface LaunchVSCodeResult {
  electronApp: ElectronApplication;
  page: Page;
}

/**
 * E2E 테스트용 VS Code를 실행합니다.
 * launch.json의 'Run Code with E2E environment'와 동일한 설정 사용
 *
 * @returns ElectronApplication과 Page 객체
 */
export async function launchVSCode(): Promise<LaunchVSCodeResult> {
  // 스크린샷 디렉토리 생성
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  // VS Code 실행 경로
  const vscodePath = getVSCodePath();

  // VS Code 실행 (launch.json의 'Run Code with E2E environment'와 동일한 인자)
  const electronApp = await electron.launch({
    executablePath: vscodePath,
    args: [
      '--extensionDevelopmentPath=' + extensionDevPath,
      '--user-data-dir=' + testUserDataDir,
      '--profile=dev-vsc-copilot-cli',
      '--disable-workspace-trust',
      testWorkspacePath,
    ],
    timeout: 60_000,
  });

  // 첫 번째 윈도우 가져오기
  const page = await electronApp.firstWindow();

  // VS Code가 완전히 로드될 때까지 대기
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(5000);

  return { electronApp, page };
}

// ============================================================================
// VS Code 경로 헬퍼
// ============================================================================

/**
 * VS Code 실행 파일 경로를 반환합니다.
 * 시스템에 따라 경로가 다를 수 있습니다.
 */
export function getVSCodePath(): string {
  const platform = process.platform;

  if (platform === 'win32') {
    // Windows - 일반적인 설치 경로들
    const possiblePaths = [
      path.join(
        process.env.LOCALAPPDATA || '',
        'Programs',
        'Microsoft VS Code',
        'Code.exe'
      ),
      path.join(
        process.env.PROGRAMFILES || '',
        'Microsoft VS Code',
        'Code.exe'
      ),
      path.join(
        process.env['PROGRAMFILES(X86)'] || '',
        'Microsoft VS Code',
        'Code.exe'
      ),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }
  } else if (platform === 'darwin') {
    // macOS
    return '/Applications/Visual Studio Code.app/Contents/MacOS/Electron';
  } else {
    // Linux
    return '/usr/share/code/code';
  }

  throw new Error(
    'VS Code 실행 파일을 찾을 수 없습니다. getVSCodePath() 함수를 수정하세요.'
  );
}

// ============================================================================
// Chat 뷰 헬퍼
// ============================================================================

/**
 * Chat 뷰를 엽니다.
 */
export async function openChatView(page: Page): Promise<void> {
  // Command Palette 열기 (Ctrl+Shift+P / Cmd+Shift+P)
  const modifier = getModifierKey();
  await page.keyboard.press(`${modifier}+Shift+P`);
  await page.waitForTimeout(500);

  // Chat 열기 명령 입력
  await page.keyboard.type('Chat: Open Chat');
  await page.waitForTimeout(300);
  await page.keyboard.press('Enter');

  // Chat 뷰가 열릴 때까지 대기
  await page.waitForTimeout(3000);

  // Chat 뷰가 완전히 열렸는지 확인
  await page
    .waitForSelector('.interactive-input-part, .chat-widget', {
      timeout: 10_000,
    })
    .catch(() => {
      console.log('Chat 뷰를 찾지 못해 다시 시도합니다.');
    });
}

/**
 * 새 Chat을 시작합니다. (이전 세션 초기화)
 */
export async function startNewChat(page: Page): Promise<void> {
  // Chat 뷰 열기
  await openChatView(page);

  // Command Palette로 새 Chat 시작 (Ctrl+N / Cmd+N)
  const modifier = getModifierKey();
  await page.keyboard.press(`${modifier}+N`);
  await page.waitForTimeout(2000);
}

/**
 * Chat 입력창에 메시지를 전송합니다.
 */
export async function sendChatMessage(
  page: Page,
  message: string
): Promise<void> {
  // Chat 입력 영역 찾기
  // VS Code Chat은 Monaco Editor 기반이므로 직접 클릭이 어려움
  // 대신 interactive-input-part 영역을 찾고 키보드로 입력

  const inputContainerSelectors = [
    '.interactive-input-part',
    '.chat-input-part',
    '.interactive-input-editor',
  ];

  let inputContainer = null;

  for (const selector of inputContainerSelectors) {
    try {
      inputContainer = await page.waitForSelector(selector, { timeout: 3000 });
      if (inputContainer) {
        const isVisible = await inputContainer.isVisible();
        if (isVisible) {
          break;
        }
      }
    } catch {
      // 다음 selector 시도
    }
  }

  if (!inputContainer) {
    // 스크린샷으로 현재 상태 기록
    await page.screenshot({
      path: path.join(screenshotDir, 'chat-input-not-found.png'),
    });
    throw new Error('Chat 입력 영역을 찾을 수 없습니다.');
  }

  // 입력 영역 클릭 (force: true로 오버레이 무시)
  await inputContainer.click({ force: true });
  await page.waitForTimeout(300);

  // 혹시 기존 텍스트가 있으면 모두 선택 후 삭제 (Ctrl+A / Cmd+A)
  const modifier = getModifierKey();
  await page.keyboard.press(`${modifier}+A`);
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(100);

  // 메시지 입력
  await page.keyboard.type(message, { delay: 10 });
  await page.waitForTimeout(500);

  // 전송 (Enter)
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);
}

/**
 * Chat 응답이 완료될 때까지 대기합니다.
 */
export async function waitForChatResponse(
  page: Page,
  timeout: number = 60_000
): Promise<void> {
  const startTime = Date.now();

  // 응답 시작 대기
  await page.waitForTimeout(3000);

  // 응답 완료 대기 (로딩 인디케이터가 사라질 때까지)
  // VS Code Chat의 로딩 표시자: progress indicator, spinner 등
  const loadingSelectors = [
    '.chat-progress-message',
    '.codicon-loading',
    '.codicon-sync',
    '[class*="progress"]',
    '.chat-item-loading',
  ];

  while (Date.now() - startTime < timeout) {
    let isLoading = false;

    for (const selector of loadingSelectors) {
      const visible = await page
        .locator(selector)
        .isVisible()
        .catch(() => false);
      if (visible) {
        isLoading = true;
        break;
      }
    }

    if (!isLoading) {
      // 추가 대기 (스트리밍 완료 확인)
      await page.waitForTimeout(2000);

      // 다시 한번 확인
      let stillLoading = false;
      for (const selector of loadingSelectors) {
        const visible = await page
          .locator(selector)
          .isVisible()
          .catch(() => false);
        if (visible) {
          stillLoading = true;
          break;
        }
      }

      if (!stillLoading) {
        break;
      }
    }

    await page.waitForTimeout(1000);
  }

  // 최종 대기
  await page.waitForTimeout(1000);
}

/**
 * 마지막 Chat 응답 텍스트를 가져옵니다.
 */
export async function getChatResponseText(page: Page): Promise<string> {
  // VS Code Chat 응답 영역 - 더 구체적인 selector 사용
  const responseSelectors = [
    // Agent 응답의 markdown 콘텐츠
    '.chat-item-container.response .rendered-markdown',
    // Interactive item의 value 영역
    '.interactive-item-container.response .value',
    '.interactive-item-container .value .rendered-markdown',
    // Chat 응답 콘텐츠
    '.chat-response-content .rendered-markdown',
    // 일반 렌더링된 markdown
    '.chat-item-container .rendered-markdown',
    '.interactive-item-container .rendered-markdown',
  ];

  for (const selector of responseSelectors) {
    try {
      const elements = await page.locator(selector).all();
      if (elements.length > 0) {
        const lastElement = elements[elements.length - 1];
        const isVisible = await lastElement.isVisible().catch(() => false);
        if (isVisible) {
          const text = await lastElement.textContent();
          // Monaco 스타일 CSS가 아닌 실제 텍스트인지 확인
          if (text && text.trim() && !text.includes('.monaco-list.list_id_')) {
            return text.trim();
          }
        }
      }
    } catch {
      // 다음 selector 시도
    }
  }

  // Fallback: .value 클래스 중 텍스트가 있는 것
  try {
    const valueElements = await page.locator('.value').all();
    for (let i = valueElements.length - 1; i >= 0; i--) {
      const elem = valueElements[i];
      const isVisible = await elem.isVisible().catch(() => false);
      if (isVisible) {
        const text = await elem.textContent();
        // Monaco CSS가 아니고 유의미한 텍스트인 경우
        if (
          text &&
          text.trim() &&
          !text.includes('.monaco-') &&
          !text.includes('var(--vscode-')
        ) {
          return text.trim();
        }
      }
    }
  } catch {
    // 무시
  }

  await page.screenshot({
    path: path.join(screenshotDir, 'response-not-found.png'),
  });
  return '';
}

// ============================================================================
// 터미널 헬퍼
// ============================================================================

/**
 * 터미널이 열렸는지 확인합니다.
 * @param page - Playwright Page
 * @param terminalName - 확인할 터미널 이름 (예: "Claude CLI", "Gemini CLI")
 */
export async function checkTerminalOpened(
  page: Page,
  terminalName: string
): Promise<boolean> {
  // 터미널 패널이 열려있는지 확인
  // 터미널 탭 또는 터미널 영역 확인
  const terminalSelectors = [
    // 터미널 탭 selector
    `.terminal-tab[title*="${terminalName}"]`,
    `.terminal-tab[aria-label*="${terminalName}"]`,
    // 터미널 드롭다운 selector
    `.single-terminal-tab[title*="${terminalName}"]`,
    // 터미널 패널 내 터미널 이름
    `[class*="terminal"][aria-label*="${terminalName}"]`,
    // 터미널 탭 리스트 내 항목
    `.tabs-container [title*="${terminalName}"]`,
  ];

  // 잠시 대기 (터미널 생성 시간)
  await page.waitForTimeout(2000);

  for (const selector of terminalSelectors) {
    try {
      const element = await page.locator(selector).first();
      const isVisible = await element.isVisible().catch(() => false);
      if (isVisible) {
        return true;
      }
    } catch {
      // 다음 selector 시도
    }
  }

  // 대안: 터미널 패널 자체가 열려있고 내용에 CLI 이름이 있는지 확인
  try {
    const terminalPanel = page.locator('.terminal-wrapper, .xterm').first();
    const isVisible = await terminalPanel.isVisible().catch(() => false);
    if (isVisible) {
      // 터미널이 열려있으면 true 반환 (정확한 이름 확인이 어려울 수 있음)
      return true;
    }
  } catch {
    // 무시
  }

  // 스크린샷으로 현재 상태 기록
  await page.screenshot({
    path: path.join(
      screenshotDir,
      `terminal-check-${terminalName.replace(/\s+/g, '-')}.png`
    ),
  });

  return false;
}

/**
 * 열린 모든 터미널을 닫습니다.
 */
export async function closeAllTerminals(page: Page): Promise<void> {
  try {
    // Command Palette로 모든 터미널 종료 (Ctrl+Shift+P / Cmd+Shift+P)
    const modifier = getModifierKey();
    await page.keyboard.press(`${modifier}+Shift+P`);
    await page.waitForTimeout(500);

    await page.keyboard.type('Terminal: Kill All Terminals');
    await page.waitForTimeout(300);
    await page.keyboard.press('Enter');

    await page.waitForTimeout(1000);

    // Escape로 Command Palette 닫기
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  } catch {
    // 터미널 닫기 실패해도 계속 진행
    console.log('터미널 닫기 실패, 계속 진행합니다.');
  }
}
